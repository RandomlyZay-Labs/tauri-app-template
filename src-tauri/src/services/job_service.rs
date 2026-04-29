use crate::error::{CResult, Error};
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }

    fn from_str(s: &str) -> Self {
        match s {
            "running" => Self::Running,
            "completed" => Self::Completed,
            "failed" => Self::Failed,
            "cancelled" => Self::Cancelled,
            _ => Self::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum JobKind {
    Download,
}

impl JobKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Download => "download",
        }
    }

    fn from_str(s: &str) -> Self {
        match s {
            "download" => Self::Download,
            _ => Self::Download,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub job_id: String,
    pub kind: JobKind,
    pub status: JobStatus,
    /// 0.0 – 100.0; `None` when progress is indeterminate
    pub percent: Option<f64>,
    pub speed_bps: Option<u64>,
    pub eta_secs: Option<u64>,
    pub message: Option<String>,
}

pub struct EmitJobProgressArgs<'a> {
    pub job_id: &'a str,
    pub kind: &'a JobKind,
    pub status: JobStatus,
    pub percent: Option<f64>,
    pub speed_bps: Option<u64>,
    pub eta_secs: Option<u64>,
    pub message: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct JobRow {
    pub id: String,
    pub kind: JobKind,
    pub status: JobStatus,
    pub progress: Option<f64>,
    pub message: Option<String>,
    pub metadata: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// DB row mapping
// ---------------------------------------------------------------------------

#[derive(Debug, sqlx::FromRow)]
struct DbJobRow {
    id: String,
    kind: String,
    status: String,
    progress: Option<f64>,
    message: Option<String>,
    metadata: Option<String>,
    created_at: String,
    updated_at: String,
}

impl From<DbJobRow> for JobRow {
    fn from(row: DbJobRow) -> Self {
        Self {
            id: row.id,
            kind: JobKind::from_str(&row.kind),
            status: JobStatus::from_str(&row.status),
            progress: row.progress,
            message: row.message,
            metadata: row.metadata,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

// ---------------------------------------------------------------------------
// Job Manager
// ---------------------------------------------------------------------------

const JOB_EVENT_NAME: &str = "job://progress";

pub struct JobManager {
    db: SqlitePool,
    active: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl JobManager {
    pub fn new(db: SqlitePool) -> Self {
        Self {
            db,
            active: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a cheaply-cloneable handle for use in spawned tasks.
    pub fn clone_inner(&self) -> Self {
        Self {
            db: self.db.clone(),
            active: Arc::clone(&self.active),
        }
    }

    /// Insert a new job row with `Pending` status.
    pub async fn create_job(&self, kind: JobKind, metadata: Option<String>) -> CResult<JobRow> {
        let id = uuid::Uuid::new_v4().to_string();
        log::debug!("[JobService] Creating job {}, kind: {:?}", id, kind);
        let kind_str = kind.as_str();
        let status_str = JobStatus::Pending.as_str();

        sqlx::query("INSERT INTO jobs (id, kind, status, metadata) VALUES (?, ?, ?, ?)")
            .bind(&id)
            .bind(kind_str)
            .bind(status_str)
            .bind(&metadata)
            .execute(&self.db)
            .await?;

        self.get_job(&id).await
    }

    /// Update the status (and optional message/progress) of a job.
    pub async fn update_status(
        &self,
        job_id: &str,
        status: JobStatus,
        progress: Option<f64>,
        message: Option<&str>,
    ) -> CResult<()> {
        log::debug!("[JobService] Updating job {} to status: {:?}", job_id, status);
        let status_str = status.as_str();

        let result = sqlx::query(
            "UPDATE jobs SET status = ?, progress = ?, message = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(status_str)
        .bind(progress)
        .bind(message)
        .bind(job_id)
        .execute(&self.db)
        .await?;

        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("No job with id: {job_id}")));
        }

        Ok(())
    }

    /// Get a single job by ID.
    pub async fn get_job(&self, job_id: &str) -> CResult<JobRow> {
        let row: DbJobRow = sqlx::query_as("SELECT * FROM jobs WHERE id = ?")
            .bind(job_id)
            .fetch_one(&self.db)
            .await?;

        Ok(row.into())
    }

    /// List jobs, optionally filtering by status.
    pub async fn list_jobs(&self, status_filter: Option<&str>) -> CResult<Vec<JobRow>> {
        let rows: Vec<DbJobRow> = if let Some(status) = status_filter {
            sqlx::query_as("SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC")
                .bind(status)
                .fetch_all(&self.db)
                .await?
        } else {
            sqlx::query_as("SELECT * FROM jobs ORDER BY created_at DESC")
                .fetch_all(&self.db)
                .await?
        };

        Ok(rows.into_iter().map(Into::into).collect())
    }

    /// Register a cancellation token for a running job.
    pub async fn register_token(&self, job_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        let mut map = self.active.lock().await;
        map.insert(job_id.to_string(), token.clone());
        token
    }

    /// Remove the cancellation token when a job finishes.
    pub async fn unregister_token(&self, job_id: &str) {
        let mut map = self.active.lock().await;
        map.remove(job_id);
    }

    /// Cancel a running job by its ID.
    pub async fn cancel_job(&self, job_id: &str) -> CResult<()> {
        let map = self.active.lock().await;
        let token = map
            .get(job_id)
            .ok_or_else(|| Error::NotFound(format!("No active job with id: {job_id}")))?;
        token.cancel();
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

pub fn emit_job_progress<R: tauri::Runtime>(app: &AppHandle<R>, args: EmitJobProgressArgs<'_>) {
    let payload = JobProgress {
        job_id: args.job_id.to_string(),
        kind: args.kind.clone(),
        status: args.status,
        percent: args.percent,
        speed_bps: args.speed_bps,
        eta_secs: args.eta_secs,
        message: args.message.map(String::from),
    };

    let _ = app.emit(JOB_EVENT_NAME, payload);
}

/// Single source of truth for creating and spawning a download job.
/// Used by both the Tauri command handler and the CLI.
pub async fn spawn_download_job<R: tauri::Runtime>(
    app: AppHandle<R>,
    jm: &JobManager,
    dm: &crate::services::download_service::DownloadManager,
    request: crate::services::download_service::DownloadRequest,
) -> CResult<JobRow> {
    log::debug!("[JobService] Spawning download job for url: {}", request.url);
    let metadata_json = serde_json::to_string(&request).ok();
    let job = jm.create_job(JobKind::Download, metadata_json).await?;

    let job_id = job.id.clone();
    let token = jm.register_token(&job_id).await;

    let dm = dm.clone_inner();
    let jm = jm.clone_inner();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        jm.update_status(&job_id, JobStatus::Running, Some(0.0), None)
            .await
            .ok();
        emit_job_progress(
            &app_clone,
            EmitJobProgressArgs {
                job_id: &job_id,
                kind: &JobKind::Download,
                status: JobStatus::Running,
                percent: Some(0.0),
                speed_bps: None,
                eta_secs: None,
                message: None,
            },
        );

        let app_for_progress = app_clone.clone();
        let job_id_clone = job_id.clone();
        let on_progress = Some(move |bytes: u64, total: Option<u64>, speed: Option<u64>, eta: Option<u64>| {
            let percent = total.and_then(|t| {
                if t > 0 {
                    Some((bytes as f64 / t as f64) * 100.0)
                } else {
                    None
                }
            });
            let msg = match total {
                Some(t) => format!(
                    "Downloaded {} / {}",
                    crate::util::format_bytes(bytes),
                    crate::util::format_bytes(t)
                ),
                None => format!("Downloaded {}", crate::util::format_bytes(bytes)),
            };
            emit_job_progress(
                &app_for_progress,
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
        });

        let result = dm
            .start_download_tracked(app_clone.clone(), request, &token, on_progress)
            .await;

        jm.unregister_token(&job_id).await;

        match result {
            Ok(dl_result) => {
                jm.update_status(
                    &job_id,
                    JobStatus::Completed,
                    Some(100.0),
                    Some(&dl_result.file_path),
                )
                .await
                .ok();
                emit_job_progress(
                    &app_clone,
                    EmitJobProgressArgs {
                        job_id: &job_id,
                        kind: &JobKind::Download,
                        status: JobStatus::Completed,
                        percent: Some(100.0),
                        speed_bps: None,
                        eta_secs: None,
                        message: Some(&dl_result.file_path),
                    },
                );
            }
            Err(e) => {
                let (status, msg) = if token.is_cancelled() {
                    (JobStatus::Cancelled, "Cancelled by user".to_string())
                } else {
                    (JobStatus::Failed, e.to_string())
                };

                jm.update_status(&job_id, status.clone(), None, Some(&msg))
                    .await
                    .ok();
                emit_job_progress(
                    &app_clone,
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
            }
        }
    });

    Ok(job)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_db() -> Result<sqlx::SqlitePool, Box<dyn std::error::Error>> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(":memory:")
            .await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS jobs (
                id          TEXT    PRIMARY KEY NOT NULL,
                kind        TEXT    NOT NULL,
                status      TEXT    NOT NULL DEFAULT 'pending',
                progress    REAL,
                message     TEXT,
                metadata    TEXT,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await?;
        Ok(pool)
    }

    #[tokio::test]
    async fn test_create_job() -> Result<(), Box<dyn std::error::Error>> {
        let pool = setup_db().await?;
        let mgr = JobManager::new(pool);

        let job = mgr.create_job(JobKind::Download, None).await?;
        assert_eq!(job.status, JobStatus::Pending);
        assert!(!job.id.is_empty());
        Ok(())
    }

    #[tokio::test]
    async fn test_update_status() -> Result<(), Box<dyn std::error::Error>> {
        let pool = setup_db().await?;
        let mgr = JobManager::new(pool);

        let job = mgr.create_job(JobKind::Download, None).await?;
        mgr.update_status(&job.id, JobStatus::Running, Some(50.0), Some("halfway"))
            .await?;

        let updated = mgr.get_job(&job.id).await?;
        assert_eq!(updated.status, JobStatus::Running);
        assert_eq!(updated.progress, Some(50.0));
        assert_eq!(updated.message.as_deref(), Some("halfway"));
        Ok(())
    }

    #[tokio::test]
    async fn test_cancel_unknown_job() -> Result<(), Box<dyn std::error::Error>> {
        let pool = setup_db().await?;
        let mgr = JobManager::new(pool);

        let result = mgr.cancel_job("nonexistent-id").await;
        assert!(result.is_err());
        Ok(())
    }

    #[tokio::test]
    async fn test_list_jobs_filter() -> Result<(), Box<dyn std::error::Error>> {
        let pool = setup_db().await?;
        let mgr = JobManager::new(pool);

        let job1 = mgr.create_job(JobKind::Download, None).await?;
        let _job2 = mgr.create_job(JobKind::Download, None).await?;

        mgr.update_status(&job1.id, JobStatus::Completed, Some(100.0), None)
            .await?;

        let all = mgr.list_jobs(None).await?;
        assert_eq!(all.len(), 2);

        let completed = mgr.list_jobs(Some("completed")).await?;
        assert_eq!(completed.len(), 1);
        assert_eq!(completed[0].id, job1.id);

        let pending = mgr.list_jobs(Some("pending")).await?;
        assert_eq!(pending.len(), 1);
        Ok(())
    }

    #[tokio::test]
    async fn test_register_and_cancel() -> Result<(), Box<dyn std::error::Error>> {
        let pool = setup_db().await?;
        let mgr = JobManager::new(pool);

        let job = mgr.create_job(JobKind::Download, None).await?;
        let token = mgr.register_token(&job.id).await;

        assert!(!token.is_cancelled());
        mgr.cancel_job(&job.id).await?;
        assert!(token.is_cancelled());

        mgr.unregister_token(&job.id).await;
        let result = mgr.cancel_job(&job.id).await;
        assert!(result.is_err());
        Ok(())
    }

    async fn spawn_test_server() -> String {
        use tokio::net::TcpListener;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                let mut buf = [0; 1024];
                let _ = stream.read(&mut buf).await;
                let response = "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nHello";
                let _ = stream.write_all(response.as_bytes()).await;
            }
        });

        format!("http://127.0.0.1:{}", port)
    }

    #[derive(Default)]
    struct MockFileSystem {
        pub fail_on_create: bool,
    }

    #[async_trait::async_trait]
    impl crate::services::io::FileSystem for MockFileSystem {
        async fn create_dir_all(&self, _path: &std::path::Path) -> std::io::Result<()> { Ok(()) }
        async fn exists(&self, _path: &std::path::Path) -> bool { false }
        async fn metadata_len(&self, _path: &std::path::Path) -> std::io::Result<u64> { Ok(0) }
        async fn remove_file(&self, _path: &std::path::Path) -> std::io::Result<()> { Ok(()) }
        async fn copy(&self, _from: &std::path::Path, _to: &std::path::Path) -> std::io::Result<u64> { Ok(0) }
        async fn create(&self, _path: &std::path::Path) -> std::io::Result<Box<dyn tokio::io::AsyncWrite + Unpin + Send>> {
            if self.fail_on_create {
                return Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Mock FS Error"));
            }
            Ok(Box::new(std::io::Cursor::new(Vec::new())))
        }
        async fn open_append(&self, _path: &std::path::Path) -> std::io::Result<Box<dyn tokio::io::AsyncWrite + Unpin + Send>> {
            Ok(Box::new(std::io::Cursor::new(Vec::new())))
        }
    }

    #[tokio::test]
    async fn test_spawn_download_job_failed() -> Result<(), Box<dyn std::error::Error>> {
        use crate::services::download_service::{DownloadManager, DownloadRequest};
        use crate::services::network::{NetworkClient, NetworkResponse};
        use tauri::{Manager, Listener};
        use std::sync::atomic::Ordering;
        use async_trait::async_trait;
        
        struct MockFailNetwork;
        #[async_trait]
        impl NetworkClient for MockFailNetwork {
            async fn send_request(&self, _url: &str, _range: Option<String>) -> CResult<NetworkResponse> {
                Err(crate::error::Error::Network("Mock connection refused".into()))
            }
        }

        let pool = setup_db().await?;
        let jm = JobManager::new(pool);
        // Inject the mock network client that always fails and mock FS
        let dm = DownloadManager::with_mocks(
            1, 
            Arc::new(MockFailNetwork), 
            Arc::new(MockFileSystem::default())
        );
        
        let app = tauri::test::mock_app().app_handle().clone();

        let failed_event_received = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let f_clone = failed_event_received.clone();
        
        app.listen(JOB_EVENT_NAME, move |event: tauri::Event| {
            let payload: JobProgress = serde_json::from_str(event.payload()).unwrap();
            if payload.status == JobStatus::Failed {
                f_clone.store(true, Ordering::SeqCst);
            }
        });

        let req = DownloadRequest {
            url: "http://example.com/fail.txt".to_string(),
            dest_dir: "/tmp/mock".to_string(),
            filename: Some("test_fail.txt".to_string()),
        };

        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        app.listen(JOB_EVENT_NAME, move |event: tauri::Event| {
            let payload: JobProgress = serde_json::from_str(event.payload()).unwrap();
            if payload.status == JobStatus::Failed {
                let _ = tx.send(());
            }
        });

        let job = spawn_download_job(app, &jm, &dm, req).await?;

        // Wait for failure with timeout
        tokio::time::timeout(tokio::time::Duration::from_secs(2), rx.recv())
            .await
            .expect("Timeout waiting for job failure")
            .expect("Channel closed");

        let updated = jm.get_job(&job.id).await?;
        assert_eq!(updated.status, JobStatus::Failed);
        assert!(updated.message.as_ref().unwrap().contains("Mock connection refused"));
        assert!(failed_event_received.load(std::sync::atomic::Ordering::SeqCst), "Failed status event should have been emitted");

        Ok(())
    }

    #[tokio::test]
    async fn test_spawn_download_job_fs_failed() -> Result<(), Box<dyn std::error::Error>> {
        use crate::services::download_service::{DownloadManager, DownloadRequest};
        use crate::services::network::{NetworkClient, NetworkResponse};
        use tauri::{Manager, Listener};
        use async_trait::async_trait;
        
        struct MockSuccessNetwork;
        #[async_trait]
        impl NetworkClient for MockSuccessNetwork {
            async fn send_request(&self, _url: &str, _range: Option<String>) -> CResult<NetworkResponse> {
                Ok(NetworkResponse {
                    status: reqwest::StatusCode::OK,
                    content_length: Some(10),
                    bytes_stream: Box::pin(futures_util::stream::once(async { Ok(bytes::Bytes::from("data")) })),
                })
            }
        }

        let pool = setup_db().await?;
        let jm = JobManager::new(pool);
        // Inject mock FS that fails on create
        let dm = DownloadManager::with_mocks(
            1, 
            Arc::new(MockSuccessNetwork), 
            Arc::new(MockFileSystem { fail_on_create: true })
        );
        
        let app = tauri::test::mock_app().app_handle().clone();

        let req = DownloadRequest {
            url: "http://example.com/fs-fail.txt".to_string(),
            dest_dir: "/tmp/mock".to_string(),
            filename: Some("test_fs_fail.txt".to_string()),
        };

        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        app.listen(JOB_EVENT_NAME, move |event: tauri::Event| {
            let payload: JobProgress = serde_json::from_str(event.payload()).unwrap();
            if payload.status == JobStatus::Failed {
                let _ = tx.send(());
            }
        });

        let job = spawn_download_job(app, &jm, &dm, req).await?;

        // Wait for failure
        tokio::time::timeout(tokio::time::Duration::from_secs(2), rx.recv())
            .await
            .expect("Timeout waiting for job failure")
            .expect("Channel closed");

        let updated = jm.get_job(&job.id).await?;
        assert_eq!(updated.status, JobStatus::Failed);
        assert!(updated.message.as_ref().unwrap().contains("Mock FS Error"));

        Ok(())
    }

    #[tokio::test]
    async fn test_spawn_download_job_lifecycle_and_events() -> Result<(), Box<dyn std::error::Error>> {
        use crate::services::download_service::{DownloadManager, DownloadRequest};
        use tauri::{Manager, Listener};
        use std::sync::atomic::{AtomicUsize, Ordering};

        let pool = setup_db().await?;
        let jm = JobManager::new(pool);
        let dm = DownloadManager::new(1);
        
        let app = tauri::test::mock_app().app_handle().clone();
        let running_count = Arc::new(AtomicUsize::new(0));
        let completed_count = Arc::new(AtomicUsize::new(0));

        let r_clone = running_count.clone();
        let c_clone = completed_count.clone();
        
        app.listen(JOB_EVENT_NAME, move |event| {
            let payload: JobProgress = serde_json::from_str(event.payload()).unwrap();
            match payload.status {
                JobStatus::Running => { r_clone.fetch_add(1, Ordering::SeqCst); }
                JobStatus::Completed => { c_clone.fetch_add(1, Ordering::SeqCst); }
                _ => {}
            }
        });

        let url = spawn_test_server().await;
        let tmp = tempfile::tempdir()?;
        let test_dir = tmp.path();

        let req = DownloadRequest {
            url,
            dest_dir: test_dir.to_string_lossy().to_string(),
            filename: Some("lifecycle.txt".to_string()),
        };

        let job = spawn_download_job(app.clone(), &jm, &dm, req).await?;

        // Check token registration immediately after spawn (might need a tiny yield)
        tokio::task::yield_now().await;
        {
            let active = jm.active.lock().await;
            assert!(active.contains_key(&job.id), "Job should have a registered cancellation token");
        }

        // Wait for completion
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let job_id_for_event = job.id.clone();
        app.listen(JOB_EVENT_NAME, move |event| {
            let payload: JobProgress = serde_json::from_str(event.payload()).unwrap();
            if payload.job_id == job_id_for_event && payload.status == JobStatus::Completed {
                let _ = tx.send(());
            }
        });

        tokio::time::timeout(tokio::time::Duration::from_secs(5), rx.recv())
            .await
            .expect("Timeout waiting for job completion")
            .expect("Channel closed");

        let updated = jm.get_job(&job.id).await?;
        assert_eq!(updated.status, JobStatus::Completed);

        // Verify token unregistration
        {
            let active = jm.active.lock().await;
            assert!(!active.contains_key(&job.id), "Job token should be unregistered after completion");
        }

        // Verify IPC events were emitted
        assert!(running_count.load(Ordering::SeqCst) > 0, "Running event should have been emitted");
        assert_eq!(completed_count.load(Ordering::SeqCst), 1, "Completed event should have been emitted exactly once");

        Ok(())
    }
}
