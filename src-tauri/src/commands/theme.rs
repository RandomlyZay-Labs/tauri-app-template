use crate::error::CResult;
use crate::services::theme_service;

/// Returns the system color-scheme preference on Linux via the Freedesktop portal.
/// Returns "dark", "light", or "no-preference".
/// On non-Linux platforms this always returns `null` (frontend should rely on matchMedia).
#[tauri::command]
#[specta::specta]
pub async fn get_system_theme() -> CResult<Option<String>> {
    if cfg!(target_os = "linux") {
        Ok(theme_service::query_freedesktop_color_scheme().map(|s| s.as_str().to_string()))
    } else {
        Ok(None)
    }
}
