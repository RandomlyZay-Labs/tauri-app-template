use crate::services::log_service;
use std::path::PathBuf;
use tauri::{Runtime, plugin::TauriPlugin};
use tauri_plugin_log::{Builder, Target, TargetKind};

pub fn init<R: Runtime>(
    custom_data_dir: Option<&PathBuf>,
    folder_name: &str,
) -> (PathBuf, TauriPlugin<R>) {
    // 1. Resolve log directory
    let log_dir = resolve_log_dir(custom_data_dir, folder_name);

    // 2. Rotate and prune logs before initializing the plugin to prevent file locks
    if let Some(ref dir) = log_dir {
        log_service::rotate_log(dir);
        log_service::prune_logs(dir, 10);
    }

    let app_state_log_dir = log_dir.unwrap_or_default();

    let root_data_dir = custom_data_dir.cloned().unwrap_or_else(|| {
        crate::util::resolve_os_app_data_dir().join(folder_name)
    });
    
    let level = crate::setup::log_config::read_log_level(&root_data_dir);

    // 3. Configure Plugin
    let target = if let Some(path) = custom_data_dir {
        // If custom data dir, put logs in a subdirectory there
        Target::new(TargetKind::Folder {
            path: path.join("logs"),
            file_name: Some("latest".to_string()),
        })
    } else {
        // Otherwise use standard system log directory
        Target::new(TargetKind::LogDir {
            file_name: Some("latest".to_string()),
        })
    };

    let builder = Builder::new().targets([target]).level(level);

    (app_state_log_dir, builder.build())
}

fn resolve_log_dir(custom_data_dir: Option<&PathBuf>, folder_name: &str) -> Option<PathBuf> {
    if let Some(path) = custom_data_dir {
        return Some(path.join("logs"));
    }

    use directories::BaseDirs;
    if let Some(base_dirs) = BaseDirs::new() {
        let log_dir = if cfg!(target_os = "macos") {
            base_dirs.home_dir().join("Library/Logs").join(folder_name)
        } else {
            // Windows, Linux, and others
            base_dirs.data_local_dir().join(folder_name).join("logs")
        };
        return Some(log_dir);
    }
    None
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_resolve_log_dir_custom() {
        let custom_dir = PathBuf::from("/tmp/custom_data");
        let log_dir = resolve_log_dir(Some(&custom_dir), "myapp");
        assert_eq!(log_dir, Some(custom_dir.join("logs")));
    }

    #[test]
    fn test_resolve_log_dir_default() {
        let log_dir = resolve_log_dir(None, "myapp");
        assert!(log_dir.is_some());
        let path = log_dir.unwrap();
        assert!(path.to_string_lossy().contains("myapp"));
        if cfg!(target_os = "macos") {
            assert!(path.to_string_lossy().contains("Library/Logs"));
        } else if !cfg!(windows) {
            // Linux/Unix
            assert!(path.to_string_lossy().contains("logs"));
        }
    }

    #[test]
    fn test_init_triggers_rotation_and_pruning() {
        let tmp = tempfile::tempdir().unwrap();
        let custom_dir = tmp.path().to_path_buf();
        let log_dir = custom_dir.join("logs");
        std::fs::create_dir_all(&log_dir).unwrap();

        // 1. Create an existing 'latest.log' to be rotated
        let latest_log = log_dir.join("latest.log");
        std::fs::write(&latest_log, "previous session log").unwrap();

        // 2. Create multiple old logs to trigger pruning (limit is 10)
        for i in 0..15 {
            let log_name = format!("2024-01-{:02}_10-00-00.log", i + 1);
            std::fs::write(log_dir.join(log_name), "old log").unwrap();
        }

        assert_eq!(std::fs::read_dir(&log_dir).unwrap().count(), 16); // 1 latest + 15 old

        // 3. Call init
        let (returned_log_dir, _plugin) = init::<tauri::Wry>(Some(&custom_dir), "myapp");

        assert_eq!(returned_log_dir, log_dir);

        // 4. Verify rotation: 'latest.log' should be gone (renamed)
        assert!(!latest_log.exists());

        // 5. Verify pruning: should have at most 10 timestamped logs + the one just rotated
        // Total should be around 11 (10 oldest kept + 1 newly rotated)
        let file_count = std::fs::read_dir(&log_dir).unwrap().count();
        assert!(file_count <= 11, "Expected around 11 log files, found {}", file_count);
    }

    #[test]
    fn test_init_no_custom_dir() {
        // This test mostly ensures it doesn't panic and returns a sensible path
        let (log_dir, _plugin) = init::<tauri::Wry>(None, "myapp");
        assert!(!log_dir.to_string_lossy().is_empty());
        assert!(log_dir.to_string_lossy().contains("myapp"));
    }
}
