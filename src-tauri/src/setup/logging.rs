// SPDX-License-Identifier: MIT
use chrono::{DateTime, Local, NaiveDateTime};
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tauri::{Runtime, plugin::TauriPlugin};
use tauri_plugin_log::{Builder, Target, TargetKind};

pub fn init<R: Runtime>(app_data_dir: &Path, app_log_dir: &Path) -> TauriPlugin<R> {
    // 1. Rotate previous session log
    rotate_log(app_log_dir);

    // 2. Prune old logs
    prune_logs(app_log_dir, 10);

    // 3. Configure Plugin
    let target = Target::new(TargetKind::Folder {
        path: app_log_dir.to_path_buf(),
        file_name: Some("latest".to_string()),
    });

    // 4. Read log level from config
    let level = crate::setup::log_config::read_log_level(app_data_dir);

    // We don't need tauri_plugin_log's RotationStrategy because we are handling it manually on startup.
    Builder::new().targets([target]).level(level).build()
}

/// Rotates the `latest.log` file to a timestamped file.
fn rotate_log(log_dir: &Path) {
    if !log_dir.exists() {
        let _ = fs::create_dir_all(log_dir);
        return;
    }

    let current_log_path = log_dir.join("latest.log");
    if current_log_path.exists() {
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

        let _ = fs::rename(&current_log_path, &new_path);
    }
}

/// Prunes old log files, keeping only the most recent `max_files`.
fn prune_logs(log_dir: &Path, max_files: usize) {
    if !log_dir.exists() {
        return;
    }

    let mut log_files = Vec::new();
    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                if file_name == "latest.log"
                    || path.extension().and_then(|s| s.to_str()) != Some("log")
                {
                    continue;
                }

                if let Some(parsed_ts) = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .and_then(|stem| NaiveDateTime::parse_from_str(stem, "%Y-%m-%d_%H-%M-%S").ok())
                {
                    let modified_time = fs::metadata(&path).and_then(|m| m.modified()).ok();
                    log_files.push((path, modified_time, parsed_ts));
                }
            }
        }
    }

    log_files.sort_by(|(path_a, time_a, parsed_a), (path_b, time_b, parsed_b)| {
        time_b
            .cmp(time_a)
            .then_with(|| parsed_b.cmp(parsed_a))
            .then_with(|| path_b.cmp(path_a))
    });

    if log_files.len() > max_files {
        for (path, _, _) in log_files.iter().skip(max_files) {
            let _ = fs::remove_file(path);
        }
    }
}
