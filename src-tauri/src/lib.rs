// SPDX-License-Identifier: MIT
pub mod api;
pub mod cli;
mod commands;
mod error;
pub mod repositories;
pub mod services;
pub mod setup;
mod state;
pub mod util;

use state::{AppState, TraySettings};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_notification::NotificationExt;

fn handle_single_instance<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    _args: Vec<String>,
    _cwd: String,
) {
    // A duplicate GUI launch was attempted — bring the existing window to focus
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(tray) = app.tray_by_id("main-tray") {
            let _ = tray.set_visible(false);
        }
    }
}

/// Runs the Main Application logic.
#[allow(clippy::expect_used, clippy::unwrap_used)]
pub fn run_app(dev_data_dir: Option<PathBuf>) {
    let specta_builder = api::collect();

    // Initialize PostHog analytics (Rust-side HTTP, bypasses WebView CORS) if key is set.
    if let Some(api_key) = option_env!("POSTHOG_API_KEY") {
        let trimmed_key = api_key.trim();
        if !trimmed_key.is_empty() {
            let guard = better_posthog::init(better_posthog::ClientOptions {
                api_key: Some(trimmed_key.into()),
                ..Default::default()
            });
            Box::leak(Box::new(guard));
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_better_posthog::init())
        .plugin(tauri_plugin_single_instance::init(handle_single_instance))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
            // 1. Resolve Data Directory
            let app_data_dir = if let Some(ref dir) = dev_data_dir {
                dir.clone()
            } else {
                app.path().app_data_dir().expect("Failed to resolve app data directory")
            };

            // 2. Resolve Log Directory
            let app_log_dir = if dev_data_dir.is_some() {
                 app_data_dir.join("logs")
            } else {
                 app.path().app_log_dir().expect("Failed to resolve app log dir")
            };

            // 2b. Initialize Logging
            let log_plugin = setup::logging::init(&app_data_dir, &app_log_dir);
            if let Err(err) = app.handle().plugin(log_plugin) {
                log::warn!("Failed to initialize log plugin: {err}");
            }

            if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").as_deref() == Ok("1") {
                log::info!("compat mode enabled: WEBKIT_DISABLE_DMABUF_RENDERER=1");
            }

            // 2c. Initialize Keyring Store
            if let Err(err) = keyring::use_native_store(true) {
                log::warn!("Failed to initialize native keyring store: {err}. Keyring-dependent features will not be available.");
            }

            log::info!("==================================");
            log::info!("App Version: {}", env!("CARGO_PKG_VERSION"));
            log::info!("OS: {} ({})", std::env::consts::OS, std::env::consts::ARCH);
            log::info!("Resolved Data Directory: {}", app_data_dir.display());
            log::info!("Resolved Log Directory: {}", app_log_dir.display());
            log::info!("PostHog API Key present: {}", option_env!("POSTHOG_API_KEY").map(|k| !k.trim().is_empty()).unwrap_or(false));
            log::info!("==================================");

            // 3. Lifecycle Checks (Reset / Restore)
            util::check_and_perform_reset(&app_data_dir);
            util::check_and_perform_restore(&app_data_dir);

            // 4. Initialize Database
            let db_pool = tauri::async_runtime::block_on(setup::database::init(Some(&app_data_dir)))
                .expect("Failed to initialize database");

            // 5. Manage App State
            app.manage(AppState {
                db: db_pool.clone(),
                log_dir: app_log_dir,
                app_data_dir: Some(app_data_dir.clone()),
                tray_settings: Mutex::new(TraySettings {
                    minimize_to_tray: false,
                    notify_on_minimize: true,
                }),
                download_manager: services::download_service::DownloadManager::new(3),
                job_manager: services::job_service::JobManager::new(db_pool),
                watcher_manager: services::watcher_service::WatcherManager::new(),
                cli_verifier: std::sync::Arc::new(services::cli_update_service::RealCliVerifier),
            });

            app.manage(services::theme_service::ThemeWatcherState {
                child: std::sync::Mutex::new(None),
            });

            // 7. Webview Window Setup
            let state = app.state::<AppState>();
            let context_data_dir = state.app_data_dir.as_ref().unwrap();
            let webview_data_dir = context_data_dir.join("webview");

            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Tauri App Template")
            .visible(false)
            .decorations(false)
            .data_directory(webview_data_dir)
            .devtools(true)
            .on_page_load(|window, payload| {
                if payload.event() == tauri::webview::PageLoadEvent::Finished {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            })
            .build()?;

            // 8. System Tray Setup
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let icon = app.default_window_icon().cloned().expect("Default window icon is required");
            let tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(handle_menu_event)
                .on_tray_icon_event(handle_tray_icon_event)
                .build(app)?;
            tray.set_visible(false)?;

            // 9. Backup Scheduler
            services::scheduler::spawn_scheduler(app.handle().clone());

            // 10. Linux Theme Watcher (Freedesktop portal)
            #[cfg(target_os = "linux")]
            services::theme_service::spawn_theme_watcher(app.handle().clone());

            // 11. Write app version for CLI parity check
            let version_file = app_data_dir.join("app_version.txt");
            if let Err(e) = std::fs::write(&version_file, env!("CARGO_PKG_VERSION")) {
                log::error!("Failed to write app version file: {}", e);
            }

            Ok(())
        })
        .on_window_event(handle_window_event)
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event
                && let Some(state) = app_handle.try_state::<services::theme_service::ThemeWatcherState>()
                && let Ok(mut lock) = state.child.lock()
                && let Some(mut child) = lock.take()
            {
                log::info!("Killing theme watcher child process");
                let _ = child.kill();
                let _ = child.wait();
            }
        });
}

fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
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

                if let Some(tray) = app_handle.tray_by_id("main-tray") {
                    let _ = tray.set_visible(true);
                }

                if settings.notify_on_minimize {
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title("Tauri App Template")
                        .body("Application minimized to tray")
                        .show();

                    #[cfg(target_os = "linux")]
                    {
                        let mut cmd = crate::util::new_system_command("notify-send");
                        if let Err(e) = cmd
                            .arg("Tauri App Template")
                            .arg("Application minimized to tray")
                            .spawn()
                        {
                            log::error!("Failed to spawn fallback notify-send: {}", e);
                        }
                    }
                }
            }
        }
        #[cfg(target_os = "windows")]
        tauri::WindowEvent::ThemeChanged(theme) => {
            use tauri::Emitter;
            let theme_str = match theme {
                tauri::Theme::Dark => "dark",
                _ => "light",
            };
            let _ = window.emit("system-theme-changed", theme_str);
        }
        _ => {}
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
                if let Some(tray) = app.tray_by_id("main-tray") {
                    let _ = tray.set_visible(false);
                }
            }
        }
        _ => {}
    }
}

fn handle_tray_icon_event<R: tauri::Runtime>(
    tray: &tauri::tray::TrayIcon<R>,
    event: TrayIconEvent,
) {
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
                if let Some(tray) = app.tray_by_id("main-tray") {
                    let _ = tray.set_visible(true);
                }
            } else {
                let _ = window.show();
                let _ = window.set_focus();
                if let Some(tray) = app.tray_by_id("main-tray") {
                    let _ = tray.set_visible(false);
                }
            }
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tauri::Manager;

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
            cli_verifier: std::sync::Arc::new(services::cli_update_service::RealCliVerifier),
        });

        let _window = tauri::WebviewWindowBuilder::new(
            handle,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .build()
        .unwrap();

        // On mock runtime, window visibility state might not be accurately reflected,
        // but we verify the command execution doesn't panic.
        let event = tauri::menu::MenuEvent { id: "show".into() };

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
            cli_verifier: std::sync::Arc::new(services::cli_update_service::RealCliVerifier),
        });

        let _window = tauri::WebviewWindowBuilder::new(
            handle,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .build()
        .unwrap();

        let tray = TrayIconBuilder::with_id("main-tray").build(handle).unwrap();

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

        let _window = tauri::WebviewWindowBuilder::new(
            handle,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .build()
        .unwrap();

        // This confirms the logic correctly finds the "main" window and calls show/focus without panicking.
        handle_single_instance(handle, vec![], "".into());
    }
}
