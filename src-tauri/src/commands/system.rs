use crate::error::CResult;
use crate::state::AppState;
use crate::util;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
#[specta::specta]
pub async fn get_log_path(state: State<'_, AppState>) -> CResult<String> {
    Ok(state.log_dir.to_string_lossy().to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn export_diagnostics(app: tauri::AppHandle, state: State<'_, AppState>) -> CResult<bool> {
    log::debug!("[Command] export_diagnostics called");
    
    let log_path = state.log_dir.join("latest.log");
    let log_content = tokio::fs::read_to_string(&log_path).await.ok();

    let output = generate_diagnostics_string(
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        std::env::consts::ARCH,
        state.app_data_dir.as_ref().map(|d| d.to_string_lossy().to_string()).as_deref(),
        log_content.as_deref(),
    );

    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("Text", &["txt", "log"])
        .set_file_name("diagnostics.txt")
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    let file_path = rx.await.map_err(|_| crate::error::Error::Unknown("Dialog channel closed".into()))?;

    if let Some(path) = file_path {
        tokio::fs::write(path.into_path().map_err(|e| crate::error::Error::Io(e.to_string()))?, output)
            .await
            .map_err(|e| crate::error::Error::Io(e.to_string()))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn generate_diagnostics_string(
    version: &str,
    os: &str,
    arch: &str,
    data_dir: Option<&str>,
    log_content: Option<&str>,
) -> String {
    let mut output = String::new();
    output.push_str("=== Diagnostics ===\n");
    output.push_str(&format!("App Version: {}\n", version));
    output.push_str(&format!("OS: {} ({})\n", os, arch));
    output.push_str(&format!("Data Directory: {}\n", data_dir.unwrap_or_default()));
    output.push_str("\n=== Log ===\n");
    output.push_str(log_content.unwrap_or("No log file found."));
    output
}

#[tauri::command]
#[specta::specta]
pub async fn get_data_dir(state: State<'_, AppState>) -> CResult<Option<String>> {
    Ok(state
        .app_data_dir
        .as_ref()
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn open_log_dir(app: tauri::AppHandle, state: State<'_, AppState>) -> CResult<()> {
    let path = state.log_dir.to_string_lossy().to_string();
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| crate::error::Error::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn open_data_dir(app: tauri::AppHandle, state: State<'_, AppState>) -> CResult<()> {
    let data_dir = if let Some(custom) = &state.app_data_dir {
        custom.clone()
    } else {
        util::resolve_os_app_data_dir().join(util::DATA_FOLDER_NAME)
    };
    app.opener()
        .open_path(data_dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| crate::error::Error::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn reset_application(state: State<'_, AppState>) -> CResult<()> {
    log::debug!("[Command] reset_application called");
    
    let data_dir = if let Some(custom) = &state.app_data_dir {
        custom.clone()
    } else {
        util::resolve_os_app_data_dir().join(util::DATA_FOLDER_NAME)
    };
    util::schedule_factory_reset(&data_dir)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn set_log_level(state: State<'_, AppState>, level: String) -> CResult<()> {
    log::debug!("[Command] set_log_level called with level: {}", level);

    if !["debug", "info"].contains(&level.as_str()) {
        return Err(crate::error::Error::Validation("Invalid log level".into()));
    }

    let data_dir = if let Some(custom) = &state.app_data_dir {
        custom.clone()
    } else {
        util::resolve_os_app_data_dir().join(util::DATA_FOLDER_NAME)
    };

    crate::services::log_service::update_config_log_level(&data_dir, &level).await
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_diagnostics_string() {
        let output = generate_diagnostics_string("1.0.0", "linux", "x86_64", Some("/data/dir"), Some("app log content"));
        assert!(output.contains("=== Diagnostics ==="));
        assert!(output.contains("App Version: 1.0.0"));
        assert!(output.contains("OS: linux (x86_64)"));
        assert!(output.contains("Data Directory: /data/dir"));
        assert!(output.contains("=== Log ==="));
        assert!(output.contains("app log content"));
    }

    #[test]
    fn test_generate_diagnostics_string_no_log() {
        let output = generate_diagnostics_string("1.0.0", "linux", "x86_64", None, None);
        assert!(output.contains("Data Directory: "));
        assert!(output.contains("No log file found."));
    }}


#[tauri::command]
#[specta::specta]
pub async fn get_version() -> CResult<String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}
