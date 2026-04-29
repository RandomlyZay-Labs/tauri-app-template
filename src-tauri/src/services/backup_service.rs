// SPDX-License-Identifier: MIT
use crate::error::CResult;
use crate::util::{RESTORE_STAGING_NAME, schedule_restore};
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use tokio::task::JoinSet;

use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct BackupMetadata {
    pub id: String,
    pub name: String,
    pub path: String,
    #[specta(type = specta_typescript::BigInt)]
    pub size_bytes: u64,
    pub created_at: String, // ISO String
    pub is_manual: bool,
    pub label: Option<String>,
}

const BACKUP_DIR_NAME: &str = "backups";

/// Returns the path to the backup directory, ensuring it exists.
async fn get_backup_dir(app_data_dir: &Path) -> std::io::Result<PathBuf> {
    let dir = app_data_dir.join(BACKUP_DIR_NAME);
    if !tokio::fs::try_exists(&dir).await? {
        tokio::fs::create_dir_all(&dir).await?;
    }
    Ok(dir)
}

/// Creates a hot backup of the SQLite database using VACUUM INTO.
pub async fn create_backup(
    pool: &SqlitePool,
    app_data_dir: &Path,
    label: Option<String>,
    is_manual: Option<bool>,
) -> CResult<BackupMetadata> {
    log::debug!("[BackupService] Creating backup. Label: {:?}, is_manual: {:?}", label, is_manual);
    let backup_dir = get_backup_dir(app_data_dir).await?;
    // Use %f (nanoseconds) to guarantee uniqueness even in tight loops
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S_%f");

    let is_manual_resolved = is_manual.unwrap_or_else(|| label.is_none());

    // Sanitize and determine filename structure
    let (prefix, safe_label) = if let Some(l) = label {
        let sanitized: String = l
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == ' ' || *c == '.')
            .collect();

        let sanitized = sanitized.trim().replace(' ', "_");

        if sanitized.is_empty() {
            return Err(crate::error::Error::Unknown(
                "Backup name cannot be empty or contain only invalid characters".into(),
            ));
        }
        if is_manual_resolved {
            ("manual_backup", Some(sanitized))
        } else {
            ("backup", Some(sanitized))
        }
    } else {
        ("backup", None)
    };

    let file_name = if let Some(ref l) = safe_label {
        format!("{}_{}___{}.db", prefix, timestamp, l) // Using triple underscore as separator for parsing
    } else {
        format!("{}_{}.db", prefix, timestamp)
    };

    let file_path = backup_dir.join(&file_name);

    // SQLx requires the path as a string literal in the query usually, but bind works for VACUUM INTO in recent SQLite versions
    let path_str = file_path.to_string_lossy().to_string();

    // Execute VACUUM INTO to create a safe copy while DB is running
    sqlx::query("VACUUM INTO ?")
        .bind(&path_str)
        .execute(pool)
        .await?;

    log::debug!("[BackupService] Backup created successfully: {}", file_name);

    // Gather metadata
    let metadata = tokio::fs::metadata(&file_path).await?;
    let created: DateTime<Local> = SystemTime::now().into();

    let is_manual = safe_label.is_some() && is_manual_resolved;

    Ok(BackupMetadata {
        id: file_name.clone(),
        name: file_name,
        path: path_str,
        size_bytes: metadata.len(),
        created_at: created.to_rfc3339(),
        is_manual,
        label: safe_label,
    })
}

/// Lists all available backups sorted by date (newest first).
pub async fn list_backups(app_data_dir: &Path) -> CResult<Vec<BackupMetadata>> {
    let backup_dir = get_backup_dir(app_data_dir).await?;
    let mut backups = Vec::new();

    let mut entries = tokio::fs::read_dir(backup_dir).await?;
    let mut tasks = JoinSet::new();

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("db") {
            tasks.spawn(async move {
                let metadata = tokio::fs::metadata(&path).await?;
                let timestamp = metadata
                    .created()
                    .or_else(|_| metadata.modified())
                    .unwrap_or_else(|_| std::time::SystemTime::now());
                let created: DateTime<Local> = timestamp.into();
                let Some(file_name_os) = path.file_name() else {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "Invalid filename",
                    ));
                };
                let file_name = file_name_os.to_string_lossy().to_string();

                // Parse metadata from filename
                let is_manual = file_name.starts_with("manual_backup");
                let label = if is_manual || file_name.contains("___") {
                    // Split once by the triple underscore separator to safely capture the full label
                    file_name
                        .split_once("___")
                        .map(|(_, s)| s.replace(".db", ""))
                } else {
                    None
                };

                Ok::<BackupMetadata, std::io::Error>(BackupMetadata {
                    id: file_name.clone(),
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    size_bytes: metadata.len(),
                    created_at: created.to_rfc3339(),
                    is_manual,
                    label,
                })
            });
        }
    }

    while let Some(res) = tasks.join_next().await {
        match res {
            Ok(Ok(backup)) => backups.push(backup),
            Ok(Err(e)) => log::error!("[BackupService] Failed to read backup metadata: {}", e),
            Err(e) => log::error!("[BackupService] Backup metadata task panicked: {}", e),
        }
    }

    // Sort descending by creation date
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

/// Prunes automated backups if the count exceeds max_backups.
/// Keeps manual backups intact.
pub async fn prune_backups(app_data_dir: &Path, max_backups: u32) -> CResult<usize> {
    log::debug!(
        "[BackupService] Pruning backups, max allowed: {}",
        max_backups
    );
    let backups = list_backups(app_data_dir).await?;
    let max = max_backups as usize;

    // Only target automated backups
    let auto_backups: Vec<&BackupMetadata> = backups.iter().filter(|b| !b.is_manual).collect();

    if auto_backups.len() <= max {
        return Ok(0);
    }

    let to_delete = auto_backups.iter().skip(max);
    let mut deleted_count = 0;
    let mut tasks = JoinSet::new();

    for backup in to_delete {
        let path = PathBuf::from(&backup.path);
        tasks.spawn(async move { tokio::fs::remove_file(path).await });
    }

    while let Some(res) = tasks.join_next().await {
        if let Ok(Ok(_)) = res {
            deleted_count += 1;
        }
    }

    Ok(deleted_count)
}

/// Validates that the backup_id is safe to use in file paths.
fn validate_backup_id(backup_id: &str) -> CResult<()> {
    // Reject explicit path separators and parent directory references
    if backup_id.contains('/') || backup_id.contains('\\') || backup_id.contains("..") {
        return Err(crate::error::Error::Validation(
            "Invalid backup ID: contains illegal characters".into(),
        ));
    }

    // Verify it parses as a single filename component
    let path = Path::new(backup_id);
    if path.file_name().and_then(|s| s.to_str()) != Some(backup_id) {
        return Err(crate::error::Error::Validation(
            "Invalid backup ID: not a valid filename".into(),
        ));
    }

    // Enforce .db extension
    if !backup_id.ends_with(".db") {
        return Err(crate::error::Error::Validation(
            "Invalid backup ID: must end with .db extension".into(),
        ));
    }

    Ok(())
}

pub async fn prepare_restore(app_data_dir: &Path, backup_id: String) -> CResult<()> {
    use crate::services::io::RealFileSystem;
    use std::sync::Arc;
    prepare_restore_with_fs(Arc::new(RealFileSystem), app_data_dir, backup_id).await
}

pub async fn prepare_restore_with_fs(
    fs: std::sync::Arc<dyn crate::services::io::FileSystem>,
    app_data_dir: &Path,
    backup_id: String,
) -> CResult<()> {
    log::debug!(
        "[BackupService] Preparing restore for backup_id: {}",
        backup_id
    );
    validate_backup_id(&backup_id)?;

    let backup_dir = get_backup_dir(app_data_dir).await?;
    let backup_path = backup_dir.join(backup_id);
    let staging_path = app_data_dir.join(RESTORE_STAGING_NAME);

    if !fs.exists(&backup_path).await {
        return Err(crate::error::Error::NotFound(
            "Backup file not found".into(),
        ));
    }

    fs.copy(&backup_path, &staging_path).await?;
    schedule_restore(app_data_dir).await?;

    Ok(())
}

pub async fn delete_backup(app_data_dir: &Path, backup_id: String) -> CResult<()> {
    use crate::services::io::RealFileSystem;
    use std::sync::Arc;
    delete_backup_with_fs(Arc::new(RealFileSystem), app_data_dir, backup_id).await
}

pub async fn delete_backup_with_fs(
    fs: std::sync::Arc<dyn crate::services::io::FileSystem>,
    app_data_dir: &Path,
    backup_id: String,
) -> CResult<()> {
    log::debug!("[BackupService] Deleting backup_id: {}", backup_id);
    validate_backup_id(&backup_id)?;

    let backup_dir = get_backup_dir(app_data_dir).await?;
    let file_path = backup_dir.join(backup_id);

    if fs.exists(&file_path).await {
        fs.remove_file(&file_path).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_backup() -> Result<(), Box<dyn std::error::Error>> {
        use sqlx::sqlite::SqlitePoolOptions;

        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let source_db_path = test_dir.join("source.db");
        // Create an empty file first if it doesn't exist so SQLx can connect to it
        tokio::fs::File::create(&source_db_path).await?;

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite://{}", source_db_path.to_string_lossy()))
            .await?;

        sqlx::query(
            "CREATE TABLE test (id INTEGER PRIMARY KEY); INSERT INTO test (id) VALUES (42);",
        )
        .execute(&pool)
        .await?;

        let label = Some("my_first_backup".to_string());

        let metadata = create_backup(&pool, test_dir, label, None).await?;

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        let file_path = backup_dir.join(&metadata.id);

        assert!(tokio::fs::try_exists(&file_path).await?);

        let backup_pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite://{}", file_path.to_string_lossy()))
            .await?;

        let row: (i64,) = sqlx::query_as("SELECT id FROM test")
            .fetch_one(&backup_pool)
            .await?;

        assert_eq!(row.0, 42);

        Ok(())
    }

    #[tokio::test]
    async fn test_create_backup_with_dots() -> Result<(), Box<dyn std::error::Error>> {
        use sqlx::sqlite::SqlitePoolOptions;

        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let source_db_path = test_dir.join("source.db");
        tokio::fs::File::create(&source_db_path).await?;

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite://{}", source_db_path.to_string_lossy()))
            .await?;

        let label = Some("pre-update-0.6.3".to_string());
        let metadata = create_backup(&pool, test_dir, label.clone(), None).await?;

        assert_eq!(metadata.label, label);

        Ok(())
    }


    #[tokio::test]
    async fn test_create_backup_invalid_label() -> Result<(), Box<dyn std::error::Error>> {
        use sqlx::sqlite::SqlitePoolOptions;

        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let source_db_path = test_dir.join("source.db");
        tokio::fs::File::create(&source_db_path).await?;

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite://{}", source_db_path.to_string_lossy()))
            .await?;

        // Label with only special characters should be sanitized to empty and fail
        let label = Some("!!! @#$".to_string());

        let result = create_backup(&pool, test_dir, label, None).await;

        assert!(result.is_err());
        if let Err(e) = result {
            assert!(e.to_string().contains("Backup name cannot be empty"));
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_delete_backup() -> Result<(), Box<dyn std::error::Error>> {
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        tokio::fs::create_dir_all(&backup_dir).await?;

        let backup_id = "test_backup.db".to_string();
        let file_path = backup_dir.join(&backup_id);
        tokio::fs::write(&file_path, "dummy data").await?;

        assert!(tokio::fs::try_exists(&file_path).await?);

        delete_backup(test_dir, backup_id).await?;

        assert!(!tokio::fs::try_exists(&file_path).await?);

        Ok(())
    }

    #[tokio::test]
    async fn test_prune_backups() -> Result<(), Box<dyn std::error::Error>> {
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        tokio::fs::create_dir_all(&backup_dir).await?;

        // Create 3 automated backups with slightly different names
        for i in 0..3 {
            let name = format!("backup_{}.db", i);
            tokio::fs::write(backup_dir.join(name), "data").await?;
        }

        // Prune to keep only 1
        let count = prune_backups(test_dir, 1).await?;
        assert_eq!(count, 2);

        let remaining = list_backups(test_dir).await?;
        assert_eq!(remaining.len(), 1);

        Ok(())
    }

    #[tokio::test]
    async fn test_prune_pre_update_backups() -> Result<(), Box<dyn std::error::Error>> {
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        tokio::fs::create_dir_all(&backup_dir).await?;

        tokio::fs::write(backup_dir.join("backup_1.db"), "data").await?;
        tokio::fs::write(backup_dir.join("backup_2.db"), "data").await?;
        tokio::fs::write(backup_dir.join("manual_backup_3___my_manual.db"), "data").await?;
        tokio::fs::write(backup_dir.join("manual_backup_4___my_manual_2.db"), "data").await?;
        tokio::fs::write(backup_dir.join("backup_5___pre-update-1.0.0.db"), "data").await?;
        tokio::fs::write(backup_dir.join("backup_6___pre-update-2.0.0.db"), "data").await?;

        let count = prune_backups(test_dir, 1).await?;
        assert_eq!(count, 3);

        let remaining = list_backups(test_dir).await?;
        assert_eq!(remaining.len(), 3);

        assert!(remaining.iter().any(|b| b.label.as_deref() == Some("my_manual")));
        assert!(remaining.iter().any(|b| b.label.as_deref() == Some("my_manual_2")));

        Ok(())
    }

    #[test]
    fn test_validate_backup_id_logic() {
        // Valid cases
        assert!(validate_backup_id("backup_2023-01-01.db").is_ok());
        assert!(validate_backup_id("manual_backup.db").is_ok());

        // Invalid cases
        assert!(validate_backup_id("backup/../sensitive.db").is_err());
        assert!(validate_backup_id("..").is_err());
        assert!(validate_backup_id("").is_err()); // Empty string should fail extension check or filename check
        assert!(validate_backup_id("/etc/passwd").is_err());
        assert!(validate_backup_id("backup.txt").is_err());
        assert!(validate_backup_id("backup").is_err());
        assert!(validate_backup_id("foo/bar.db").is_err());
        assert!(validate_backup_id("foo\\bar.db").is_err());
    }

    #[tokio::test]
    async fn test_list_backups_with_complex_label() -> Result<(), Box<dyn std::error::Error>> {
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        tokio::fs::create_dir_all(&backup_dir).await?;

        // filename structure: manual_backup_<timestamp>___<label>.db
        let timestamp = "2023-01-01_12-00-00_000000";
        // A label that contains triple underscores itself (e.g. from sequence of spaces or dashes)
        let label = "my___complex___label";
        let filename = format!("manual_backup_{}___{}.db", timestamp, label);

        tokio::fs::write(backup_dir.join(&filename), "data").await?;

        let backups = list_backups(test_dir).await?;
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].label, Some(label.to_string()));

        Ok(())
    }

    #[tokio::test]
    async fn test_prepare_restore_behavior() -> Result<(), Box<dyn std::error::Error>> {
        use crate::util::MARKER_RESTORE_NAME;

        // Setup
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        tokio::fs::create_dir_all(&backup_dir).await?;

        let backup_id = "test_restore.db".to_string();
        let file_path = backup_dir.join(&backup_id);
        tokio::fs::write(&file_path, "backup database content").await?;

        // Run prepare_restore
        prepare_restore(test_dir, backup_id.clone()).await?;

        // 1. Verify that the backup file is successfully copied to the RESTORE_STAGING_NAME path
        let staging_path = test_dir.join(RESTORE_STAGING_NAME);
        assert!(
            tokio::fs::try_exists(&staging_path).await?,
            "Staging file should exist"
        );
        let staging_content = tokio::fs::read_to_string(&staging_path).await?;
        assert_eq!(staging_content, "backup database content");

        // 2. Verify that the application correctly stages it for restoration (marker file exists)
        let marker_path = test_dir.join(MARKER_RESTORE_NAME);
        assert!(
            tokio::fs::try_exists(&marker_path).await?,
            "Restore marker file should exist"
        );
        let marker_content = tokio::fs::read_to_string(&marker_path).await?;
        assert_eq!(marker_content, "restore_pending");

        // Cleanup
        Ok(())
    }

    #[tokio::test]
    async fn test_prepare_restore_fs_error() -> Result<(), Box<dyn std::error::Error>> {
        use async_trait::async_trait;
        struct ErrorFs;
        #[async_trait]
        impl crate::services::io::FileSystem for ErrorFs {
            async fn create_dir_all(&self, _path: &Path) -> std::io::Result<()> {
                Ok(())
            }
            async fn exists(&self, _path: &Path) -> bool {
                true
            }
            async fn metadata_len(&self, _path: &Path) -> std::io::Result<u64> {
                Ok(0)
            }
            async fn remove_file(&self, _path: &Path) -> std::io::Result<()> {
                Ok(())
            }
            async fn copy(&self, _from: &Path, _to: &Path) -> std::io::Result<u64> {
                Err(std::io::Error::other("Disk Full"))
            }
            async fn create(
                &self,
                _path: &Path,
            ) -> std::io::Result<Box<dyn tokio::io::AsyncWrite + Unpin + Send>> {
                Err(std::io::Error::other("Disk Full"))
            }
            async fn open_append(
                &self,
                _path: &Path,
            ) -> std::io::Result<Box<dyn tokio::io::AsyncWrite + Unpin + Send>> {
                Err(std::io::Error::other("Disk Full"))
            }
        }

        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        // Act
        let result = prepare_restore_with_fs(
            std::sync::Arc::new(ErrorFs),
            test_dir,
            "fake_backup.db".to_string(),
        )
        .await;

        assert!(result.is_err());
        if let Err(e) = result {
            assert!(
                e.to_string().contains("Disk Full"),
                "Error should propagate"
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod perf_tests {
    use super::*;
    use std::time::Instant;

    #[tokio::test]
    async fn test_prepare_restore_non_blocking() -> Result<(), Box<dyn std::error::Error>> {
        // Setup
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        tokio::fs::create_dir_all(&backup_dir).await?;

        let backup_id = "perf_backup.db".to_string();
        let file_path = backup_dir.join(&backup_id);

        // Create a reasonably sized file to simulate copy time (e.g., 1MB - enough to notice blocking if it was huge, but fast enough for test)
        // 1MB is small, but if it was blocking read/write, it would still block the thread momentarily.
        let data = vec![0u8; 1024 * 1024];
        tokio::fs::write(&file_path, &data).await?;

        // Measure
        let start = Instant::now();

        // Spawn a concurrent task that should run freely if prepare_restore is truly async
        let handle = tokio::spawn(async {
            // Just a small sleep to yield execution back to the runtime
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        });

        // Run prepare_restore
        prepare_restore(test_dir, backup_id.clone()).await?;

        // Verify the background task finished
        handle.await?;

        let duration = start.elapsed();
        log::debug!("Prepare restore took: {:?}", duration);

        // Verify result
        let staging = test_dir.join(RESTORE_STAGING_NAME);
        assert!(tokio::fs::try_exists(&staging).await?);

        // Cleanup
        Ok(())
    }

    #[tokio::test]
    async fn test_list_backups_robustness_to_malformed_files()
    -> Result<(), Box<dyn std::error::Error>> {
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let backup_dir = test_dir.join(BACKUP_DIR_NAME);
        tokio::fs::create_dir_all(&backup_dir).await?;

        // 1. Valid backup
        tokio::fs::write(backup_dir.join("backup_valid.db"), "data").await?;

        // 2. "Malformed" file - a file that starts_with manual_backup but has no ___
        // This will have label None but still be listed.
        tokio::fs::write(backup_dir.join("manual_backup_invalid.db"), "data").await?;

        let backups = list_backups(test_dir).await?;

        // Should still contain the valid one
        assert!(backups.iter().any(|b| b.id == "backup_valid.db"));
        // The one without ___ should have label None but still be listed
        assert!(backups.iter().any(|b| b.id == "manual_backup_invalid.db"));

        Ok(())
    }
}
