use crate::error::CResult;
use crate::services::download_service::{DownloadRequest, DownloadResult};
use crate::state::AppState;
use tauri::State;
use std::sync::Arc;
use crate::services::events::AppEmitter;

#[tauri::command]
#[specta::specta]
pub async fn start_download(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: DownloadRequest,
) -> CResult<DownloadResult> {
    log::debug!("[Command] start_download called with url: {}", request.url);
    state.download_manager.start_download(Arc::new(app) as Arc<dyn AppEmitter>, request).await
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_download(state: State<'_, AppState>, download_id: String) -> CResult<()> {
    log::debug!("[Command] cancel_download called for download_id: {}", download_id);
    state.download_manager.cancel_download(&download_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn list_active_downloads(state: State<'_, AppState>) -> CResult<Vec<String>> {
    Ok(state.download_manager.list_active().await)
}
