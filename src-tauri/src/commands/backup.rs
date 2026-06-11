// SPDX-License-Identifier: MIT
use crate::error::CResult;
use crate::services::backup_service::{self, BackupMetadata};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn create_backup(
    state: State<'_, AppState>,
    label: Option<String>,
    is_manual: Option<bool>,
) -> CResult<BackupMetadata> {
    log::debug!("[Command] create_backup called with label: {:?}, is_manual: {:?}", label, is_manual);
    let data_dir = state
        .app_data_dir
        .as_ref()
        .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
    backup_service::create_backup(&state.db, data_dir, label, is_manual).await
}

#[tauri::command]
#[specta::specta]
pub async fn list_backups(state: State<'_, AppState>) -> CResult<Vec<BackupMetadata>> {
    let data_dir = state
        .app_data_dir
        .as_ref()
        .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
    backup_service::list_backups(data_dir).await
}

#[tauri::command]
#[specta::specta]
pub async fn restore_backup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    backup_id: String,
) -> CResult<()> {
    log::debug!(
        "[Command] restore_backup called with backup_id: {}",
        backup_id
    );
    let data_dir = state
        .app_data_dir
        .as_ref()
        .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
    backup_service::prepare_restore(data_dir, backup_id).await?;

    app.restart();
}

#[tauri::command]
#[specta::specta]
pub async fn prune_backups(state: State<'_, AppState>, max_backups: u32) -> CResult<u32> {
    let data_dir = state
        .app_data_dir
        .as_ref()
        .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
    let count = backup_service::prune_backups(data_dir, max_backups).await?;
    Ok(count as u32)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_backup(state: State<'_, AppState>, backup_id: String) -> CResult<()> {
    let data_dir = state
        .app_data_dir
        .as_ref()
        .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
    backup_service::delete_backup(data_dir, backup_id).await
}
