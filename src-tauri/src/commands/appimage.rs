use crate::error::CResult;

#[tauri::command]
#[specta::specta]
pub async fn is_appimage() -> bool {
    crate::services::appimage_service::is_appimage()
}

#[tauri::command]
#[specta::specta]
pub async fn integrate_appimage() -> CResult<()> {
    log::debug!("[Command] integrate_appimage called");
    crate::services::appimage_service::integrate_appimage()
}
