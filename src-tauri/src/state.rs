// SPDX-License-Identifier: MIT
use std::path::PathBuf;
use std::sync::Mutex;

use crate::services::download_service::DownloadManager;
use crate::services::job_service::JobManager;
use crate::services::watcher_service::WatcherManager;
use crate::services::cli_update_service::CliVerifier;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct TraySettings {
    pub minimize_to_tray: bool,
    pub notify_on_minimize: bool,
}

/// Holds the application's shared state.
pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub log_dir: PathBuf,
    pub app_data_dir: Option<PathBuf>,
    pub tray_settings: Mutex<TraySettings>,
    pub download_manager: DownloadManager,
    pub job_manager: JobManager,
    pub watcher_manager: WatcherManager,
    pub cli_verifier: Arc<dyn CliVerifier>,
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_settings_mutex() {
        let settings = TraySettings {
            minimize_to_tray: false,
            notify_on_minimize: true,
        };
        let mutex = Mutex::new(settings.clone());

        {
            let mut guard = mutex.lock().unwrap();
            guard.minimize_to_tray = true;
        }

        let final_settings = mutex.lock().unwrap();
        assert!(final_settings.minimize_to_tray);
        assert!(final_settings.notify_on_minimize);
    }
}
