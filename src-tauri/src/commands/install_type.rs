#[tauri::command]
#[specta::specta]
pub fn get_install_type() -> String {
    #[cfg(target_os = "windows")]
    {
        "nsis".to_string()
    }
    
    #[cfg(target_os = "linux")]
    {
        if std::env::var("APPIMAGE").is_ok() {
            "appimage".to_string()
        } else if let Ok(exe_path) = std::env::current_exe() {
            let path_str = exe_path.to_string_lossy();
            if path_str.starts_with("/usr") {
                if std::process::Command::new("dpkg")
                    .args(["-S", &path_str])
                    .output()
                    .map(|out| out.status.success())
                    .unwrap_or(false)
                {
                    return "deb".to_string();
                }
                
                if std::process::Command::new("rpm")
                    .args(["-qf", &path_str])
                    .output()
                    .map(|out| out.status.success())
                    .unwrap_or(false)
                {
                    return "rpm".to_string();
                }
            }
            "unknown".to_string()
        } else {
            "unknown".to_string()
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        "unknown".to_string()
    }
}
