// SPDX-License-Identifier: MIT
use crate::services::backup_service;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackupSettings {
    pub enabled: bool,
    pub interval: u64,
    pub max_backups: u32,
    pub last_backup_time: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize)]
struct StoreWrapper {
    state: BackupSettings,
    version: u32,
}

/// Trait for accessing application settings, enabling deterministic testing.
pub trait SettingsStore: Send + Sync {
    fn get_backup_settings(&self) -> Result<Option<BackupSettings>, Box<dyn std::error::Error>>;
    fn save_backup_settings(
        &self,
        settings: BackupSettings,
    ) -> Result<(), Box<dyn std::error::Error>>;
}

/// Production implementation of SettingsStore using Tauri Plugin Store.
pub struct TauriSettingsStore<R: tauri::Runtime> {
    app: AppHandle<R>,
}

impl<R: tauri::Runtime> TauriSettingsStore<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: tauri::Runtime> SettingsStore for TauriSettingsStore<R> {
    fn get_backup_settings(&self) -> Result<Option<BackupSettings>, Box<dyn std::error::Error>> {
        let state = self.app.state::<AppState>();
        let store_path = match &state.app_data_dir {
            Some(dir) => dir.join("store.bin"),
            None => std::path::PathBuf::from("store.bin"),
        };
        let stores = self.app.store(store_path)?;
        let Some(val) = stores.get("backup-settings") else {
            return Ok(None);
        };
        let wrapper: StoreWrapper = serde_json::from_value(val)?;
        Ok(Some(wrapper.state))
    }

    fn save_backup_settings(
        &self,
        settings: BackupSettings,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let state = self.app.state::<AppState>();
        let store_path = match &state.app_data_dir {
            Some(dir) => dir.join("store.bin"),
            None => std::path::PathBuf::from("store.bin"),
        };
        let stores = self.app.store(store_path)?;
        let wrapper = StoreWrapper {
            state: settings,
            version: 0,
        };
        stores.set("backup-settings", serde_json::to_value(wrapper)?);
        stores.save()?;
        Ok(())
    }
}

pub fn spawn_scheduler<R: tauri::Runtime>(app: AppHandle<R>) {
    log::info!("[Scheduler] Starting background scheduler");
    let store = TauriSettingsStore::new(app.clone());

    tauri::async_runtime::spawn(async move {
        // Initial delay to let the app settle
        tokio::time::sleep(Duration::from_secs(30)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(60 * 5)); // Check every 5 minutes
        loop {
            interval.tick().await;
            if let Err(e) = check_and_perform_backup(&app, &store, now_ms()).await {
                log::error!("[Scheduler] Backup check failed: {}", e);
            }
        }
    });
}

/// Helper to get current time in milliseconds.
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Determines if a backup should be performed based on settings and current time.
fn should_backup(settings: &BackupSettings, now: u64) -> bool {
    if !settings.enabled {
        return false;
    }
    match settings.last_backup_time {
        Some(last) => now >= last && now - last >= settings.interval,
        None => true,
    }
}

async fn check_and_perform_backup<R: tauri::Runtime>(
    app: &AppHandle<R>,
    store: &dyn SettingsStore,
    now: u64,
) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>();
    check_and_perform_backup_internal(&state.db, state.app_data_dir.as_ref(), store, now).await
}

async fn check_and_perform_backup_internal(
    db: &sqlx::SqlitePool,
    app_data_dir: Option<&std::path::PathBuf>,
    store: &dyn SettingsStore,
    now: u64,
) -> Result<(), Box<dyn std::error::Error>> {
    // If settings are not found (e.g. fresh install), fallback to default settings:
    // enabled: true, interval: 24h, max_backups: 5, last_backup_time: None.
    let mut settings = match store.get_backup_settings()? {
        Some(s) => s,
        None => BackupSettings {
            enabled: true,
            interval: 24 * 3600 * 1000, // 24 hours in ms
            max_backups: 5,
            last_backup_time: None,
        },
    };

    if should_backup(&settings, now) {
        let Some(data_dir) = app_data_dir else {
            log::warn!("[Scheduler] Cannot perform backup: app_data_dir is not set");
            return Ok(());
        };

        log::info!("[Scheduler] Triggering scheduled backup...");

        // 1. Create Backup
        backup_service::create_backup(db, data_dir, None, None).await?;

        // 2. Prune old backups
        let pruned = backup_service::prune_backups(data_dir, settings.max_backups).await?;
        if pruned > 0 {
            log::info!("[Scheduler] Pruned {} old backups", pruned);
        }

        // 3. Update last backup time
        settings.last_backup_time = Some(now);
        store.save_backup_settings(settings)?;

        log::info!("[Scheduler] Scheduled backup completed successfully");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use std::sync::Mutex;

    struct MockStore {
        settings: Mutex<Option<BackupSettings>>,
    }

    impl SettingsStore for MockStore {
        fn get_backup_settings(
            &self,
        ) -> Result<Option<BackupSettings>, Box<dyn std::error::Error>> {
            let settings = self.settings.lock().map_err(|e| e.to_string())?;
            Ok(settings.clone())
        }

        fn save_backup_settings(
            &self,
            settings: BackupSettings,
        ) -> Result<(), Box<dyn std::error::Error>> {
            let mut guard = self.settings.lock().map_err(|e| e.to_string())?;
            *guard = Some(settings);
            Ok(())
        }
    }

    #[test]
    fn test_should_backup_logic() {
        let settings = BackupSettings {
            enabled: true,
            interval: 1000,
            max_backups: 5,
            last_backup_time: Some(5000),
        };

        // Not yet time
        assert!(!should_backup(&settings, 5500));
        assert!(!should_backup(&settings, 5999));

        // Exactly time
        assert!(should_backup(&settings, 6000));

        // Past time
        assert!(should_backup(&settings, 7000));

        // Disabled
        let mut disabled = settings.clone();
        disabled.enabled = false;
        assert!(!should_backup(&disabled, 7000));

        // Never backed up before
        let mut never = settings.clone();
        never.last_backup_time = None;
        assert!(should_backup(&never, 100));
    }

    #[tokio::test]
    async fn test_check_and_perform_backup_skips_when_not_needed()
    -> Result<(), Box<dyn std::error::Error>> {
        // Use an in-memory DB for the test
        let db = SqlitePoolOptions::new().connect("sqlite::memory:").await?;

        let settings = BackupSettings {
            enabled: true,
            interval: 1000,
            max_backups: 5,
            last_backup_time: Some(5000),
        };
        let store = MockStore {
            settings: Mutex::new(Some(settings.clone())),
        };

        // Should skip because now (5500) - last (5000) < interval (1000)
        check_and_perform_backup_internal(&db, None, &store, 5500).await?;

        // Settings should remain unchanged
        let current_settings = store.get_backup_settings()?.ok_or("No settings")?;
        assert_eq!(current_settings.last_backup_time, Some(5000));

        Ok(())
    }

    #[tokio::test]
    async fn test_check_and_perform_backup_falls_back_to_defaults()
    -> Result<(), Box<dyn std::error::Error>> {
        let tmp = tempfile::tempdir()?;
        let data_dir = tmp.path().to_path_buf();
        let db_path = data_dir.join("source.db");
        tokio::fs::File::create(&db_path).await?;

        let db = SqlitePoolOptions::new()
            .connect(&format!("sqlite://{}", db_path.to_string_lossy()))
            .await?;

        let store = MockStore {
            settings: Mutex::new(None),
        };

        // Should perform backup because settings are None (falls back to defaults, last_backup_time = None)
        check_and_perform_backup_internal(&db, Some(&data_dir), &store, 10000).await?;

        // Settings should now be created and saved with last_backup_time = Some(10000)
        let current_settings = store.get_backup_settings()?.ok_or("No settings saved")?;
        assert!(current_settings.enabled);
        assert_eq!(current_settings.interval, 24 * 3600 * 1000);
        assert_eq!(current_settings.max_backups, 5);
        assert_eq!(current_settings.last_backup_time, Some(10000));

        Ok(())
    }
}
