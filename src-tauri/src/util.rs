use crate::error::CResult;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

// --- CONSTANTS ---
const MARKER_WIPE_NAME: &str = ".pending_wipe";
pub const MARKER_RESTORE_NAME: &str = ".pending_restore";
pub const RESTORE_STAGING_NAME: &str = "restore.db.tmp";
const DB_NAME: &str = "tauri_app_template.db";

/// Resolves a path string.
pub fn resolve_path(path_str: &str) -> CResult<PathBuf> {
    Ok(PathBuf::from(path_str))
}

/// Resolves the development data directory relative to the Project Root.
pub fn resolve_dev_data_dir(dir_name: String) -> PathBuf {
    let path = match resolve_path(&dir_name) {
        Ok(p) => p,
        Err(_) => PathBuf::from(dir_name),
    };

    if path.is_absolute() {
        return path;
    }

    if let Ok(cwd) = env::current_dir()
        && let Some(project_root) = cwd.parent()
    {
        return project_root.join(path);
    }
    path
}

/// Checks for and performs factory reset if the marker file exists.
pub fn check_and_perform_reset(data_dir: &Path) {
    let marker = data_dir.join(MARKER_WIPE_NAME);
    if marker.exists() {
        log::info!(
            "Factory reset marker found at {:?}. Wiping target data...",
            marker
        );
        let _ = fs::remove_file(&marker);

        // Safely remove only the DB files and key-value store, leaving backups and logs intact.
        let targets_to_remove = [
            data_dir.join(DB_NAME),
            data_dir.join(format!("{}-shm", DB_NAME)),
            data_dir.join(format!("{}-wal", DB_NAME)),
            data_dir.join("store.bin"),
        ];

        for target in targets_to_remove {
            if target.exists()
                && let Err(e) = fs::remove_file(&target)
            {
                log::error!("Failed to remove file {:?}: {}", target, e);
            }
        }

        // Wipe the webview cache specifically
        let webview_dir = data_dir.join("webview");
        if webview_dir.exists()
            && let Err(e) = fs::remove_dir_all(&webview_dir)
        {
            log::error!("Failed to wipe webview data: {}", e);
        }

        log::info!("Factory reset completed.");
    }
}

pub fn schedule_factory_reset(data_dir: &Path) -> std::io::Result<()> {
    if !data_dir.exists() {
        fs::create_dir_all(data_dir)?;
    }
    fs::write(data_dir.join(MARKER_WIPE_NAME), "wipe_me")
}

/// Checks if a restore is pending and swaps the database file.
pub fn check_and_perform_restore(data_dir: &Path) {
    let marker = data_dir.join(MARKER_RESTORE_NAME);
    let staging = data_dir.join(RESTORE_STAGING_NAME);
    let target = data_dir.join(DB_NAME);

    if marker.exists() && staging.exists() {
        log::info!("Restore marker found. Swapping database...");
        // Remove marker first so if we crash we don't loop endlessly unless file exists
        let _ = fs::remove_file(&marker);

        // Remove WAL/SHM files if they exist to prevent corruption mixing old DB with new WAL
        let _ = fs::remove_file(data_dir.join(format!("{}-wal", DB_NAME)));
        let _ = fs::remove_file(data_dir.join(format!("{}-shm", DB_NAME)));

        // Perform swap
        if let Err(e) = fs::rename(&staging, &target) {
            log::error!("CRITICAL: Failed to restore database: {}", e);
            // Attempt to keep the staging file so user doesn't lose data
        } else {
            log::info!("Database restored successfully.");
        }
    } else if marker.exists() {
        // Marker exists but file is gone? cleanup.
        let _ = fs::remove_file(&marker);
    }
}

pub async fn schedule_restore(data_dir: &Path) -> std::io::Result<()> {
    tokio::fs::write(data_dir.join(MARKER_RESTORE_NAME), "restore_pending").await
}

pub fn format_bytes(bytes: u64) -> String {
    let units = ["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < units.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    format!("{:.2} {}", size, units[unit_index])
}

#[cfg(test)]
#[allow(unsafe_code, clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_resolve_dev_data_dir() {
        // Absolute path
        let abs_path = if cfg!(windows) {
            "C:\\test"
        } else {
            "/tmp/test"
        };
        let dir = resolve_dev_data_dir(abs_path.to_string());
        assert_eq!(dir, PathBuf::from(abs_path));

        // Relative path
        let dir_rel = resolve_dev_data_dir("my-data".to_string());
        assert!(dir_rel.to_string_lossy().contains("my-data"));
    }

    #[test]
    fn test_factory_reset_flow() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path();

        // 1. Create dummy files
        let db_file = data_dir.join(DB_NAME);
        let wal_file = data_dir.join(format!("{}-wal", DB_NAME));
        let shm_file = data_dir.join(format!("{}-shm", DB_NAME));
        let store_file = data_dir.join("store.bin");
        let webview_dir = data_dir.join("webview");
        let log_file = data_dir.join("latest.log");

        fs::write(&db_file, "db").unwrap();
        fs::write(&wal_file, "wal").unwrap();
        fs::write(&shm_file, "shm").unwrap();
        fs::write(&store_file, "store").unwrap();
        fs::create_dir(&webview_dir).unwrap();
        fs::write(webview_dir.join("cache.txt"), "cache").unwrap();
        fs::write(&log_file, "log").unwrap();

        // 2. Schedule reset
        schedule_factory_reset(data_dir).expect("Failed to schedule reset");
        assert!(data_dir.join(MARKER_WIPE_NAME).exists());

        // 3. Perform reset
        check_and_perform_reset(data_dir);

        // 4. Verify
        assert!(!data_dir.join(MARKER_WIPE_NAME).exists());
        assert!(!db_file.exists());
        assert!(!wal_file.exists());
        assert!(!shm_file.exists());
        assert!(!store_file.exists());
        assert!(!webview_dir.exists());
        assert!(log_file.exists()); // Logs should be preserved
    }

    #[tokio::test]
    async fn test_restore_flow() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path();

        let db_file = data_dir.join(DB_NAME);
        let staging_file = data_dir.join(RESTORE_STAGING_NAME);
        let wal_file = data_dir.join(format!("{}-wal", DB_NAME));

        fs::write(&db_file, "old_db").unwrap();
        fs::write(&staging_file, "new_db").unwrap();
        fs::write(&wal_file, "old_wal").unwrap();

        // 1. Schedule restore
        schedule_restore(data_dir)
            .await
            .expect("Failed to schedule restore");
        assert!(data_dir.join(MARKER_RESTORE_NAME).exists());

        // 2. Perform restore
        check_and_perform_restore(data_dir);

        // 3. Verify
        assert!(!data_dir.join(MARKER_RESTORE_NAME).exists());
        assert!(!staging_file.exists());
        assert!(!wal_file.exists());

        let content = fs::read_to_string(&db_file).unwrap();
        assert_eq!(content, "new_db");
    }

    #[test]
    fn test_resolve_path_remains_literal() {
        let tilde_path = resolve_path("~/test").expect("failed to resolve");
        assert_eq!(tilde_path, PathBuf::from("~/test"));

        let env_var_path = resolve_path("$VAR/test").expect("failed to resolve");
        assert_eq!(env_var_path, PathBuf::from("$VAR/test"));
    }

    #[test]
    fn test_format_bytes_zero() {
        assert_eq!(format_bytes(0), "0.00 B");
    }

    #[test]
    fn test_format_bytes_sub_kilobyte() {
        assert_eq!(format_bytes(1), "1.00 B");
        assert_eq!(format_bytes(1023), "1023.00 B");
    }

    #[test]
    fn test_format_bytes_kilobyte_boundary() {
        assert_eq!(format_bytes(1024), "1.00 KB");
    }

    #[test]
    fn test_format_bytes_megabyte() {
        assert_eq!(format_bytes(1024 * 1024), "1.00 MB");
    }

    #[test]
    fn test_format_bytes_gigabyte() {
        assert_eq!(format_bytes(1024 * 1024 * 1024), "1.00 GB");
    }

    #[test]
    fn test_format_bytes_terabyte() {
        assert_eq!(format_bytes(1024u64 * 1024 * 1024 * 1024), "1.00 TB");
    }

    #[test]
    fn test_factory_reset_partial_files() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path();

        // Only some files exist
        let db_file = data_dir.join(DB_NAME);
        fs::write(&db_file, "db").unwrap();

        schedule_factory_reset(data_dir).expect("Failed to schedule reset");

        check_and_perform_reset(data_dir);

        assert!(!db_file.exists());
        assert!(!data_dir.join(MARKER_WIPE_NAME).exists());
    }

    #[test]
    fn test_restore_missing_staging() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path();

        let marker = data_dir.join(MARKER_RESTORE_NAME);
        fs::write(&marker, "pending").unwrap();

        // Staging file is missing
        check_and_perform_restore(data_dir);

        // Marker should be cleaned up if it exists but staging is gone
        assert!(!marker.exists());
    }

    #[test]
    fn test_restore_interrupted_state() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path();

        let target = data_dir.join(DB_NAME);
        let staging = data_dir.join(RESTORE_STAGING_NAME);

        fs::write(&target, "old").unwrap();
        fs::write(&staging, "new").unwrap();

        // Marker is ALREADY removed (simulating failure after marker removal but before rename)
        check_and_perform_restore(data_dir);

        // Target should still be "old" because marker was missing
        assert_eq!(fs::read_to_string(&target).unwrap(), "old");
        assert!(staging.exists());
    }

    #[test]
    fn test_factory_reset_failure_mid_execution() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path();

        // Create marker
        schedule_factory_reset(data_dir).expect("Failed to schedule reset");

        // Create targets
        let db_file = data_dir.join(DB_NAME);
        let store_file = data_dir.join("store.bin");

        fs::write(&db_file, "db").unwrap();
        // Simulate failure by making "store.bin" a DIRECTORY instead of a file
        // fs::remove_file() will fail on a directory.
        fs::create_dir(&store_file).unwrap();

        // Perform reset
        check_and_perform_reset(data_dir);

        // Marker should be gone (first step)
        assert!(!data_dir.join(MARKER_WIPE_NAME).exists());
        // db_file should be gone (first target)
        assert!(!db_file.exists());
        // store_file (the directory) should STILL EXIST because remove_file failed
        assert!(store_file.exists());
        assert!(store_file.is_dir());
    }

    #[test]
    fn test_restore_failure_on_rename() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path();

        let marker = data_dir.join(MARKER_RESTORE_NAME);
        let staging = data_dir.join(RESTORE_STAGING_NAME);
        let target = data_dir.join(DB_NAME);

        fs::write(&marker, "pending").unwrap();
        fs::write(&staging, "new_db").unwrap();

        // Simulate failure: make 'target' a non-empty directory
        // In some OS, rename of file to a directory might fail.
        fs::create_dir(&target).unwrap();
        fs::write(target.join("blocked.txt"), "blocking rename").unwrap();

        // Perform restore
        check_and_perform_restore(data_dir);

        // Marker should be removed (first step)
        assert!(!marker.exists());
        // Staging file should STILL exist (because rename failed)
        assert!(staging.exists());
        // Target should still be a directory
        assert!(target.is_dir());
    }
}
