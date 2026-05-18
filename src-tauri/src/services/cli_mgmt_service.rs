use crate::error::{CResult, Error};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CliStatus {
    pub installed: bool,
    pub version: Option<String>,
}

pub struct CliMgmtService;

impl CliMgmtService {
    pub fn get_cli_path() -> CResult<PathBuf> {
        #[cfg(windows)]
        {
            let local_app_data = dirs::data_local_dir().ok_or_else(|| Error::Unknown("Could not find LocalAppData directory".into()))?;
            Ok(local_app_data.join("tauri-app-template").join("bin").join("tauri-app-template-cli.exe"))
        }
        
        #[cfg(not(windows))]
        {
            let home = dirs::home_dir().ok_or_else(|| Error::Unknown("Could not find home directory".into()))?;
            Ok(home.join(".local").join("bin").join("tauri-app-template-cli"))
        }
    }

    pub fn get_cli_status() -> CResult<CliStatus> {
        let path = Self::get_cli_path()?;
        
        if !path.is_file() {
            return Ok(CliStatus {
                installed: false,
                version: None,
            });
        }

        // Try to run the CLI to get its version
        let output = Command::new(&path)
            .arg("--version")
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let version_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                // Expecting "tauri-app-template-cli 0.1.0" or similar
                let version = version_str.split_whitespace().last().map(|v| v.to_string());
                Ok(CliStatus {
                    installed: true,
                    version,
                })
            }
            _ => {
                // If it fails to run, we treat it as installed but unknown version
                Ok(CliStatus {
                    installed: path.is_file(),
                    version: None,
                })
            }
        }
    }

    pub async fn install_cli(app_handle: AppHandle) -> CResult<()> {
        let version = app_handle.package_info().version.to_string();
        let target_path = Self::get_cli_path()?;
        let target_dir = target_path.parent().ok_or_else(|| Error::Unknown("Invalid CLI path".into()))?;

        // 1. Determine download URL
        let os = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        let (os_name, arch_name, ext) = match (os, arch) {
            ("windows", "x86_64") => ("windows", "x64", ".exe"),
            ("windows", "aarch64") => ("windows", "arm64", ".exe"),
            ("linux", "x86_64") => ("linux", "amd64", ""),
            ("linux", "aarch64") => ("linux", "arm64", ""),
            _ => return Err(Error::Unknown(format!("Unsupported platform: {}-{}", os, arch))),
        };

        let binary_name = format!("tauri-app-template-cli-{}-{}{}", os_name, arch_name, ext);
        let url = format!(
            "https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v{}/{}",
            version, binary_name
        );

        log::info!("[CliMgmtService] Downloading CLI from {}", url);

        // 2. Download the binary
        let response = reqwest::get(&url).await.map_err(|e| Error::Unknown(format!("Download failed: {}", e)))?;
        if !response.status().is_success() {
            return Err(Error::Unknown(format!("Download failed with status: {}", response.status())));
        }

        let bytes = response.bytes().await.map_err(|e| Error::Unknown(format!("Failed to read response: {}", e)))?;

        // 3. Ensure target directory exists
        std::fs::create_dir_all(target_dir).map_err(|e| Error::Io(e.to_string()))?;

        // 4. Verify checksum
        let sha256_url = format!("{}.sha256", url);
        log::info!("[CliMgmtService] Downloading SHA-256 checksum from {}", sha256_url);
        let sha_response = reqwest::get(&sha256_url).await.map_err(|e| Error::Unknown(format!("Checksum download failed: {}", e)))?;
        if !sha_response.status().is_success() {
            return Err(Error::Unknown(format!("Checksum download failed with status: {}", sha_response.status())));
        }
        let sha_text = sha_response.text().await.map_err(|e| Error::Unknown(format!("Failed to read checksum response: {}", e)))?;
        let expected_sha = sha_text.split_whitespace().next().ok_or_else(|| Error::Unknown("Empty checksum file".into()))?.to_lowercase();

        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let hash_result = hasher.finalize();
        let computed_sha = hash_result.iter().map(|b| format!("{:02x}", b)).collect::<String>();

        let mut tmp_path = target_path.clone();
        tmp_path.set_extension("download");

        if computed_sha != expected_sha {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(Error::Unknown(format!(
                "Integrity check failed: checksum mismatch. Expected: {}, Computed: {}",
                expected_sha, computed_sha
            )));
        }

        // 5. Write to temp file first then rename
        if let Err(e) = std::fs::write(&tmp_path, bytes) {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(Error::Io(e.to_string()));
        }
        if let Err(e) = std::fs::rename(&tmp_path, &target_path) {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(Error::Io(e.to_string()));
        }

        // 5. Set executable permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&target_path).map_err(|e| Error::Io(e.to_string()))?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&target_path, perms).map_err(|e| Error::Io(e.to_string()))?;
        }

        // 6. Update PATH
        Self::ensure_in_path(target_dir)?;

        log::info!("[CliMgmtService] CLI installed successfully to {}", target_path.display());
        Ok(())
    }

    fn ensure_in_path(target_dir: &std::path::Path) -> CResult<()> {
        #[cfg(windows)]
        {
            let dir_str = target_dir.to_str().ok_or_else(|| Error::Unknown("Invalid path".into()))?;
            let dir_str_escaped = dir_str.replace('\'', "''");
            let script = format!(
                r#"$oldPath = [Environment]::GetEnvironmentVariable("Path", "User"); if ($oldPath -split ';' -notcontains '{}') {{ [Environment]::SetEnvironmentVariable("Path", $oldPath + ";{}", "User") }}"#,
                dir_str_escaped, dir_str_escaped
            );
            
            let output = Command::new("powershell")
                .arg("-Command")
                .arg(script)
                .output()
                .map_err(|e| Error::Unknown(format!("Failed to run PowerShell process: {}", e)))?;

            if !output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(Error::Unknown(format!(
                    "PowerShell script failed with exit code: {:?}. stdout: {}, stderr: {}",
                    output.status.code(), stdout, stderr
                )));
            }
        }

        #[cfg(unix)]
        {
            // For Unix, we check if the directory is in PATH. If not, we log a warning.
            // Automatically modifying .bashrc/.zshrc is risky, but we can try to be helpful.
            let path_env = std::env::var("PATH").unwrap_or_default();
            let dir_str = target_dir.to_str().unwrap_or_default();
            
            if !path_env.split(':').any(|p| p == dir_str) {
                log::warn!("[CliMgmtService] {} is not in PATH. You may need to add 'export PATH=\"$PATH:{}\"' to your shell profile.", dir_str, dir_str);
            }
        }

        Ok(())
    }
}
