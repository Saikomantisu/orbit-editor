mod commands;
mod content;
mod preview;
mod project;
mod schema;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_project,
            commands::pick_project_image,
            commands::scan_project,
            commands::scan_collections,
            commands::read_collection,
            commands::read_entry,
            commands::create_entry,
            commands::duplicate_entry,
            commands::save_entry,
            commands::delete_entry,
            commands::start_dev_server,
            commands::stop_dev_server,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Orbit Editor");
}
