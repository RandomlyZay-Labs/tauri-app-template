// SPDX-License-Identifier: MIT
use serde_json::Value;
use std::path::Path;
use tauri_plugin_log::log::LevelFilter;

pub fn read_log_level(data_dir: &Path) -> LevelFilter {
    let config_path = data_dir.join("config.json");

    // Default level if we can't parse or find it
    let default_level = LevelFilter::Error;

    if config_path.exists()
        && let Ok(content) = std::fs::read_to_string(&config_path)
        && let Ok(json) = serde_json::from_str::<Value>(&content)
        && let Some(level_str) = json.get("logLevel").and_then(|v| v.as_str())
    {
        return match level_str.to_lowercase().as_str() {
            "trace" => LevelFilter::Trace,
            "debug" => LevelFilter::Debug,
            "info" => LevelFilter::Info,
            "warn" => LevelFilter::Warn,
            "error" => LevelFilter::Error,
            _ => default_level,
        };
    }

    default_level
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_read_log_level_default() {
        let tmp = tempdir().unwrap();
        let level = read_log_level(tmp.path());
        assert_eq!(level, LevelFilter::Error);
    }

    #[test]
    fn test_read_log_level_valid() {
        let tmp = tempdir().unwrap();
        let config_path = tmp.path().join("config.json");
        fs::write(&config_path, r#"{"logLevel": "debug"}"#).unwrap();

        let level = read_log_level(tmp.path());
        assert_eq!(level, LevelFilter::Debug);
    }

    #[test]
    fn test_read_log_level_invalid() {
        let tmp = tempdir().unwrap();
        let config_path = tmp.path().join("config.json");
        fs::write(&config_path, r#"{"logLevel": "invalid"}"#).unwrap();

        let level = read_log_level(tmp.path());
        assert_eq!(level, LevelFilter::Error);
    }

    #[test]
    fn test_read_log_level_malformed_json() {
        let tmp = tempdir().unwrap();
        let config_path = tmp.path().join("config.json");
        fs::write(&config_path, r#"{"logLevel": "#).unwrap();

        let level = read_log_level(tmp.path());
        assert_eq!(level, LevelFilter::Error);
    }
}
