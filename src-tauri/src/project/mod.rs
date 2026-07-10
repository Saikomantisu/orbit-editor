use serde::Serialize;
use std::{fs, path::Path};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCheck {
    pub id: &'static str,
    pub label: &'static str,
    pub ok: bool,
    pub detail: String,
    pub required: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectValidation {
    pub path: String,
    pub name: String,
    pub is_valid: bool,
    pub checks: Vec<ProjectCheck>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn scan_project(project_path: &str) -> Result<ProjectValidation, String> {
    if project_path.trim().is_empty() {
        return Err("Choose an Astro project folder before scanning.".to_string());
    }

    scan_project_path(Path::new(project_path))
}

pub fn scan_project_path(project_path: &Path) -> Result<ProjectValidation, String> {
    let project_path = project_path
        .canonicalize()
        .map_err(|_| "The selected folder does not exist or cannot be read.".to_string())?;

    if !project_path.is_dir() {
        return Err("Choose a folder, not a file.".to_string());
    }

    let project_name = project_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Selected project")
        .to_string();

    let package_json_path = project_path.join("package.json");
    let package_json_exists = package_json_path.is_file();
    let mut package_json_parse_error = None;
    let has_astro_dependency = if package_json_exists {
        match fs::read_to_string(&package_json_path) {
            Ok(contents) => match serde_json::from_str::<serde_json::Value>(&contents) {
                Ok(package_json) => package_has_astro_dependency(&package_json),
                Err(_) => {
                    package_json_parse_error =
                        Some("package.json exists, but it is not valid JSON.".to_string());
                    false
                }
            },
            Err(_) => {
                package_json_parse_error =
                    Some("package.json exists, but Orbit Editor could not read it.".to_string());
                false
            }
        }
    } else {
        false
    };

    let astro_config_path = find_file_with_stem(&project_path, "astro.config");
    let content_dir_path = project_path.join("src").join("content");
    let content_config_path = find_file_with_stem(&project_path, "content.config")
        .or_else(|| find_file_with_stem(&project_path.join("src"), "content.config"));

    let has_package_json = package_json_exists && package_json_parse_error.is_none();
    let has_astro_config = astro_config_path.is_some();
    let has_content_dir = content_dir_path.is_dir();
    let has_content_config = content_config_path.is_some();
    let has_astro_project_signal = has_astro_config || has_content_dir || has_content_config;

    let mut checks = vec![
        ProjectCheck {
            id: "package-json",
            label: "package.json",
            ok: has_package_json,
            detail: match &package_json_parse_error {
                Some(error) => error.clone(),
                None if has_package_json => "Found package.json.".to_string(),
                None => "Add a package.json file at the project root.".to_string(),
            },
            required: true,
        },
        ProjectCheck {
            id: "astro-dependency",
            label: "Astro dependency",
            ok: has_astro_dependency,
            detail: if has_astro_dependency {
                "Found astro in package dependencies.".to_string()
            } else {
                "Install Astro in dependencies or devDependencies.".to_string()
            },
            required: true,
        },
        ProjectCheck {
            id: "astro-config",
            label: "astro.config.*",
            ok: has_astro_config,
            detail: astro_config_path
                .as_ref()
                .and_then(|path| path.file_name())
                .and_then(|name| name.to_str())
                .map(|name| format!("Found {name}."))
                .unwrap_or_else(|| "No astro.config.* file found at the project root.".to_string()),
            required: false,
        },
        ProjectCheck {
            id: "content-directory",
            label: "src/content/",
            ok: has_content_dir,
            detail: if has_content_dir {
                "Found src/content/.".to_string()
            } else {
                "Create src/content/ before editing content collections.".to_string()
            },
            required: false,
        },
        ProjectCheck {
            id: "content-config",
            label: "content.config.*",
            ok: has_content_config,
            detail: content_config_path
                .as_ref()
                .and_then(|path| path.strip_prefix(&project_path).ok())
                .and_then(|path| path.to_str())
                .map(|path| format!("Found {path}."))
                .unwrap_or_else(|| {
                    "No content.config.* or src/content.config.* file found.".to_string()
                }),
            required: false,
        },
    ];

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if !has_package_json {
        errors.push(
            package_json_parse_error
                .unwrap_or_else(|| "This folder is missing package.json.".to_string()),
        );
    }

    if has_package_json && !has_astro_dependency {
        errors.push("package.json does not list Astro as a dependency.".to_string());
    }

    if has_package_json && has_astro_dependency && !has_astro_project_signal {
        errors.push(
            "No Astro project files were found. Expected astro.config.*, src/content/, or content.config.*."
                .to_string(),
        );
    }

    if has_package_json && has_astro_dependency && !has_content_dir {
        warnings.push(
            "src/content/ was not found, so there are no content collections to edit yet."
                .to_string(),
        );
    }

    if has_package_json && has_astro_dependency && !has_content_config {
        warnings.push(
            "No content.config.* file was found. Schema detection will be limited.".to_string(),
        );
    }

    if !has_astro_project_signal {
        checks.push(ProjectCheck {
            id: "astro-project-signal",
            label: "Astro project signal",
            ok: false,
            detail: "Expected astro.config.*, src/content/, or content.config.*.".to_string(),
            required: true,
        });
    }

    Ok(ProjectValidation {
        path: project_path.to_string_lossy().to_string(),
        name: project_name,
        is_valid: errors.is_empty(),
        checks,
        errors,
        warnings,
    })
}

fn package_has_astro_dependency(package_json: &serde_json::Value) -> bool {
    ["dependencies", "devDependencies", "peerDependencies"]
        .iter()
        .filter_map(|key| package_json.get(key))
        .filter_map(|dependencies| dependencies.as_object())
        .any(|dependencies| dependencies.contains_key("astro"))
}

fn find_file_with_stem(directory: &Path, stem: &str) -> Option<std::path::PathBuf> {
    let entries = fs::read_dir(directory).ok()?;

    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && path
                    .file_stem()
                    .and_then(|file_stem| file_stem.to_str())
                    .is_some_and(|file_stem| file_stem == stem)
        })
}
