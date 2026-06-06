use crate::error::CResult;
use crate::services::security_service;

#[tauri::command]
#[specta::specta]
pub async fn set_secret(key: String, value: String) -> CResult<()> {
    if key.len() > 256 || value.len() > 4096 {
        return Err(crate::error::Error::Validation(
            "Secret key or value too long".into(),
        ));
    }
    security_service::set_secret(&key, &value)
}

#[tauri::command]
#[specta::specta]
pub async fn get_secret(key: String) -> CResult<String> {
    if key.len() > 256 {
        return Err(crate::error::Error::Validation(
            "Secret key too long".into(),
        ));
    }
    security_service::get_secret(&key)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_secret(key: String) -> CResult<()> {
    if key.len() > 256 {
        return Err(crate::error::Error::Validation(
            "Secret key too long".into(),
        ));
    }
    security_service::delete_secret(&key)
}
