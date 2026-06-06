use crate::error::CResult;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn set_tray_settings(
    state: State<'_, AppState>,
    minimize_to_tray: bool,
    notify_on_minimize: bool,
) -> CResult<()> {
    let mut settings = state
        .tray_settings
        .lock()
        .map_err(|e| crate::error::Error::Unknown(format!("Mutex poisoned: {}", e)))?;
    settings.minimize_to_tray = minimize_to_tray;
    settings.notify_on_minimize = notify_on_minimize;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use crate::state::{AppState, TraySettings};
    use tauri::Manager;

    #[tokio::test]
    async fn test_set_tray_settings() {
        let app = tauri::test::mock_app();
        let handle = app.handle();

        let db = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        let log_dir = std::path::PathBuf::from("/tmp/logs");

        handle.manage(AppState {
            db: db.clone(),
            log_dir,
            app_data_dir: None,
            tray_settings: std::sync::Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: true,
            }),
            download_manager: crate::services::download_service::DownloadManager::new(1),
            job_manager: crate::services::job_service::JobManager::new(db),
            watcher_manager: crate::services::watcher_service::WatcherManager::new(),
            cli_verifier: std::sync::Arc::new(crate::services::cli_update_service::RealCliVerifier),
        });

        let state = handle.state::<AppState>();

        // Update settings
        let result = set_tray_settings(state.clone(), true, false).await;
        assert!(result.is_ok());

        // Verify changes
        let settings = state.tray_settings.lock().unwrap();
        assert!(settings.minimize_to_tray);
        assert!(!settings.notify_on_minimize);
    }

    #[tokio::test]
    async fn test_set_tray_settings_poisoned_mutex() {
        let app = tauri::test::mock_app();
        let handle = app.handle();

        let db = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        let log_dir = std::path::PathBuf::from("/tmp/logs");

        let tray_settings = std::sync::Mutex::new(TraySettings {
            minimize_to_tray: false,
            notify_on_minimize: true,
        });

        // Manually poison the mutex
        {
            let _ = std::panic::catch_unwind(|| {
                let _lock = tray_settings.lock().unwrap();
                panic!("Poisoning mutex");
            });
        }
        assert!(tray_settings.is_poisoned());

        handle.manage(AppState {
            db: db.clone(),
            log_dir,
            app_data_dir: None,
            tray_settings,
            download_manager: crate::services::download_service::DownloadManager::new(1),
            job_manager: crate::services::job_service::JobManager::new(db),
            watcher_manager: crate::services::watcher_service::WatcherManager::new(),
            cli_verifier: std::sync::Arc::new(crate::services::cli_update_service::RealCliVerifier),
        });

        let state = handle.state::<AppState>();

        let result = set_tray_settings(state, true, true).await;
        assert!(result.is_err());
        if let Err(crate::error::Error::Unknown(msg)) = result {
            assert!(msg.contains("Mutex poisoned"));
        } else {
            panic!("Expected Mutex poisoned error");
        }
    }
}
