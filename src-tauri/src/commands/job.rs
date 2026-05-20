use crate::error::CResult;
use crate::services::job_service::JobRow;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn list_jobs(
    state: State<'_, AppState>,
    status_filter: Option<String>,
) -> CResult<Vec<JobRow>> {
    state.job_manager.list_jobs(status_filter.as_deref()).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_job(state: State<'_, AppState>, job_id: String) -> CResult<JobRow> {
    state.job_manager.get_job(&job_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_job(state: State<'_, AppState>, job_id: String) -> CResult<()> {
    state.job_manager.cancel_job(&job_id).await
}
