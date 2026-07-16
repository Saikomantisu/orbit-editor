use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn open_project(
    app: tauri::AppHandle,
) -> Result<Option<crate::project::ProjectValidation>, String> {
    let Some(folder_path) = app
        .dialog()
        .file()
        .set_title("Open Astro Project")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };

    let path = folder_path
        .into_path()
        .map_err(|_| "Could not read the selected folder path.".to_string())?;

    allow_project_asset_previews(&app, &path)?;

    crate::project::scan_project_path(&path).map(Some)
}

#[tauri::command]
pub async fn select_image_asset(
    app: tauri::AppHandle,
    project_path: String,
    entry_file_path: String,
    current_reference: Option<String>,
) -> Result<Option<crate::content::ImageAssetSelection>, String> {
    let project_path = std::path::Path::new(&project_path)
        .canonicalize()
        .map_err(|_| "The selected project folder does not exist or cannot be read.".to_string())?;

    if !project_path.is_dir() {
        return Err("Choose an Astro project folder before selecting an image.".to_string());
    }

    allow_project_asset_previews(&app, &project_path)?;

    let mut dialog = app.dialog().file().set_title("Choose Image").add_filter(
        "Images",
        &["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"],
    );

    if let Some(current_reference) = current_reference.as_deref() {
        if let Some((directory, file_name)) =
            image_dialog_start(&project_path, &entry_file_path, current_reference)
        {
            dialog = dialog.set_directory(directory);
            if let Some(file_name) = file_name {
                dialog = dialog.set_file_name(file_name);
            }
        }
    } else {
        dialog = dialog.set_directory(&project_path);
    }

    let Some(file_path) = dialog.blocking_pick_file() else {
        return Ok(None);
    };

    let image_path = file_path
        .into_path()
        .map_err(|_| "Could not read the selected image path.".to_string())?
        .canonicalize()
        .map_err(|_| "Could not read the selected image file.".to_string())?;

    if image_path.starts_with(&project_path) {
        let asset =
            crate::content::project_image_reference(&project_path, &entry_file_path, &image_path)?;
        return Ok(Some(crate::content::ImageAssetSelection::Project {
            reference: asset.reference,
            file_name: asset.file_name,
        }));
    }

    let file_name = image_path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .ok_or_else(|| "Could not read the selected image file name.".to_string())?;
    Ok(Some(crate::content::ImageAssetSelection::External {
        source_path: image_path.to_string_lossy().into_owned(),
        file_name,
    }))
}

#[tauri::command]
pub fn scan_project(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<crate::project::ProjectValidation, String> {
    let validation = crate::project::scan_project(&project_path)?;
    allow_project_asset_previews(&app, std::path::Path::new(&validation.path))?;
    Ok(validation)
}

#[tauri::command]
pub fn scan_collections(project_path: String) -> Result<crate::content::CollectionScan, String> {
    crate::content::scan_collections(&project_path)
}

#[tauri::command]
pub fn read_collection(collection: String) -> Result<(), String> {
    crate::content::read_collection(&collection)
}

#[tauri::command]
pub fn read_entry(
    project_path: String,
    file_path: String,
) -> Result<crate::content::Entry, String> {
    crate::content::read_entry_file(&project_path, &file_path)
}

#[tauri::command]
pub fn create_entry(
    input: crate::content::CreateEntryInput,
) -> Result<crate::content::EntrySummary, String> {
    crate::content::create_entry(input)
}

#[tauri::command]
pub fn duplicate_entry(
    input: crate::content::DuplicateEntryInput,
) -> Result<crate::content::EntrySummary, String> {
    crate::content::duplicate_entry(input)
}

#[tauri::command]
pub fn save_entry(input: crate::content::SaveEntryInput) -> Result<crate::content::Entry, String> {
    crate::content::save_entry(input)
}

#[tauri::command]
pub fn import_image_asset(
    project_path: String,
    entry_file_path: String,
    source_path: String,
) -> Result<crate::content::ImageAssetImport, String> {
    crate::content::import_image_asset(&project_path, &entry_file_path, &source_path)
}

#[tauri::command]
pub fn delete_entry(input: crate::content::DeleteEntryInput) -> Result<(), String> {
    crate::content::delete_entry(input)
}

#[tauri::command]
pub fn start_dev_server(
    preview: tauri::State<crate::preview::PreviewManager>,
    project_path: String,
) -> Result<crate::preview::PreviewStatus, String> {
    crate::preview::start_dev_server(&preview, &project_path)
}

#[tauri::command]
pub fn stop_dev_server(
    preview: tauri::State<crate::preview::PreviewManager>,
) -> Result<crate::preview::PreviewStatus, String> {
    crate::preview::stop_dev_server(&preview)
}

#[tauri::command]
pub fn stop_process_on_preview_port() -> Result<(), String> {
    crate::preview::stop_process_on_preview_port()
}

#[tauri::command]
pub fn preview_status(
    preview: tauri::State<crate::preview::PreviewManager>,
) -> Result<crate::preview::PreviewStatus, String> {
    crate::preview::status(&preview)
}

#[tauri::command]
pub fn open_preview_in_browser(
    app: tauri::AppHandle,
    preview: tauri::State<crate::preview::PreviewManager>,
) -> Result<(), String> {
    let status = crate::preview::status(&preview)?;
    if !matches!(status.state, crate::preview::PreviewState::Running) {
        return Err("Start the Astro preview before opening it in your browser.".to_string());
    }

    let url = status.url.ok_or_else(|| {
        "The Astro preview address is unavailable. Restart preview and try again.".to_string()
    })?;

    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("Could not open the Astro preview in your browser: {error}"))
}

fn allow_project_asset_previews(
    app: &tauri::AppHandle,
    project_path: &std::path::Path,
) -> Result<(), String> {
    let project_path = project_path
        .canonicalize()
        .map_err(|_| "The selected project folder does not exist or cannot be read.".to_string())?;

    app.asset_protocol_scope()
        .allow_directory(&project_path, true)
        .map_err(|_| "Could not allow image previews for the selected project.".to_string())
}

fn image_dialog_start(
    project_path: &std::path::Path,
    entry_file_path: &str,
    image_reference: &str,
) -> Option<(std::path::PathBuf, Option<String>)> {
    let image_reference = image_reference.trim();
    if image_reference.is_empty() || image_reference.contains("://") {
        return Some((project_path.to_path_buf(), None));
    }

    let candidate = if image_reference.starts_with('/') {
        project_path
            .join("public")
            .join(image_reference.trim_start_matches('/'))
    } else {
        let path = std::path::Path::new(image_reference);
        if path.is_absolute() {
            path.to_path_buf()
        } else {
            std::path::Path::new(entry_file_path)
                .parent()
                .map(|entry_dir| entry_dir.join(path))
                .unwrap_or_else(|| project_path.join(path))
        }
    };

    let candidate = candidate.canonicalize().unwrap_or(candidate);
    let start_directory = if candidate.is_dir() {
        candidate.clone()
    } else {
        candidate
            .parent()
            .filter(|parent| parent.starts_with(project_path))
            .map(std::path::Path::to_path_buf)
            .unwrap_or_else(|| project_path.to_path_buf())
    };

    let file_name = candidate
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .map(str::to_string);

    Some((start_directory, file_name))
}
