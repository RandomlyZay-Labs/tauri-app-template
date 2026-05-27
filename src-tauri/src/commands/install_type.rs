use crate::error::{CResult, Error as CError};

#[tauri::command]
#[specta::specta]
pub fn get_install_type() -> CResult<String> {
    #[cfg(target_os = "windows")]
    {
        Ok("nsis".to_string())
    }
    
    #[cfg(target_os = "linux")]
    {
        if std::env::var("APPIMAGE").is_ok() {
            Ok("appimage".to_string())
        } else {
            let exe_path = std::env::current_exe().map_err(CError::from)?;
            let path_str = exe_path.to_string_lossy();
            if path_str.starts_with("/usr") {
                let is_deb = match std::process::Command::new("dpkg")
                    .args(["-S", &path_str])
                    .output()
                {
                    Ok(out) => out.status.success(),
                    Err(err) if err.kind() == std::io::ErrorKind::NotFound => false,
                    Err(err) => return Err(CError::from(err)),
                };
                if is_deb {
                    return Ok("deb".to_string());
                }
                
                let is_rpm = match std::process::Command::new("rpm")
                    .args(["-qf", &path_str])
                    .output()
                {
                    Ok(out) => out.status.success(),
                    Err(err) if err.kind() == std::io::ErrorKind::NotFound => false,
                    Err(err) => return Err(CError::from(err)),
                };
                if is_rpm {
                    return Ok("rpm".to_string());
                }
            }
            Ok("unknown".to_string())
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        Ok("unknown".to_string())
    }
}
