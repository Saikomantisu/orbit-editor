use serde::Serialize;
#[cfg(target_os = "macos")]
use std::env;
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

const PREVIEW_HOST: &str = "127.0.0.1";
const PREVIEW_PORT: u16 = 4321;
#[derive(Clone, Default)]
pub struct PreviewManager {
    inner: Arc<Mutex<PreviewProcess>>,
}

#[derive(Default)]
struct PreviewProcess {
    child: Option<Child>,
    #[cfg(unix)]
    process_group: Option<i32>,
    project_path: Option<String>,
    output: String,
    status: PreviewStatus,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewStatus {
    pub state: PreviewState,
    pub url: Option<String>,
    pub command: Option<String>,
    pub message: Option<String>,
    pub can_stop_port_process: bool,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PreviewState {
    #[default]
    Stopped,
    Starting,
    Running,
    Error,
}

pub fn start_dev_server(
    manager: &PreviewManager,
    project_path: &str,
) -> Result<PreviewStatus, String> {
    let project_path = validated_astro_project_path(project_path)?;
    let command = detect_dev_command(&project_path)?;

    let stderr;
    {
        let mut process = lock(manager)?;
        refresh_status(&mut process);

        if matches!(
            process.status.state,
            PreviewState::Starting | PreviewState::Running
        ) && process.project_path.as_deref() == Some(project_path.as_str())
        {
            return Ok(process.status.clone());
        }

        stop_process(&mut process);

        if preview_port_is_in_use() {
            let status = PreviewStatus {
                state: PreviewState::Error,
                url: Some(preview_url()),
                command: Some(command.display),
                message: Some(format!(
                    "Port {PREVIEW_PORT} is already in use. Stop the local process using http://{PREVIEW_HOST}:{PREVIEW_PORT}, then start preview again."
                )),
                can_stop_port_process: true,
            };
            process.status = status.clone();
            return Ok(status);
        }

        let mut command_process = Command::new(&command.program);
        command_process
            .args(&command.args)
            .current_dir(&project_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        configure_package_manager_environment(&mut command_process);

        // Package managers start Astro as a child process. Give the runner its own process group
        // so Stop can also terminate Astro instead of leaving port 4321 occupied.
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command_process.process_group(0);
        }

        let mut child = command_process
            .spawn()
            .map_err(|error| {
                format!(
                    "Could not start the Astro dev server with '{}'. Make sure {} is installed for this project. ({error})",
                    command.display, command.runner
                )
            })?;
        stderr = child.stderr.take();

        // Keep the handle until the server is stopped or exits. The process is intentionally
        // started from the selected project's directory so Astro uses its real configuration.
        #[cfg(unix)]
        {
            process.process_group = Some(child.id() as i32);
        }
        process.child = Some(child);
        process.project_path = Some(project_path.clone());
        process.output.clear();
        process.status = PreviewStatus {
            state: PreviewState::Starting,
            url: Some(preview_url()),
            command: Some(command.display),
            message: Some("Starting Astro dev server…".to_string()),
            can_stop_port_process: false,
        };
    }

    if let Some(stderr) = stderr {
        collect_server_errors(manager.clone(), stderr);
    }
    wait_for_server(manager.clone(), project_path);
    status(manager)
}

// Apps launched by macOS Finder do not inherit the user's terminal PATH. Package
// managers such as pnpm (and the Node executable they delegate to) are commonly
// added by the user's shell configuration, so load that PATH before spawning the
// project-owned dev command.
#[cfg(target_os = "macos")]
fn configure_package_manager_environment(command: &mut Command) {
    if let Some(path) = macos_login_shell_path() {
        command.env("PATH", path);
    }
}

#[cfg(not(target_os = "macos"))]
fn configure_package_manager_environment(_: &mut Command) {}

#[cfg(target_os = "macos")]
fn macos_login_shell_path() -> Option<String> {
    let shell = env::var_os("SHELL").unwrap_or_else(|| "/bin/zsh".into());
    let output = Command::new(shell)
        .args(["-lic", "printf '\\n__ORBIT_PATH__%s\\n' \"$PATH\""])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let output = String::from_utf8(output.stdout).ok()?;
    let path = output.rsplit_once("__ORBIT_PATH__")?.1.trim();
    (!path.is_empty()).then(|| path.to_string())
}

pub fn stop_dev_server(manager: &PreviewManager) -> Result<PreviewStatus, String> {
    let mut process = lock(manager)?;
    stop_process(&mut process);
    Ok(process.status.clone())
}

pub fn stop_process_on_preview_port() -> Result<(), String> {
    #[cfg(unix)]
    {
        let process_ids = preview_port_listener_pids()?;
        if process_ids.is_empty() {
            return Ok(());
        }

        for process_id in &process_ids {
            // The recovery action is deliberately limited to listeners on Orbit's fixed,
            // loopback preview port. SIGTERM allows the other project's dev server to exit
            // cleanly before escalating if it leaves the listener open.
            unsafe {
                libc::kill(*process_id, libc::SIGTERM);
            }
        }

        for _ in 0..20 {
            if !preview_port_is_in_use() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(50));
        }

        for process_id in preview_port_listener_pids()? {
            unsafe {
                libc::kill(process_id, libc::SIGKILL);
            }
        }

        for _ in 0..20 {
            if !preview_port_is_in_use() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(50));
        }

        return Err(format!(
            "Could not stop the process using http://{PREVIEW_HOST}:{PREVIEW_PORT}. Stop it from your terminal and try again."
        ));
    }

    #[cfg(not(unix))]
    {
        Err("Stopping a process on the preview port is not supported on this platform yet. Stop the process using http://127.0.0.1:4321 and try again.".to_string())
    }
}

pub fn status(manager: &PreviewManager) -> Result<PreviewStatus, String> {
    let mut process = lock(manager)?;
    refresh_status(&mut process);
    Ok(process.status.clone())
}

fn canonical_project_path(project_path: &str) -> Result<String, String> {
    let path = Path::new(project_path)
        .canonicalize()
        .map_err(|_| "The selected project folder does not exist or cannot be read.".to_string())?;
    if !path.is_dir() {
        return Err("Choose an Astro project folder before starting preview.".to_string());
    }
    Ok(path.to_string_lossy().into_owned())
}

fn validated_astro_project_path(project_path: &str) -> Result<String, String> {
    let validation = crate::project::scan_project(project_path)?;
    if !validation.is_valid {
        return Err(validation.errors.into_iter().next().unwrap_or_else(|| {
            "Choose a valid Astro project before starting preview.".to_string()
        }));
    }

    canonical_project_path(&validation.path)
}

struct DevCommand {
    runner: &'static str,
    program: String,
    args: Vec<String>,
    display: String,
}

fn detect_dev_command(project_path: &str) -> Result<DevCommand, String> {
    let package_path = Path::new(project_path).join("package.json");
    let package = fs::read_to_string(&package_path)
        .map_err(|_| "Could not read package.json to find the Astro dev command.".to_string())?;
    let package: serde_json::Value = serde_json::from_str(&package).map_err(|_| {
        "package.json is not valid JSON, so Orbit Editor cannot start the dev server.".to_string()
    })?;
    let dev_script = package
        .pointer("/scripts/dev")
        .and_then(serde_json::Value::as_str)
        .filter(|script| !script.trim().is_empty())
        .ok_or_else(|| {
            "Could not find a 'dev' script in package.json. Add one such as \"dev\": \"astro dev\" and try again."
                .to_string()
        })?;

    let root = Path::new(project_path);
    let (runner, program) = if root.join("pnpm-lock.yaml").exists() {
        ("pnpm", "pnpm")
    } else if root.join("yarn.lock").exists() {
        ("yarn", "yarn")
    } else if root.join("bun.lockb").exists() || root.join("bun.lock").exists() {
        ("bun", "bun")
    } else {
        ("npm", "npm")
    };

    // npm requires `--` to forward script arguments. pnpm, Yarn, and Bun forward
    // arguments directly; adding a separator there becomes a literal `--` passed to Astro.
    let mut args = match runner {
        "npm" => vec!["run".to_string(), "dev".to_string(), "--".to_string()],
        "yarn" => vec!["dev".to_string()],
        "bun" => vec!["run".to_string(), "dev".to_string()],
        _ => vec!["run".to_string(), "dev".to_string()],
    };
    args.extend([
        "--host".to_string(),
        PREVIEW_HOST.to_string(),
        "--port".to_string(),
        PREVIEW_PORT.to_string(),
    ]);

    Ok(DevCommand {
        runner,
        program: program.to_string(),
        args,
        display: format!(
            "{} --host {PREVIEW_HOST} --port {PREVIEW_PORT} ({dev_script})",
            match runner {
                "yarn" => "yarn dev",
                "bun" => "bun run dev",
                "npm" => "npm run dev --",
                _ => "pnpm run dev",
            }
        ),
    })
}

fn wait_for_server(manager: PreviewManager, project_path: String) {
    thread::spawn(move || {
        for _ in 0..100 {
            thread::sleep(Duration::from_millis(100));
            let Ok(mut process) = lock(&manager) else {
                return;
            };
            if process.project_path.as_deref() != Some(project_path.as_str()) {
                return;
            }
            refresh_status(&mut process);
            if matches!(
                process.status.state,
                PreviewState::Error | PreviewState::Stopped
            ) {
                return;
            }
            if preview_responds_to_http_request() {
                process.status.state = PreviewState::Running;
                process.status.message = None;
                process.status.can_stop_port_process = false;
                return;
            }
        }

        if let Ok(mut process) = lock(&manager) {
            if process.project_path.as_deref() == Some(project_path.as_str())
                && matches!(process.status.state, PreviewState::Starting)
            {
                process.status.state = PreviewState::Error;
                process.status.message = Some(
                    "Astro did not become available at http://127.0.0.1:4321. Check that port 4321 is free and that the project's dev script starts Astro."
                        .to_string(),
                );
                process.status.can_stop_port_process = false;
                if let Some(mut child) = process.child.take() {
                    terminate_process(&mut child, process.process_group.take());
                }
                process.project_path = None;
            }
        }
    });
}

fn collect_server_errors(manager: PreviewManager, stderr: std::process::ChildStderr) {
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            let Ok(mut process) = lock(&manager) else {
                return;
            };
            process.output.push_str(&line);
            process.output.push('\n');
            // Keep enough output to explain a failure without retaining an unbounded dev log.
            if process.output.len() > 4_000 {
                process.output = process.output.chars().rev().take(4_000).collect::<String>();
                process.output = process.output.chars().rev().collect();
            }
        }
    });
}

fn refresh_status(process: &mut PreviewProcess) {
    let Some(child) = process.child.as_mut() else {
        return;
    };
    match child.try_wait() {
        Ok(Some(exit_status)) => {
            process.child = None;
            #[cfg(unix)]
            {
                process.process_group = None;
            }
            process.status.state = PreviewState::Error;
            process.status.message = Some(server_exit_message(exit_status, &process.output));
            process.status.can_stop_port_process = false;
        }
        Ok(None) => {}
        Err(error) => {
            process.child = None;
            #[cfg(unix)]
            {
                process.process_group = None;
            }
            process.status.state = PreviewState::Error;
            process.status.message = Some(format!("Could not check the Astro dev server: {error}"));
            process.status.can_stop_port_process = false;
        }
    }
}

fn server_exit_message(exit_status: std::process::ExitStatus, output: &str) -> String {
    let output = output.trim();
    if output.is_empty() {
        return format!(
            "The Astro dev server stopped before preview was ready ({exit_status}). Check the dev command in package.json and try again."
        );
    }

    let output = output.chars().rev().take(1_500).collect::<String>();
    let output = output.chars().rev().collect::<String>();
    format!("The Astro dev server stopped ({exit_status}):\n{output}")
}

fn stop_process(process: &mut PreviewProcess) {
    if let Some(mut child) = process.child.take() {
        terminate_process(
            &mut child,
            #[cfg(unix)]
            process.process_group.take(),
        );
    }
    process.project_path = None;
    process.output.clear();
    process.status = PreviewStatus::default();
}

fn terminate_process(child: &mut Child, #[cfg(unix)] process_group: Option<i32>) {
    #[cfg(unix)]
    if let Some(process_group) = process_group {
        // A negative PID targets the whole process group, including the Astro server spawned by
        // npm, pnpm, Yarn, or Bun. SIGTERM lets Astro shut down cleanly.
        unsafe {
            libc::kill(-process_group, libc::SIGTERM);
        }

        let mut child_exited = false;
        for _ in 0..20 {
            if !child_exited {
                match child.try_wait() {
                    Ok(Some(_)) => child_exited = true,
                    Ok(None) => {}
                    Err(_) => child_exited = true,
                }
            }

            // The runner can exit before Astro has finished closing its listener. Do not return
            // Stop until that listener is gone, otherwise an immediate restart can race it.
            if child_exited && TcpStream::connect((PREVIEW_HOST, PREVIEW_PORT)).is_err() {
                return;
            }

            thread::sleep(Duration::from_millis(50));
        }

        unsafe {
            libc::kill(-process_group, libc::SIGKILL);
        }
    }

    let _ = child.kill();
    let _ = child.wait();
}

fn lock(manager: &PreviewManager) -> Result<std::sync::MutexGuard<'_, PreviewProcess>, String> {
    manager.inner.lock().map_err(|_| {
        "Preview server state is unavailable. Restart Orbit Editor and try again.".to_string()
    })
}

fn preview_url() -> String {
    format!("http://{PREVIEW_HOST}:{PREVIEW_PORT}")
}

// Astro can bind its port before it has finished preparing the first page. A TCP
// connection alone therefore lets the iframe load too early and occasionally renders
// a blank initial preview. Wait until the root URL has returned a successful response.
fn preview_responds_to_http_request() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], PREVIEW_PORT));
    let timeout = Duration::from_millis(100);
    let Ok(mut stream) = TcpStream::connect_timeout(&address, timeout) else {
        return false;
    };

    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    if stream
        .write_all(
            format!(
                "GET / HTTP/1.1\r\nHost: {PREVIEW_HOST}:{PREVIEW_PORT}\r\nConnection: close\r\n\r\n"
            )
            .as_bytes(),
        )
        .is_err()
    {
        return false;
    }

    let mut response_start = [0; 16];
    let Ok(bytes_read) = stream.read(&mut response_start) else {
        return false;
    };

    is_successful_http_response(&response_start[..bytes_read])
}

fn is_successful_http_response(response_start: &[u8]) -> bool {
    let Ok(response_start) = std::str::from_utf8(response_start) else {
        return false;
    };
    let Some(status) = response_start.split_whitespace().nth(1) else {
        return false;
    };
    matches!(status.parse::<u16>(), Ok(200..=399))
}

fn preview_port_is_in_use() -> bool {
    TcpListener::bind((PREVIEW_HOST, PREVIEW_PORT)).is_err()
}

#[cfg(unix)]
fn preview_port_listener_pids() -> Result<Vec<i32>, String> {
    let output = Command::new("lsof")
        .args(["-tiTCP:4321", "-sTCP:LISTEN", "-a", "-nP"])
        .output()
        .map_err(|error| format!("Could not find the process using the preview port: {error}"))?;

    if !output.status.success() && !output.stdout.is_empty() {
        return Err("Could not identify the process using the preview port.".to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<i32>().ok())
        .collect())
}

#[cfg(test)]
mod tests {
    use super::is_successful_http_response;

    #[test]
    fn accepts_successful_http_responses() {
        assert!(is_successful_http_response(b"HTTP/1.1 200 OK\r\n"));
        assert!(is_successful_http_response(b"HTTP/1.1 302 Found\r\n"));
    }

    #[test]
    fn rejects_incomplete_and_failed_http_responses() {
        assert!(!is_successful_http_response(b"HTTP/1.1"));
        assert!(!is_successful_http_response(
            b"HTTP/1.1 503 Service Unavailable\r\n"
        ));
        assert!(!is_successful_http_response(b"not an HTTP response"));
    }
}
