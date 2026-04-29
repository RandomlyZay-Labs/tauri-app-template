use chrono::{DateTime, Local, NaiveDateTime};
use log::{error, info};
use std::fs;
use std::path::Path;
use std::time::SystemTime;

/// Rotates the `latest.log` file to a timestamped file.
/// This should be called BEFORE the logger is initialized to avoid file locking issues.
/// File format: `latest.log` -> `YYYY-MM-DD_HH-MM-SS.log`
pub fn rotate_log(log_dir: &Path) {
    if !log_dir.exists() {
        // If dir doesn't exist, just create it so logger can start happy
        let _ = fs::create_dir_all(log_dir);
        return;
    }

    let current_log_path = log_dir.join("latest.log");
    if current_log_path.exists() {
        // Try to get creation time, fallback to modification time, fallback to now
        let metadata = fs::metadata(&current_log_path).ok();
        let timestamp = metadata
            .as_ref()
            .and_then(|m| m.created().ok())
            .or_else(|| metadata.as_ref().and_then(|m| m.modified().ok()))
            .unwrap_or_else(SystemTime::now);

        let datetime: DateTime<Local> = timestamp.into();
        let formatted_time = datetime.format("%Y-%m-%d_%H-%M-%S");
        let new_name = format!("{}.log", formatted_time);
        let new_path = log_dir.join(new_name);

        // Rename logic
        if let Err(e) = fs::rename(&current_log_path, &new_path) {
            log::error!("Failed to rotate log file: {}", e);
        } else {
            log::info!("Rotated log file to {:?}", new_path);
        }
    }
}

/// Prunes old log files, keeping only the most recent `max_files`.
/// Matches files with the pattern `YYYY-MM-DD_HH-MM-SS.log`.
pub fn prune_logs(log_dir: &Path, max_files: usize) {
    if !log_dir.exists() {
        return;
    }

    // 1. List log files and cache metadata
    let mut log_files = Vec::new();
    match fs::read_dir(log_dir) {
        Ok(entries) => {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();

                // Ensure we are only looking at files
                if !path.is_file() {
                    continue;
                }

                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    // Ignore current session log
                    if file_name == "latest.log" {
                        continue;
                    }

                    // Verify extension is .log
                    if path.extension().and_then(|s| s.to_str()) != Some("log") {
                        continue;
                    }

                    // Strict validation: Try to parse the filename stem as a timestamp.
                    // This prevents deleting unrelated .log files that might share the directory.
                    if let Some(parsed_ts) =
                        path.file_stem().and_then(|s| s.to_str()).and_then(|stem| {
                            NaiveDateTime::parse_from_str(stem, "%Y-%m-%d_%H-%M-%S").ok()
                        })
                    {
                        // Optimization: Cache modification time to avoid repeated syscalls during sort
                        let modified_time = fs::metadata(&path).and_then(|m| m.modified()).ok();
                        log_files.push((path, modified_time, parsed_ts));
                    }
                }
            }
        }
        Err(e) => {
            error!("Failed to read log directory for pruning: {}", e);
            return;
        }
    }

    // 2. Sort files newest first (descending)
    log_files.sort_by(|(path_a, time_a, parsed_a), (path_b, time_b, parsed_b)| {
        time_b
            .cmp(time_a)
            .then_with(|| parsed_b.cmp(parsed_a))
            .then_with(|| path_b.cmp(path_a))
    });

    // 3. Delete excess files
    if log_files.len() > max_files {
        info!(
            "Pruning logs: found {} timestamped files, keeping {}.",
            log_files.len(),
            max_files
        );
        for (path, _, _) in log_files.iter().skip(max_files) {
            if let Err(e) = fs::remove_file(path) {
                error!("Failed to delete old log file {:?}: {}", path, e);
            } else {
                info!("Deleted old log file: {:?}", path.file_name());
            }
        }
    }
}

/// Updates the log level in the `config.json` file.
pub async fn update_config_log_level(data_dir: &Path, level: &str) -> crate::error::CResult<()> {
    let config_path = data_dir.join("config.json");

    let mut config = if tokio::fs::try_exists(&config_path).await.unwrap_or(false) {
        let content = tokio::fs::read_to_string(&config_path)
            .await
            .map_err(|e| crate::error::Error::Io(e.to_string()))?;
        serde_json::from_str::<serde_json::Value>(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let Some(obj) = config.as_object_mut() {
        obj.insert("logLevel".to_string(), serde_json::Value::String(level.to_string()));
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| crate::error::Error::Io(e.to_string()))?;

    // Ensure directory exists
    if !data_dir.exists() {
        tokio::fs::create_dir_all(data_dir)
            .await
            .map_err(|e| crate::error::Error::Io(e.to_string()))?;
    }

    tokio::fs::write(&config_path, content)
        .await
        .map_err(|e| crate::error::Error::Io(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    fn count_files(dir: &Path) -> usize {
        fs::read_dir(dir)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.path().is_file())
            .count()
    }

    // --- update_config_log_level tests ---

    #[tokio::test]
    async fn test_update_config_log_level_new_file() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let data_dir = tmp.path();

        update_config_log_level(data_dir, "debug").await.unwrap();

        let config_path = data_dir.join("config.json");
        assert!(config_path.exists());

        let content = fs::read_to_string(config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(json["logLevel"], "debug");
    }

    #[tokio::test]
    async fn test_update_config_log_level_existing_file() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let data_dir = tmp.path();
        let config_path = data_dir.join("config.json");

        fs::write(&config_path, r#"{"other": "value", "logLevel": "error"}"#).unwrap();

        update_config_log_level(data_dir, "info").await.unwrap();

        let content = fs::read_to_string(config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(json["logLevel"], "info");
        assert_eq!(json["other"], "value");
    }

    #[tokio::test]
    async fn test_update_config_log_level_malformed_json() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let data_dir = tmp.path();
        let config_path = data_dir.join("config.json");

        fs::write(&config_path, r#"{"logLevel": "#).unwrap();

        update_config_log_level(data_dir, "trace").await.unwrap();

        let content = fs::read_to_string(config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(json["logLevel"], "trace");
    }

    // --- rotate_log tests ---

    #[test]
    fn rotate_creates_dir_when_missing() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let log_dir = tmp.path().join("logs");
        assert!(!log_dir.exists());

        rotate_log(&log_dir);

        assert!(log_dir.exists(), "rotate_log should create log_dir");
    }

    #[test]
    fn rotate_noop_when_no_latest_log() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let log_dir = tmp.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        rotate_log(&log_dir);

        assert_eq!(count_files(&log_dir), 0, "no files should be created");
    }

    #[test]
    fn rotate_renames_latest_log_to_timestamped() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let log_dir = tmp.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        let latest = log_dir.join("latest.log");
        fs::write(&latest, "log contents here").unwrap();
        assert!(latest.exists());

        rotate_log(&log_dir);

        assert!(!latest.exists(), "latest.log should have been renamed");
        assert_eq!(count_files(&log_dir), 1, "exactly one timestamped file should exist");

        let entries: Vec<_> = fs::read_dir(&log_dir)
            .unwrap()
            .filter_map(Result::ok)
            .collect();
        let name = entries[0].file_name().to_string_lossy().to_string();
        assert!(name.ends_with(".log"));
        assert_ne!(name, "latest.log");

        // Verify the timestamped file has the original content
        let content = fs::read_to_string(entries[0].path()).unwrap();
        assert_eq!(content, "log contents here");
    }

    // --- prune_logs tests ---

    #[test]
    fn prune_noop_when_dir_missing() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let missing = tmp.path().join("nonexistent");

        // Should not panic
        prune_logs(&missing, 5);
    }

    #[test]
    fn prune_noop_when_under_limit() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let log_dir = tmp.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        fs::write(log_dir.join("2024-01-01_10-00-00.log"), "a").unwrap();
        fs::write(log_dir.join("2024-01-02_10-00-00.log"), "b").unwrap();

        prune_logs(&log_dir, 5);

        assert_eq!(count_files(&log_dir), 2, "no files should be deleted when under limit");
    }

    #[test]
    fn prune_keeps_newest_and_deletes_oldest() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let log_dir = tmp.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        let names = [
            "2024-01-01_10-00-00.log",
            "2024-01-02_10-00-00.log",
            "2024-01-03_10-00-00.log",
            "2024-01-04_10-00-00.log",
            "2024-01-05_10-00-00.log",
        ];

        for (i, name) in names.iter().enumerate() {
            fs::write(log_dir.join(name), format!("log {}", i)).unwrap();
            // Small delay so modification times are distinguishable
            thread::sleep(Duration::from_millis(15));
        }

        // Keep only 2
        prune_logs(&log_dir, 2);

        let remaining: Vec<String> = fs::read_dir(&log_dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();

        assert_eq!(remaining.len(), 2);
        // The two newest (by modification time) should survive
        assert!(remaining.contains(&"2024-01-04_10-00-00.log".to_string()));
        assert!(remaining.contains(&"2024-01-05_10-00-00.log".to_string()));
    }

    #[test]
    fn prune_ignores_latest_log_and_non_timestamped_files() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let log_dir = tmp.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        // Files that should be ignored by pruning
        fs::write(log_dir.join("latest.log"), "current session").unwrap();
        fs::write(log_dir.join("README.md"), "docs").unwrap();
        fs::write(log_dir.join("random-name.log"), "not timestamped").unwrap();

        // One valid timestamped file
        fs::write(log_dir.join("2024-06-15_12-30-00.log"), "valid").unwrap();

        // Prune to 0 — only the valid timestamped file should be deleted
        prune_logs(&log_dir, 0);

        let remaining: Vec<String> = fs::read_dir(&log_dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();

        assert_eq!(remaining.len(), 3);
        assert!(remaining.contains(&"latest.log".to_string()));
        assert!(remaining.contains(&"README.md".to_string()));
        assert!(remaining.contains(&"random-name.log".to_string()));
    }

    #[test]
    fn prune_exact_limit_deletes_nothing() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let log_dir = tmp.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        fs::write(log_dir.join("2024-01-01_10-00-00.log"), "a").unwrap();
        fs::write(log_dir.join("2024-01-02_10-00-00.log"), "b").unwrap();
        fs::write(log_dir.join("2024-01-03_10-00-00.log"), "c").unwrap();

        prune_logs(&log_dir, 3);

        assert_eq!(count_files(&log_dir), 3, "files at exact limit should be kept");
    }
}
