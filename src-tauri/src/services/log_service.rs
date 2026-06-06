use std::path::Path;

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
        obj.insert(
            "logLevel".to_string(),
            serde_json::Value::String(level.to_string()),
        );
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
    use std::fs;

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
}
