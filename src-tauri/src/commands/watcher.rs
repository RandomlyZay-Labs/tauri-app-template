use crate::error::CResult;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn watch_path(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> CResult<()> {
    log::debug!("[Command] watch_path called for path: {}", path);

    state
        .watcher_manager
        .watch(app, path)
        .map_err(crate::error::Error::Validation)
}

#[tauri::command]
#[specta::specta]
pub async fn unwatch_path(state: State<'_, AppState>, path: String) -> CResult<()> {
    log::debug!("[Command] unwatch_path called for path: {}", path);
    state
        .watcher_manager
        .unwatch(path)
        .map_err(crate::error::Error::Unknown)
}
