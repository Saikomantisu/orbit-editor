#[tauri::command]
pub fn open_project() -> Result<(), String> {
    Err("Project folder selection is not implemented yet.".to_string())
}

#[tauri::command]
pub fn scan_project(project_path: String) -> Result<(), String> {
    crate::project::scan_project(&project_path)
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
