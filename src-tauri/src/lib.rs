pub mod api;
mod cli;
mod commands;
mod error;
mod repositories;
mod services;
pub mod setup;
mod state;
pub mod util;

use state::{AppState, TraySettings};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_cli::CliExt;
use tauri_plugin_notification::NotificationExt;

/// Checks raw process args to detect CLI subcommands/flags that should
/// bypass the single-instance lock. This runs before the Tauri builder
/// so the second process can boot its own app context against the shared DB.
fn is_cli_invocation() -> bool {
    let args: Vec<String> = std::env::args().collect();
    is_cli_invocation_from_args(&args)
}

fn is_cli_invocation_from_args(args: &[String]) -> bool {
    if args.len() <= 1 {
        return false;
    }

    // Ignore macOS process serial number arg often passed to GUI apps
    if args.len() == 2 && args[1].starts_with("-psn") {
        return false;
    }

    // Only treat known CLI subcommands and flags as CLI invocations.
    // Arbitrary arguments (file paths, protocol URLs) should not bypass
    // the single-instance lock.
    let cli_commands = [
        "jobs", "download", "backup", "secret", "info",
        "--help", "-h", "--version", "-v", "--json", "-j",
    ];
    args.iter().skip(1).any(|arg| cli_commands.contains(&arg.as_str()))
}

fn handle_single_instance<R: tauri::Runtime>(app: &tauri::AppHandle<R>, _args: Vec<String>, _cwd: String) {
    // A duplicate GUI launch was attempted — bring the existing window to focus
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Runs the Main Application logic with the resolved data directory.
#[allow(clippy::expect_used, clippy::unwrap_used)]
pub fn run_app(custom_data_dir: Option<PathBuf>) {
    let specta_builder = api::collect();

    // Initialize Logging
    let (app_log_dir, log_plugin) =
        setup::logging::init(custom_data_dir.as_ref(), util::DATA_FOLDER_NAME);

    log::info!("==================================");
    log::info!("App Version: {}", env!("CARGO_PKG_VERSION"));
    log::info!("OS: {} ({})", std::env::consts::OS, std::env::consts::ARCH);
    log::info!("Resolved Data Directory: {}", app_log_dir.display());
    log::info!("==================================");

    // AppImage Auto-Integration (Unix only — AppImages don't exist on other platforms)
    #[cfg(unix)]
    {
        if services::appimage_service::is_appimage()
            && let Err(e) = services::appimage_service::integrate_appimage()
        {
            log::warn!("Failed to auto-integrate AppImage: {}", e);
        }
    }

    // Initialize Database
    let db_pool = tauri::async_runtime::block_on(setup::database::init(custom_data_dir.as_ref()))
        .expect("Failed to initialize database");

    let state_data_dir = custom_data_dir.clone();

    let is_cli = is_cli_invocation();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_cli::init());

    // Only enforce single-instance for GUI launches. CLI invocations need their
    // own process to access stdout and run against the shared database.
    if !is_cli {
        builder = builder.plugin(tauri_plugin_single_instance::init(handle_single_instance));
    }

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(log_plugin)
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db: db_pool.clone(),
            log_dir: app_log_dir,
            app_data_dir: state_data_dir.clone(),
            tray_settings: Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: true,
            }),
            download_manager: services::download_service::DownloadManager::new(3),
            job_manager: services::job_service::JobManager::new(db_pool),
            watcher_manager: services::watcher_service::WatcherManager::new(),
        })
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
            // --- CLI Handling ---
            match app.cli().matches() {
                Ok(matches) => {
                    if cli::handle_cli(app.handle(), &matches) {
                        app.handle().exit(0);
                        return Ok(());
                    }
                }
                Err(e) => {
                    eprintln!("{}", e);
                    std::process::exit(1);
                }
            }

            // Determine the unified data directory
            let context_data_dir = if let Some(dir) = &state_data_dir {
                dir.clone()
            } else {
                util::resolve_os_app_data_dir().join(util::DATA_FOLDER_NAME)
            };

            // We append "webview" to keep cache separate from DB/Logs
            let webview_data_dir = context_data_dir.join("webview");

            // Use the standard WebviewWindowBuilder
            // .data_directory() configures the WebContext internally
            // .visible(false) + on_page_load eliminates white flash on startup
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Tauri App Template")
            .visible(false)
            .data_directory(webview_data_dir)
            .devtools(true)
            .on_page_load(|window, payload| {
                if payload.event() == tauri::webview::PageLoadEvent::Finished {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            })
            .build()?;

            // --- System Tray Setup ---
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let icon = app.default_window_icon().cloned().expect("Default window icon is required");
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(handle_menu_event)
                .on_tray_icon_event(handle_tray_icon_event)
                .build(app)?;

            // --- Backup Scheduler ---
            services::scheduler::spawn_scheduler(app.handle().clone());

            Ok(())
        })
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let app_handle = window.app_handle();
        let state = app_handle.state::<AppState>();
        let Ok(settings) = state.tray_settings.lock() else {
            log::error!("Failed to acquire tray settings lock");
            return;
        };

        if settings.minimize_to_tray {
            if let Err(e) = window.hide() {
                log::error!("Failed to hide window: {}", e);
            }
            api.prevent_close();

            if settings.notify_on_minimize {
                let _ = app_handle
                    .notification()
                    .builder()
                    .title("Tauri App Template")
                    .body("Application minimized to tray")
                    .show();
            }
        }
        // If minimize_to_tray is false, the window closes normally (app exits if it's the main window)
    }
}

fn handle_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        "quit" => {
            app.exit(0);
        }
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

fn handle_tray_icon_event<R: tauri::Runtime>(tray: &tauri::tray::TrayIcon<R>, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
            // Toggle visibility
            if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tauri::Manager;

    #[test]
    fn test_is_cli_invocation_from_args() {
        // No args
        assert!(!is_cli_invocation_from_args(&["app".to_string()]));
        
        // Known subcommand
        assert!(is_cli_invocation_from_args(&["app".to_string(), "jobs".to_string()]));
        
        // Known flag
        assert!(is_cli_invocation_from_args(&["app".to_string(), "--help".to_string()]));
        
        // Mixed
        assert!(is_cli_invocation_from_args(&["app".to_string(), "backup".to_string(), "--json".to_string()]));

        // macOS -psn
        assert!(!is_cli_invocation_from_args(&["app".to_string(), "-psn_0_123456".to_string()]));

        // Arbitrary arg (e.g. file path or URL)
        assert!(!is_cli_invocation_from_args(&["app".to_string(), "/path/to/file".to_string()]));
    }

    #[tokio::test]
    async fn test_handle_menu_event_show() {
        let app = tauri::test::mock_app();
        let handle = app.handle();
        
        // In tests, we need to manage our own AppState because mock_app doesn't run run_app()
        let db = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        handle.manage(AppState {
            db: db.clone(),
            log_dir: PathBuf::from("/tmp"),
            app_data_dir: None,
            tray_settings: Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: true,
            }),
            download_manager: services::download_service::DownloadManager::new(1),
            job_manager: services::job_service::JobManager::new(db),
            watcher_manager: services::watcher_service::WatcherManager::new(),
        });

        let _window = tauri::WebviewWindowBuilder::new(handle, "main", tauri::WebviewUrl::App("index.html".into()))
            .build()
            .unwrap();
        
        // On mock runtime, window visibility state might not be accurately reflected,
        // but we verify the command execution doesn't panic.
        let event = tauri::menu::MenuEvent {
            id: "show".into(),
        };

        handle_menu_event(handle, event);
    }

    #[tokio::test]
    async fn test_handle_tray_icon_event_toggle() {
        let app = tauri::test::mock_app();
        let handle = app.handle();
        
        let db = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        handle.manage(AppState {
            db: db.clone(),
            log_dir: PathBuf::from("/tmp"),
            app_data_dir: None,
            tray_settings: Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: true,
            }),
            download_manager: services::download_service::DownloadManager::new(1),
            job_manager: services::job_service::JobManager::new(db),
            watcher_manager: services::watcher_service::WatcherManager::new(),
        });

        let _window = tauri::WebviewWindowBuilder::new(handle, "main", tauri::WebviewUrl::App("index.html".into()))
            .build()
            .unwrap();
        
        let tray = TrayIconBuilder::new().build(handle).unwrap();

        let event = TrayIconEvent::Click {
            id: "main-tray".into(),
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            position: tauri::PhysicalPosition::new(0.0, 0.0),
            rect: tauri::Rect {
                position: tauri::Position::Physical(tauri::PhysicalPosition::new(0, 0)),
                size: tauri::Size::Physical(tauri::PhysicalSize::new(0, 0)),
            },
        };
        handle_tray_icon_event(&tray, event);
    }

    #[tokio::test]
    async fn test_handle_single_instance_logic() {
        let app = tauri::test::mock_app();
        let handle = app.handle();
        
        let _window = tauri::WebviewWindowBuilder::new(handle, "main", tauri::WebviewUrl::App("index.html".into()))
            .build()
            .unwrap();
        
        // This confirms the logic correctly finds the "main" window and calls show/focus without panicking.
        handle_single_instance(handle, vec![], "".into());
    }
}
