mod commands;
mod content;
mod preview;
mod project;
mod schema;

use tauri::Manager;

const PREVIEW_LOCATION_BRIDGE: &str = r#"
  if (window.parent !== window) {
    const messageType = "orbit:preview-location";
    const reportLocation = () => {
      window.parent.postMessage({ type: messageType, url: window.location.href }, "*");
    };
    const notifyAfter = (method) => {
      const original = window.history[method];
      window.history[method] = function (...args) {
        const result = original.apply(this, args);
        reportLocation();
        return result;
      };
    };

    notifyAfter("pushState");
    notifyAfter("replaceState");
    window.addEventListener("popstate", reportLocation);
    window.addEventListener("hashchange", reportLocation);
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent || event.data?.type !== "orbit:preview-command") {
        return;
      }

      if (event.data.command === "back") window.history.back();
      if (event.data.command === "forward") window.history.forward();
      if (event.data.command === "reload") window.location.reload();
    });
    reportLocation();
  }
"#;

pub fn run() {
    tauri::Builder::default()
        .manage(preview::PreviewManager::default())
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("preview-location-bridge")
                .js_init_script_on_all_frames(PREVIEW_LOCATION_BRIDGE)
                .build(),
        )
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
