use crate::error::{CResult, Error};
use crate::state::AppState;
use crate::services::events::AppEmitter;
use crate::services::download_service::{DownloadRequest, ProgressCallback};
use crate::services::job_service::{JobKind, JobStatus, EmitJobProgressArgs, emit_job_progress};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CliStatus {
    pub installed: bool,
    pub version: Option<String>,
}

#[cfg(test)]
thread_local! {
    pub static TEST_CLI_PATH: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) };
}

pub struct CliMgmtService;

impl CliMgmtService {
    pub fn get_cli_path() -> CResult<PathBuf> {
        #[cfg(test)]
        {
            if let Some(path) = TEST_CLI_PATH.with(|p| p.borrow().clone()) {
                return Ok(path);
            }
        }

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
        use wait_timeout::ChildExt;
        use std::time::Duration;

        let child = Command::new(&path)
            .arg("--version")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn();

        let output = match child {
            Ok(mut child_proc) => {
                match child_proc.wait_timeout(Duration::from_secs(3)) {
                    Ok(Some(_status)) => child_proc.wait_with_output(),
                    Ok(None) => {
                        let _ = child_proc.kill();
                        let _ = child_proc.wait();
                        Err(std::io::Error::new(
                            std::io::ErrorKind::TimedOut,
                            "CLI process timed out",
                        ))
                    }
                    Err(e) => {
                        let _ = child_proc.kill();
                        let _ = child_proc.wait();
                        Err(e)
                    }
                }
            }
            Err(e) => Err(e),
        };

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

    pub async fn install_cli<R: tauri::Runtime>(app_handle: AppHandle<R>) -> CResult<()> {
        let state = app_handle.state::<AppState>();
        let download_manager = &state.download_manager;
        let job_manager = &state.job_manager;

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

        // Ensure target directory exists
        std::fs::create_dir_all(target_dir).map_err(|e| Error::Io(e.to_string()))?;

        // 2. Download the checksum using DownloadManager (runs instantly, so no need for database job tracking)
        let sha256_url = format!("{}.sha256", url);
        log::info!("[CliMgmtService] Downloading SHA-256 checksum from {}", sha256_url);
        let sha256_filename = format!("{}.sha256.download", binary_name);
        
        let sha_request = DownloadRequest {
            url: sha256_url,
            dest_dir: target_dir.to_string_lossy().to_string(),
            filename: Some(sha256_filename.clone()),
        };
        let emitter = Arc::new(app_handle.clone()) as Arc<dyn AppEmitter>;
        let sha_download_res = download_manager.start_download(Arc::clone(&emitter), sha_request).await?;
        let sha_path = std::path::Path::new(&sha_download_res.file_path);
        let sha_text = std::fs::read_to_string(sha_path).map_err(|e| Error::Io(e.to_string()))?;
        let _ = std::fs::remove_file(sha_path); // clean up checksum temp file
        let expected_sha = sha_text.split_whitespace().next().ok_or_else(|| Error::Unknown("Empty checksum file".into()))?.to_lowercase();

        // 3. Register the CLI Binary Download Job in the JobManager database
        let temp_filename = format!("{}.download", binary_name);
        let request = DownloadRequest {
            url: url.clone(),
            dest_dir: target_dir.to_string_lossy().to_string(),
            filename: Some(temp_filename.clone()),
        };
        let metadata_json = serde_json::to_string(&request).ok();
        let job = job_manager.create_job(JobKind::Download, metadata_json).await?;
        let job_id = job.id.clone();

        job_manager.update_status(&job_id, JobStatus::Running, Some(0.0), Some("Installing CLI...")).await.ok();
        emit_job_progress(
            &*emitter,
            EmitJobProgressArgs {
                job_id: &job_id,
                kind: &JobKind::Download,
                status: JobStatus::Running,
                percent: Some(0.0),
                speed_bps: None,
                eta_secs: None,
                message: Some("Installing CLI..."),
            },
        );

        // 4. Download binary using start_download_tracked, updating job progress in real-time
        let emitter_for_progress = Arc::clone(&emitter);
        let job_id_clone = job_id.clone();
        let on_progress = Some(Box::new(move |bytes: u64, total: Option<u64>, speed: Option<u64>, eta: Option<u64>| {
            let percent = total.and_then(|t| {
                if t > 0 {
                    Some((bytes as f64 / t as f64) * 100.0)
                } else {
                    None
                }
            });
            let msg = match total {
                Some(t) => format!(
                    "Downloading CLI {} / {}",
                    crate::util::format_bytes(bytes),
                    crate::util::format_bytes(t)
                ),
                None => format!("Downloading CLI {}", crate::util::format_bytes(bytes)),
            };
            emit_job_progress(
                &*emitter_for_progress,
                EmitJobProgressArgs {
                    job_id: &job_id_clone,
                    kind: &JobKind::Download,
                    status: JobStatus::Running,
                    percent,
                    speed_bps: speed,
                    eta_secs: eta,
                    message: Some(&msg),
                },
            );
        }) as ProgressCallback);

        let token = job_manager.register_token(&job_id).await;
        let download_result = download_manager.start_download_tracked(
            Arc::clone(&emitter),
            request,
            &token,
            on_progress,
        ).await;
        
        job_manager.unregister_token(&job_id).await;

        let tmp_path = target_dir.join(&temp_filename);

        match download_result {
            Ok(_) => {
                log::info!("[CliMgmtService] Download completed. Verifying checksum...");
                let file_bytes = match std::fs::read(&tmp_path) {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        let _ = std::fs::remove_file(&tmp_path);
                        let msg = format!("Failed to read temporary download file: {}", e);
                        job_manager.update_status(&job_id, JobStatus::Failed, None, Some(&msg)).await.ok();
                        emit_job_progress(
                            &*emitter,
                            EmitJobProgressArgs {
                                job_id: &job_id,
                                kind: &JobKind::Download,
                                status: JobStatus::Failed,
                                percent: None,
                                speed_bps: None,
                                eta_secs: None,
                                message: Some(&msg),
                            },
                        );
                        return Err(Error::Io(e.to_string()));
                    }
                };

                use sha2::{Sha256, Digest};
                let mut hasher = Sha256::new();
                hasher.update(&file_bytes);
                let hash_result = hasher.finalize();
                let computed_sha = hash_result.iter().map(|b| format!("{:02x}", b)).collect::<String>();

                if computed_sha != expected_sha {
                    let _ = std::fs::remove_file(&tmp_path);
                    let msg = "Integrity check failed: checksum mismatch".to_string();
                    job_manager.update_status(&job_id, JobStatus::Failed, None, Some(&msg)).await.ok();
                    emit_job_progress(
                        &*emitter,
                        EmitJobProgressArgs {
                            job_id: &job_id,
                            kind: &JobKind::Download,
                            status: JobStatus::Failed,
                            percent: None,
                            speed_bps: None,
                            eta_secs: None,
                            message: Some(&msg),
                        },
                    );
                    return Err(Error::Unknown(format!(
                        "Integrity check failed: checksum mismatch. Expected: {}, Computed: {}",
                        expected_sha, computed_sha
                    )));
                }

                // 5. Write/Rename to target path
                if let Err(e) = std::fs::rename(&tmp_path, &target_path) {
                    let is_already_exists = e.kind() == std::io::ErrorKind::AlreadyExists || target_path.exists();
                    let mut retry_success = false;
                    let mut secondary_error = None;

                    if is_already_exists {
                        if let Err(rm_err) = std::fs::remove_file(&target_path) {
                            secondary_error = Some(format!("Failed to remove existing target file: {}", rm_err));
                        } else if let Err(rename_err) = std::fs::rename(&tmp_path, &target_path) {
                            secondary_error = Some(format!("Failed to rename binary on retry: {}", rename_err));
                        } else {
                            retry_success = true;
                        }
                    }

                    if !retry_success {
                        let _ = std::fs::remove_file(&tmp_path);
                        let msg = if let Some(sec_err) = secondary_error {
                            format!("Failed to rename binary: {}. Secondary error: {}", e, sec_err)
                        } else {
                            format!("Failed to rename binary: {}", e)
                        };
                        job_manager.update_status(&job_id, JobStatus::Failed, None, Some(&msg)).await.ok();
                        emit_job_progress(
                            &*emitter,
                            EmitJobProgressArgs {
                                job_id: &job_id,
                                kind: &JobKind::Download,
                                status: JobStatus::Failed,
                                percent: None,
                                speed_bps: None,
                                eta_secs: None,
                                message: Some(&msg),
                            },
                        );
                        return Err(Error::Io(msg));
                    }
                }

                // 5b. Set executable permissions on Unix
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let metadata = match std::fs::metadata(&target_path) {
                        Ok(m) => m,
                        Err(e) => {
                            let msg = format!("Failed to read metadata: {}", e);
                            job_manager.update_status(&job_id, JobStatus::Failed, None, Some(&msg)).await.ok();
                            emit_job_progress(
                                &*emitter,
                                EmitJobProgressArgs {
                                    job_id: &job_id,
                                    kind: &JobKind::Download,
                                    status: JobStatus::Failed,
                                    percent: None,
                                    speed_bps: None,
                                    eta_secs: None,
                                    message: Some(&msg),
                                },
                            );
                            return Err(Error::Io(e.to_string()));
                        }
                    };
                    let mut perms = metadata.permissions();
                    perms.set_mode(0o755);
                    if let Err(e) = std::fs::set_permissions(&target_path, perms) {
                        let msg = format!("Failed to set permissions: {}", e);
                        job_manager.update_status(&job_id, JobStatus::Failed, None, Some(&msg)).await.ok();
                        emit_job_progress(
                            &*emitter,
                            EmitJobProgressArgs {
                                job_id: &job_id,
                                kind: &JobKind::Download,
                                status: JobStatus::Failed,
                                percent: None,
                                speed_bps: None,
                                eta_secs: None,
                                message: Some(&msg),
                            },
                        );
                        return Err(Error::Io(e.to_string()));
                    }
                }

                // 6. Update PATH
                if let Err(e) = Self::ensure_in_path(target_dir) {
                    let msg = format!("Failed to configure PATH: {}", e);
                    job_manager.update_status(&job_id, JobStatus::Failed, None, Some(&msg)).await.ok();
                    emit_job_progress(
                        &*emitter,
                        EmitJobProgressArgs {
                            job_id: &job_id,
                            kind: &JobKind::Download,
                            status: JobStatus::Failed,
                            percent: None,
                            speed_bps: None,
                            eta_secs: None,
                            message: Some(&msg),
                        },
                    );
                    return Err(e);
                }

                log::info!("[CliMgmtService] CLI installed successfully to {}", target_path.display());
                job_manager.update_status(
                    &job_id,
                    JobStatus::Completed,
                    Some(100.0),
                    Some("CLI installed successfully"),
                ).await.ok();
                emit_job_progress(
                    &*emitter,
                    EmitJobProgressArgs {
                        job_id: &job_id,
                        kind: &JobKind::Download,
                        status: JobStatus::Completed,
                        percent: Some(100.0),
                        speed_bps: None,
                        eta_secs: None,
                        message: Some("CLI installed successfully"),
                    },
                );

                Ok(())
            }
            Err(e) => {
                let _ = std::fs::remove_file(&tmp_path);
                let (status, msg) = if token.is_cancelled() {
                    (JobStatus::Cancelled, "Cancelled by user".to_string())
                } else {
                    (JobStatus::Failed, e.to_string())
                };

                job_manager.update_status(&job_id, status.clone(), None, Some(&msg)).await.ok();
                emit_job_progress(
                    &*emitter,
                    EmitJobProgressArgs {
                        job_id: &job_id,
                        kind: &JobKind::Download,
                        status,
                        percent: None,
                        speed_bps: None,
                        eta_secs: None,
                        message: Some(&msg),
                    },
                );

                Err(e)
            }
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use crate::state::TraySettings;
    use crate::services::io::RealFileSystem;
    use crate::services::download_service::DownloadManager;
    use crate::services::job_service::JobManager;
    use crate::services::watcher_service::WatcherManager;
    use tauri::Manager;

    struct MockCliNetwork {
        checksum: String,
        binary: Vec<u8>,
    }

    #[async_trait::async_trait]
    impl crate::services::network::NetworkClient for MockCliNetwork {
        async fn send_request(&self, url: &str, _range: Option<String>) -> crate::error::CResult<crate::services::network::NetworkResponse> {
            if url.ends_with(".sha256") {
                let bytes = bytes::Bytes::from(self.checksum.clone());
                Ok(crate::services::network::NetworkResponse {
                    status: reqwest::StatusCode::OK,
                    content_length: Some(bytes.len() as u64),
                    bytes_stream: Box::pin(futures_util::stream::once(async move { Ok(bytes) })),
                })
            } else {
                let bytes = bytes::Bytes::from(self.binary.clone());
                Ok(crate::services::network::NetworkResponse {
                    status: reqwest::StatusCode::OK,
                    content_length: Some(bytes.len() as u64),
                    bytes_stream: Box::pin(futures_util::stream::once(async move { Ok(bytes) })),
                })
            }
        }
    }

    #[tokio::test]
    async fn test_get_cli_status_not_installed() -> Result<(), Box<dyn std::error::Error>> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("tauri-app-template-cli");
        TEST_CLI_PATH.with(|p| {
            *p.borrow_mut() = Some(path.clone());
        });

        let status = CliMgmtService::get_cli_status()?;
        assert!(!status.installed);
        assert!(status.version.is_none());
        Ok(())
    }

    #[tokio::test]
    async fn test_install_cli_success() -> Result<(), Box<dyn std::error::Error>> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("tauri-app-template-cli");
        TEST_CLI_PATH.with(|p| {
            *p.borrow_mut() = Some(path.clone());
        });

        // Generate checksum for mock binary
        let mock_binary = b"mock CLI binary content".to_vec();
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&mock_binary);
        let computed_sha = hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect::<String>();
        let mock_checksum = format!("{}  tauri-app-template-cli\n", computed_sha);

        // Setup mock tauri app and AppState
        let app = tauri::test::mock_app();
        let handle = app.handle();

        let db = sqlx::SqlitePool::connect("sqlite::memory:").await?;
        
        // Run database migrations to set up the jobs table
        sqlx::migrate!("./migrations")
            .run(&db)
            .await?;

        let mock_network = Arc::new(MockCliNetwork {
            checksum: mock_checksum,
            binary: mock_binary,
        });

        let download_manager = DownloadManager::with_mocks(
            1,
            mock_network,
            Arc::new(RealFileSystem),
        );

        handle.manage(AppState {
            db: db.clone(),
            log_dir: temp.path().join("logs"),
            app_data_dir: Some(temp.path().to_path_buf()),
            tray_settings: Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: false,
            }),
            download_manager,
            job_manager: JobManager::new(db),
            watcher_manager: WatcherManager::new(),
        });

        let result = CliMgmtService::install_cli(handle.clone()).await;
        assert!(result.is_ok());

        // Verify file was written to target path
        let cli_path = CliMgmtService::get_cli_path()?;
        assert!(cli_path.is_file());
        let file_content = std::fs::read(cli_path)?;
        assert_eq!(file_content, b"mock CLI binary content");
        Ok(())
    }

    #[tokio::test]
    async fn test_install_cli_checksum_mismatch() -> Result<(), Box<dyn std::error::Error>> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("tauri-app-template-cli");
        TEST_CLI_PATH.with(|p| {
            *p.borrow_mut() = Some(path.clone());
        });

        let mock_binary = b"mock CLI binary content".to_vec();
        let mock_checksum = "incorrect_sha256_hash  tauri-app-template-cli\n".to_string();

        let app = tauri::test::mock_app();
        let handle = app.handle();

        let db = sqlx::SqlitePool::connect("sqlite::memory:").await?;
        sqlx::migrate!("./migrations")
            .run(&db)
            .await?;

        let mock_network = Arc::new(MockCliNetwork {
            checksum: mock_checksum,
            binary: mock_binary,
        });

        let download_manager = DownloadManager::with_mocks(
            1,
            mock_network,
            Arc::new(RealFileSystem),
        );

        handle.manage(AppState {
            db: db.clone(),
            log_dir: temp.path().join("logs"),
            app_data_dir: Some(temp.path().to_path_buf()),
            tray_settings: Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: false,
            }),
            download_manager,
            job_manager: JobManager::new(db),
            watcher_manager: WatcherManager::new(),
        });

        let result = CliMgmtService::install_cli(handle.clone()).await;
        assert!(result.is_err());

        // Verify file was NOT written to target path due to failure
        let cli_path = CliMgmtService::get_cli_path()?;
        assert!(!cli_path.is_file());
        Ok(())
    }

    struct MockFailureFileSystem;

    #[async_trait::async_trait]
    impl crate::services::io::FileSystem for MockFailureFileSystem {
        async fn create_dir_all(&self, path: &std::path::Path) -> std::io::Result<()> {
            RealFileSystem.create_dir_all(path).await
        }
        async fn exists(&self, path: &std::path::Path) -> bool {
            RealFileSystem.exists(path).await
        }
        async fn metadata_len(&self, path: &std::path::Path) -> std::io::Result<u64> {
            RealFileSystem.metadata_len(path).await
        }
        async fn remove_file(&self, path: &std::path::Path) -> std::io::Result<()> {
            RealFileSystem.remove_file(path).await
        }
        async fn copy(&self, from: &std::path::Path, to: &std::path::Path) -> std::io::Result<u64> {
            RealFileSystem.copy(from, to).await
        }
        async fn create(&self, path: &std::path::Path) -> std::io::Result<Box<dyn tokio::io::AsyncWrite + Unpin + Send>> {
            if path.to_string_lossy().contains("sha256") {
                RealFileSystem.create(path).await
            } else {
                Ok(Box::new(tokio::io::sink()))
            }
        }
        async fn open_append(&self, path: &std::path::Path) -> std::io::Result<Box<dyn tokio::io::AsyncWrite + Unpin + Send>> {
            if path.to_string_lossy().contains("sha256") {
                RealFileSystem.open_append(path).await
            } else {
                Ok(Box::new(tokio::io::sink()))
            }
        }
    }

    #[tokio::test]
    async fn test_install_cli_read_failure() -> Result<(), Box<dyn std::error::Error>> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("tauri-app-template-cli");
        TEST_CLI_PATH.with(|p| {
            *p.borrow_mut() = Some(path.clone());
        });

        // Generate checksum for mock binary
        let mock_binary = b"mock CLI binary content".to_vec();
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&mock_binary);
        let computed_sha = hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect::<String>();
        let mock_checksum = format!("{}  tauri-app-template-cli\n", computed_sha);

        // Setup mock tauri app and AppState
        let app = tauri::test::mock_app();
        let handle = app.handle();

        let db = sqlx::SqlitePool::connect("sqlite::memory:").await?;
        
        // Run database migrations to set up the jobs table
        sqlx::migrate!("./migrations")
            .run(&db)
            .await?;

        let mock_network = Arc::new(MockCliNetwork {
            checksum: mock_checksum,
            binary: mock_binary,
        });

        let download_manager = DownloadManager::with_mocks(
            1,
            mock_network,
            Arc::new(MockFailureFileSystem),
        );

        handle.manage(AppState {
            db: db.clone(),
            log_dir: temp.path().join("logs"),
            app_data_dir: Some(temp.path().to_path_buf()),
            tray_settings: Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: false,
            }),
            download_manager,
            job_manager: JobManager::new(db.clone()),
            watcher_manager: WatcherManager::new(),
        });

        let result = CliMgmtService::install_cli(handle.clone()).await;
        assert!(result.is_err());

        #[derive(sqlx::FromRow)]
        struct TestJobRow {
            status: String,
            message: Option<String>,
        }

        // Verify the job was marked as failed in the database
        let jobs: Vec<TestJobRow> = sqlx::query_as("SELECT status, message FROM jobs")
            .fetch_all(&db)
            .await?;
        
        // We registered 1 download job for the binary (excluding checksum, which runs instantly without job row)
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].status, "failed");
        assert!(jobs[0].message.as_deref().unwrap_or_default().contains("Failed to read temporary download file"));

        Ok(())
    }

    #[tokio::test]
    async fn test_get_cli_status_timeout() -> Result<(), Box<dyn std::error::Error>> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("tauri-app-template-cli-slow");
        
        // Write a mock script that sleeps to simulate a hanging CLI process
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::write(&path, "#!/bin/sh\nsleep 10\n")?;
            let mut perms = std::fs::metadata(&path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&path, perms)?;
        }
        #[cfg(windows)]
        {
            // On Windows we can write a batch file that sleeps
            std::fs::write(&path, "@echo off\ntimeout /t 10 /nobreak > nul\n")?;
        }

        TEST_CLI_PATH.with(|p| {
            *p.borrow_mut() = Some(path.clone());
        });

        let start = std::time::Instant::now();
        let status = CliMgmtService::get_cli_status()?;
        let elapsed = start.elapsed();

        // Check that it returned within 5 seconds (our timeout is 3 seconds)
        assert!(elapsed < std::time::Duration::from_secs(5));
        assert!(status.installed);
        assert!(status.version.is_none());
        Ok(())
    }

    #[tokio::test]
    async fn test_install_cli_target_exists() -> Result<(), Box<dyn std::error::Error>> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("tauri-app-template-cli");
        
        // Pre-create the target file with some dummy content
        std::fs::write(&path, "existing CLI binary content")?;

        TEST_CLI_PATH.with(|p| {
            *p.borrow_mut() = Some(path.clone());
        });

        // Generate checksum for mock binary
        let mock_binary = b"mock CLI binary content".to_vec();
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&mock_binary);
        let computed_sha = hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect::<String>();
        let mock_checksum = format!("{}  tauri-app-template-cli\n", computed_sha);

        // Setup mock tauri app and AppState
        let app = tauri::test::mock_app();
        let handle = app.handle();

        let db = sqlx::SqlitePool::connect("sqlite::memory:").await?;
        
        // Run database migrations to set up the jobs table
        sqlx::migrate!("./migrations")
            .run(&db)
            .await?;

        let mock_network = Arc::new(MockCliNetwork {
            checksum: mock_checksum,
            binary: mock_binary,
        });

        let download_manager = DownloadManager::with_mocks(
            1,
            mock_network,
            Arc::new(RealFileSystem),
        );

        handle.manage(AppState {
            db: db.clone(),
            log_dir: temp.path().join("logs"),
            app_data_dir: Some(temp.path().to_path_buf()),
            tray_settings: Mutex::new(TraySettings {
                minimize_to_tray: false,
                notify_on_minimize: false,
            }),
            download_manager,
            job_manager: JobManager::new(db),
            watcher_manager: WatcherManager::new(),
        });

        let result = CliMgmtService::install_cli(handle.clone()).await;
        assert!(result.is_ok());

        // Verify the file was overwritten with the new mock binary content
        let file_content = std::fs::read(&path)?;
        assert_eq!(file_content, b"mock CLI binary content");
        Ok(())
    }
}
