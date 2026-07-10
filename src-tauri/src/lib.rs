mod commands;
mod content;
mod markdown;
mod preview;
mod project;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::open_project,
            commands::scan_project,
            commands::read_collection,
            commands::read_entry,
            commands::save_entry,
            commands::delete_entry,
            commands::start_dev_server,
            commands::stop_dev_server,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Orbit Editor");
}
