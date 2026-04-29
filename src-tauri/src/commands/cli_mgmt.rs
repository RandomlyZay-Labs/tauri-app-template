// SPDX-License-Identifier: MIT
use crate::error::CResult;
use crate::services::cli_mgmt_service::{CliMgmtService, CliStatus};
use tauri::AppHandle;

#[tauri::command]
#[specta::specta]
pub async fn get_cli_status() -> CResult<CliStatus> {
    log::debug!("[Command] get_cli_status called");
    CliMgmtService::get_cli_status()
}

#[tauri::command]
#[specta::specta]
pub async fn install_cli(app_handle: AppHandle) -> CResult<()> {
    log::debug!("[Command] install_cli called");
    CliMgmtService::install_cli(app_handle).await
}
