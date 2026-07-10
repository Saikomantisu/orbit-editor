pub fn start_dev_server(project_path: &str) -> Result<(), String> {
    if project_path.trim().is_empty() {
        return Err("Choose an Astro project before starting preview.".to_string());
    }

    Err("Astro preview is not implemented yet.".to_string())
}

pub fn stop_dev_server() -> Result<(), String> {
    Err("Astro preview is not running.".to_string())
}
