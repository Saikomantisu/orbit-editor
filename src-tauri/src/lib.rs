mod commands;
mod content;
mod preview;
mod project;
mod schema;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .manage(preview::PreviewManager::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_project,
            commands::select_image_asset,
            commands::scan_project,
            commands::scan_collections,
            commands::read_collection,
            commands::read_entry,
            commands::create_entry,
            commands::duplicate_entry,
            commands::save_entry,
            commands::import_image_asset,
            commands::delete_entry,
            commands::start_dev_server,
            commands::stop_dev_server,
            commands::stop_process_on_preview_port,
            commands::preview_status,
            commands::open_preview_in_browser,
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                let preview = window.state::<preview::PreviewManager>();
                let _ = preview::stop_dev_server(&preview);
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Orbit Editor");
}
