use tauri_plugin_dialog::DialogExt;

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

    crate::project::scan_project_path(&path).map(Some)
}

#[tauri::command]
pub fn scan_project(project_path: String) -> Result<crate::project::ProjectValidation, String> {
    crate::project::scan_project(&project_path)
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
pub fn read_entry(file_path: String) -> Result<(), String> {
    crate::content::read_entry(&file_path)
}

#[tauri::command]
pub fn save_entry(
    file_path: String,
    frontmatter: serde_json::Value,
    body: String,
) -> Result<(), String> {
    crate::markdown::save_entry(&file_path, frontmatter, &body)
}

#[tauri::command]
pub fn delete_entry(file_path: String) -> Result<(), String> {
    crate::content::delete_entry(&file_path)
}

#[tauri::command]
pub fn start_dev_server(project_path: String) -> Result<(), String> {
    crate::preview::start_dev_server(&project_path)
}

#[tauri::command]
pub fn stop_dev_server() -> Result<(), String> {
    crate::preview::stop_dev_server()
}
