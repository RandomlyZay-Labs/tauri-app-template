use crate::services::backup_service::BackupMetadata;
use crate::services::job_service::{JobRow, JobStatus};
use async_trait::async_trait;
use clap::{Parser, Subcommand};
use serde_json::json;

// ---------------------------------------------------------------------------
// CLI Definition (clap)
// ---------------------------------------------------------------------------

#[derive(Parser, Debug)]
#[command(
    name = "tauri-app-template-cli",
    about = "Tauri App Template CLI",
    version
)]
pub struct CliArgs {
    #[arg(short, long, help = "Output in JSON format")]
    pub json: bool,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Manage background jobs
    Jobs {
        #[command(subcommand)]
        command: JobsCommands,
    },

    /// Manage backups
    Backup {
        #[command(subcommand)]
        command: BackupCommands,
    },
    /// Manage secrets in the OS keychain
    Secret {
        #[command(subcommand)]
        command: SecretCommands,
    },
    /// Show application information
    Info {
        #[command(subcommand)]
        command: InfoCommands,
    },
}

#[derive(Subcommand, Debug)]
pub enum JobsCommands {
    /// List all jobs
    List {
        #[arg(
            short,
            long,
            help = "Filter by job status (pending, running, completed, failed, cancelled)"
        )]
        status: Option<JobStatus>,
    },
    /// Get job details
    Get {
        #[arg(index = 1, help = "Job ID")]
        id: String,
    },
    /// Cancel a running job
    Cancel {
        #[arg(index = 1, help = "Job ID")]
        id: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum BackupCommands {
    /// Create a new backup
    Create {
        #[arg(short, long, help = "Optional label for this backup")]
        label: Option<String>,
    },
    /// List all backups
    List,
    /// Delete a backup
    Delete {
        #[arg(index = 1, help = "Backup ID")]
        id: String,
    },
    /// Restore from a backup (restarts application)
    Restore {
        #[arg(index = 1, help = "Backup ID")]
        id: String,
    },
    /// Prune old automated backups
    Prune {
        #[arg(
            short,
            long,
            default_value = "5",
            help = "Maximum number of automated backups to keep"
        )]
        max: u32,
    },
}

#[derive(Subcommand, Debug)]
pub enum SecretCommands {
    /// Store a secret
    Set {
        #[arg(short, long, required = true, help = "Secret key")]
        key: String,
        #[arg(short, long, required = true, help = "Secret value")]
        value: String,
    },
    /// Retrieve a secret
    Get {
        #[arg(short, long, required = true, help = "Secret key")]
        key: String,
    },
    /// Delete a secret
    Delete {
        #[arg(short, long, required = true, help = "Secret key")]
        key: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum InfoCommands {
    /// Print the log directory path
    LogPath,
    /// Print the data directory path
    DataDir,
}

// ---------------------------------------------------------------------------
// Context trait
// ---------------------------------------------------------------------------

#[async_trait]
pub trait CliContext {
    fn version(&self) -> String;
    fn product_name(&self) -> String;
    async fn list_jobs(&self, status_filter: Option<&str>) -> crate::error::CResult<Vec<JobRow>>;
    async fn get_job(&self, job_id: &str) -> crate::error::CResult<JobRow>;
    async fn cancel_job(&self, job_id: &str) -> crate::error::CResult<()>;
    async fn update_job_status(
        &self,
        job_id: &str,
        status: JobStatus,
        progress: Option<f64>,
        message: Option<&str>,
    ) -> crate::error::CResult<()>;

    async fn create_backup(&self, label: Option<&str>) -> crate::error::CResult<BackupMetadata>;
    async fn list_backups(&self) -> crate::error::CResult<Vec<BackupMetadata>>;
    async fn delete_backup(&self, backup_id: &str) -> crate::error::CResult<()>;
    async fn restore_backup(&self, backup_id: &str) -> crate::error::CResult<()>;
    async fn prune_backups(&self, max_backups: u32) -> crate::error::CResult<usize>;
    async fn set_secret(&self, key: &str, value: &str) -> crate::error::CResult<()>;
    async fn get_secret(&self, key: &str) -> crate::error::CResult<String>;
    async fn delete_secret(&self, key: &str) -> crate::error::CResult<()>;
    fn log_path(&self) -> String;
    fn data_dir(&self) -> Option<String>;
}

// ---------------------------------------------------------------------------
// Standalone Context (Headless)
// ---------------------------------------------------------------------------

pub struct StandaloneContext {
    pub version: String,
    pub product_name: String,
    pub job_manager: crate::services::job_service::JobManager,
    pub db: sqlx::SqlitePool,
    pub data_dir: std::path::PathBuf,
    pub log_dir: std::path::PathBuf,
}

#[async_trait]
impl CliContext for StandaloneContext {
    fn version(&self) -> String {
        self.version.clone()
    }
    fn product_name(&self) -> String {
        self.product_name.clone()
    }

    async fn list_jobs(&self, status_filter: Option<&str>) -> crate::error::CResult<Vec<JobRow>> {
        self.job_manager.list_jobs(status_filter).await
    }

    async fn get_job(&self, job_id: &str) -> crate::error::CResult<JobRow> {
        self.job_manager.get_job(job_id).await
    }

    async fn cancel_job(&self, job_id: &str) -> crate::error::CResult<()> {
        self.job_manager.cancel_job(job_id).await
    }

    async fn update_job_status(
        &self,
        job_id: &str,
        status: JobStatus,
        progress: Option<f64>,
        message: Option<&str>,
    ) -> crate::error::CResult<()> {
        self.job_manager
            .update_status(job_id, status, progress, message)
            .await
    }

    async fn create_backup(&self, label: Option<&str>) -> crate::error::CResult<BackupMetadata> {
        crate::services::backup_service::create_backup(
            &self.db,
            &self.data_dir,
            label.map(|s| s.to_string()),
            None,
        )
        .await
    }

    async fn list_backups(&self) -> crate::error::CResult<Vec<BackupMetadata>> {
        crate::services::backup_service::list_backups(&self.data_dir).await
    }

    async fn delete_backup(&self, backup_id: &str) -> crate::error::CResult<()> {
        crate::services::backup_service::delete_backup(&self.data_dir, backup_id.to_string()).await
    }

    async fn restore_backup(&self, backup_id: &str) -> crate::error::CResult<()> {
        crate::services::backup_service::prepare_restore(&self.data_dir, backup_id.to_string())
            .await
    }

    async fn prune_backups(&self, max_backups: u32) -> crate::error::CResult<usize> {
        crate::services::backup_service::prune_backups(&self.data_dir, max_backups).await
    }

    async fn set_secret(&self, key: &str, value: &str) -> crate::error::CResult<()> {
        crate::services::security_service::set_secret(key, value)
    }

    async fn get_secret(&self, key: &str) -> crate::error::CResult<String> {
        crate::services::security_service::get_secret(key)
    }

    async fn delete_secret(&self, key: &str) -> crate::error::CResult<()> {
        crate::services::security_service::delete_secret(key)
    }

    fn log_path(&self) -> String {
        self.log_dir.to_string_lossy().to_string()
    }

    fn data_dir(&self) -> Option<String> {
        Some(self.data_dir.to_string_lossy().to_string())
    }
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq)]
pub enum CliResult {
    Exit,
    Error(String),
}

// ---------------------------------------------------------------------------
// Routing Logic
// ---------------------------------------------------------------------------

pub async fn run_cli(ctx: &impl CliContext, args: &CliArgs) -> CliResult {
    let Some(command) = &args.command else {
        return CliResult::Exit;
    };

    match command {
        Commands::Jobs { command } => run_jobs_cli(ctx, command, args.json).await,

        Commands::Backup { command } => run_backup_cli(ctx, command, args.json).await,
        Commands::Secret { command } => run_secret_cli(ctx, command, args.json).await,
        Commands::Info { command } => run_info_cli(ctx, command, args.json).await,
    }
}

async fn run_jobs_cli(
    ctx: &impl CliContext,
    command: &JobsCommands,
    json_format: bool,
) -> CliResult {
    match command {
        JobsCommands::List { status } => {
            let status_str = status.as_ref().map(|s| s.as_str());
            match ctx.list_jobs(status_str).await {
                Ok(jobs) => {
                    if json_format {
                        match serde_json::to_string_pretty(&jobs) {
                            Ok(json_str) => println!("{}", json_str),
                            Err(e) => {
                                return CliResult::Error(format!("Serialization error: {}", e));
                            }
                        }
                    } else if jobs.is_empty() {
                        println!("No jobs found.");
                    } else {
                        println!("{:<36} | {:<10} | {:<10} | MESSAGE", "ID", "KIND", "STATUS");
                        println!("{}", "-".repeat(80));
                        for job in jobs {
                            println!(
                                "{:<36} | {:<10} | {:<10} | {}",
                                job.id,
                                job.kind.as_str(),
                                job.status.as_str(),
                                job.message.unwrap_or_default()
                            );
                        }
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error listing jobs: {e}")),
            }
        }
        JobsCommands::Get { id } => match ctx.get_job(id).await {
            Ok(job) => {
                if json_format {
                    match serde_json::to_string_pretty(&job) {
                        Ok(json_str) => println!("{}", json_str),
                        Err(e) => return CliResult::Error(format!("Serialization error: {}", e)),
                    }
                } else {
                    println!("Job Details:");
                    println!("  ID:        {}", job.id);
                    println!("  Kind:      {:?}", job.kind);
                    println!("  Status:    {:?}", job.status);
                    println!("  Progress:  {:?}", job.progress);
                    println!("  Message:   {:?}", job.message);
                    println!("  Created:   {}", job.created_at);
                    println!("  Updated:   {}", job.updated_at);
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error getting job: {e}")),
        },
        JobsCommands::Cancel { id } => match ctx.cancel_job(id).await {
            Ok(_) => {
                match ctx
                    .update_job_status(id, JobStatus::Cancelled, None, Some("Cancelled via CLI"))
                    .await
                {
                    Ok(_) => {
                        if json_format {
                            println!(
                                "{}",
                                json!({ "status": "success", "message": "Job cancelled" })
                            );
                        } else {
                            println!("Job {id} cancelled successfully.");
                        }
                        CliResult::Exit
                    }
                    Err(e) => CliResult::Error(format!(
                        "Error in JobsCommands::Cancel: ctx.cancel_job succeeded, but ctx.update_job_status failed to persist JobStatus::Cancelled (json_format={json_format}): {e}"
                    )),
                }
            }
            Err(e) => CliResult::Error(format!("Error cancelling job: {e}")),
        },
    }
}

async fn run_backup_cli(
    ctx: &impl CliContext,
    command: &BackupCommands,
    json_format: bool,
) -> CliResult {
    match command {
        BackupCommands::Create { label } => match ctx.create_backup(label.as_deref()).await {
            Ok(backup) => {
                if json_format {
                    match serde_json::to_string_pretty(&backup) {
                        Ok(json_str) => println!("{}", json_str),
                        Err(e) => return CliResult::Error(format!("Serialization error: {}", e)),
                    }
                } else {
                    println!("Backup created.");
                    println!("  ID:   {}", backup.id);
                    println!("  Name: {}", backup.name);
                    println!("  Size: {} bytes", backup.size_bytes);
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error creating backup: {e}")),
        },
        BackupCommands::List => match ctx.list_backups().await {
            Ok(backups) => {
                if json_format {
                    match serde_json::to_string_pretty(&backups) {
                        Ok(json_str) => println!("{}", json_str),
                        Err(e) => return CliResult::Error(format!("Serialization error: {}", e)),
                    }
                } else if backups.is_empty() {
                    println!("No backups found.");
                } else {
                    println!("{:<40} | {:<10} | {:<8} | CREATED", "ID", "LABEL", "SIZE");
                    println!("{}", "-".repeat(90));
                    for b in backups {
                        println!(
                            "{:<40} | {:<10} | {:<8} | {}",
                            b.id,
                            b.label.unwrap_or_default(),
                            b.size_bytes,
                            b.created_at
                        );
                    }
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error listing backups: {e}")),
        },
        BackupCommands::Delete { id } => match ctx.delete_backup(id).await {
            Ok(_) => {
                if json_format {
                    println!(
                        "{}",
                        json!({ "status": "success", "message": "Backup deleted" })
                    );
                } else {
                    println!("Backup {id} deleted.");
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error deleting backup: {e}")),
        },
        BackupCommands::Restore { id } => match ctx.restore_backup(id).await {
            Ok(_) => {
                if json_format {
                    println!(
                        "{}",
                        json!({ "status": "success", "message": "Restore prepared. Restart to apply." })
                    );
                } else {
                    println!(
                        "Restore prepared from backup {id}. Restart the application to apply."
                    );
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error restoring backup: {e}")),
        },
        BackupCommands::Prune { max } => match ctx.prune_backups(*max).await {
            Ok(count) => {
                if json_format {
                    println!("{}", json!({ "status": "success", "pruned": count }));
                } else {
                    println!("Pruned {count} old backup(s). Keeping up to {max}.");
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error pruning backups: {e}")),
        },
    }
}

async fn run_secret_cli(
    ctx: &impl CliContext,
    command: &SecretCommands,
    json_format: bool,
) -> CliResult {
    match command {
        SecretCommands::Set { key, value } => match ctx.set_secret(key, value).await {
            Ok(_) => {
                if json_format {
                    println!(
                        "{}",
                        json!({ "status": "success", "message": "Secret stored" })
                    );
                } else {
                    println!("Secret '{key}' stored.");
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error storing secret: {e}")),
        },
        SecretCommands::Get { key } => match ctx.get_secret(key).await {
            Ok(val) => {
                if json_format {
                    println!("{}", json!({ "key": key, "value": val }));
                } else {
                    println!("{val}");
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error retrieving secret: {e}")),
        },
        SecretCommands::Delete { key } => match ctx.delete_secret(key).await {
            Ok(_) => {
                if json_format {
                    println!(
                        "{}",
                        json!({ "status": "success", "message": "Secret deleted" })
                    );
                } else {
                    println!("Secret '{key}' deleted.");
                }
                CliResult::Exit
            }
            Err(e) => CliResult::Error(format!("Error deleting secret: {e}")),
        },
    }
}

async fn run_info_cli(
    ctx: &impl CliContext,
    command: &InfoCommands,
    json_format: bool,
) -> CliResult {
    match command {
        InfoCommands::LogPath => {
            let path = ctx.log_path();
            if json_format {
                println!("{}", json!({ "log_path": path }));
            } else {
                println!("{path}");
            }
            CliResult::Exit
        }
        InfoCommands::DataDir => {
            let dir = ctx.data_dir();
            if json_format {
                println!("{}", json!({ "data_dir": dir }));
            } else {
                match dir {
                    Some(d) => println!("{d}"),
                    None => println!("(using default OS data directory)"),
                }
            }
            CliResult::Exit
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{CResult, Error};
    use crate::services::job_service::{JobKind, JobRow, JobStatus};
    use std::collections::HashMap;

    fn make_job(id: &str, status: JobStatus) -> JobRow {
        JobRow {
            id: id.to_string(),
            kind: JobKind::Download,
            status,
            progress: None,
            message: None,
            metadata: None,
            created_at: "2024-01-01T00:00:00".to_string(),
            updated_at: "2024-01-01T00:00:00".to_string(),
        }
    }

    fn make_backup(id: &str) -> BackupMetadata {
        BackupMetadata {
            id: id.to_string(),
            name: id.to_string(),
            path: format!("/data/backups/{id}"),
            size_bytes: 1024,
            created_at: "2024-01-01T00:00:00+00:00".to_string(),
            is_manual: false,
            label: None,
        }
    }

    struct MockContext {
        version: String,
        product_name: String,
        jobs: Vec<JobRow>,
        backups: Vec<BackupMetadata>,
        downloads: Vec<String>,
        secrets: HashMap<String, String>,
        log_path_val: String,
        data_dir_val: Option<String>,
        fail_ops: bool,
        fail_update_job_status: bool,
    }

    impl MockContext {
        fn new() -> Self {
            Self {
                version: "1.2.3".to_string(),
                product_name: "TestApp".to_string(),
                jobs: vec![],
                backups: vec![],
                downloads: vec![],
                secrets: HashMap::new(),
                log_path_val: "/tmp/logs".to_string(),
                data_dir_val: Some("/tmp/data".to_string()),
                fail_ops: false,
                fail_update_job_status: false,
            }
        }
        fn with_jobs(mut self, jobs: Vec<JobRow>) -> Self {
            self.jobs = jobs;
            self
        }
        #[allow(dead_code)]
        fn with_backups(mut self, backups: Vec<BackupMetadata>) -> Self {
            self.backups = backups;
            self
        }
        #[allow(dead_code)]
        fn with_downloads(mut self, downloads: Vec<String>) -> Self {
            self.downloads = downloads;
            self
        }
        #[allow(dead_code)]
        fn with_failure(mut self) -> Self {
            self.fail_ops = true;
            self.jobs = vec![];
            self.backups = vec![];
            self.downloads = vec![];
            self
        }
        fn with_fail_update_status(mut self) -> Self {
            self.fail_update_job_status = true;
            self
        }
    }

    #[async_trait]
    impl CliContext for MockContext {
        fn version(&self) -> String {
            self.version.clone()
        }
        fn product_name(&self) -> String {
            self.product_name.clone()
        }

        async fn list_jobs(&self, status_filter: Option<&str>) -> CResult<Vec<JobRow>> {
            if self.fail_ops {
                return Err(Error::Unknown("list failed".into()));
            }
            let filtered = self
                .jobs
                .iter()
                .filter(|j| {
                    status_filter
                        .map(|f| j.status.as_str() == f)
                        .unwrap_or(true)
                })
                .cloned()
                .collect();
            Ok(filtered)
        }

        async fn get_job(&self, job_id: &str) -> CResult<JobRow> {
            if self.fail_ops {
                return Err(Error::NotFound(format!("No job: {job_id}")));
            }
            self.jobs
                .iter()
                .find(|j| j.id == job_id)
                .cloned()
                .ok_or_else(|| Error::NotFound(format!("No job: {job_id}")))
        }

        async fn cancel_job(&self, job_id: &str) -> CResult<()> {
            if self.fail_ops {
                return Err(Error::NotFound(format!("No active job: {job_id}")));
            }
            Ok(())
        }

        async fn update_job_status(
            &self,
            _: &str,
            _: JobStatus,
            _: Option<f64>,
            _: Option<&str>,
        ) -> CResult<()> {
            if self.fail_update_job_status {
                return Err(Error::Unknown("update_job_status failed".into()));
            }
            Ok(())
        }

        async fn create_backup(&self, _label: Option<&str>) -> CResult<BackupMetadata> {
            if self.fail_ops {
                return Err(Error::Unknown("backup failed".into()));
            }
            Ok(make_backup("new-backup.db"))
        }

        async fn list_backups(&self) -> CResult<Vec<BackupMetadata>> {
            if self.fail_ops {
                return Err(Error::Unknown("list failed".into()));
            }
            Ok(self.backups.clone())
        }

        async fn delete_backup(&self, id: &str) -> CResult<()> {
            if self.fail_ops {
                return Err(Error::NotFound(format!("No backup: {id}")));
            }
            Ok(())
        }

        async fn restore_backup(&self, id: &str) -> CResult<()> {
            if self.fail_ops {
                return Err(Error::NotFound(format!("No backup: {id}")));
            }
            Ok(())
        }

        async fn prune_backups(&self, _max: u32) -> CResult<usize> {
            if self.fail_ops {
                return Err(Error::Unknown("prune failed".into()));
            }
            Ok(2)
        }

        async fn set_secret(&self, _key: &str, _value: &str) -> CResult<()> {
            if self.fail_ops {
                return Err(Error::Unknown("set failed".into()));
            }
            Ok(())
        }

        async fn get_secret(&self, key: &str) -> CResult<String> {
            if self.fail_ops {
                return Err(Error::NotFound(format!("No secret: {key}")));
            }
            Ok(self
                .secrets
                .get(key)
                .cloned()
                .unwrap_or_else(|| "test-value".to_string()))
        }

        async fn delete_secret(&self, _key: &str) -> CResult<()> {
            if self.fail_ops {
                return Err(Error::Unknown("delete failed".into()));
            }
            Ok(())
        }

        fn log_path(&self) -> String {
            self.log_path_val.clone()
        }
        fn data_dir(&self) -> Option<String> {
            self.data_dir_val.clone()
        }
    }

    #[tokio::test]
    async fn test_no_subcommand_returns_exit() {
        let args = CliArgs {
            json: false,
            command: None,
        };
        assert_eq!(run_cli(&MockContext::new(), &args).await, CliResult::Exit);
    }

    #[tokio::test]
    async fn test_jobs_list_success() {
        let ctx = MockContext::new().with_jobs(vec![make_job("j1", JobStatus::Pending)]);
        let args = CliArgs {
            json: false,
            command: Some(Commands::Jobs {
                command: JobsCommands::List { status: None },
            }),
        };
        assert_eq!(run_cli(&ctx, &args).await, CliResult::Exit);
    }

    #[tokio::test]
    async fn test_jobs_list_json() {
        let ctx = MockContext::new().with_jobs(vec![make_job("j1", JobStatus::Pending)]);
        let args = CliArgs {
            json: true,
            command: Some(Commands::Jobs {
                command: JobsCommands::List { status: None },
            }),
        };
        assert_eq!(run_cli(&ctx, &args).await, CliResult::Exit);
    }

    #[tokio::test]
    async fn test_jobs_cancel_success() {
        let ctx = MockContext::new();
        let args = CliArgs {
            json: false,
            command: Some(Commands::Jobs {
                command: JobsCommands::Cancel {
                    id: "job1".to_string(),
                },
            }),
        };
        assert_eq!(run_cli(&ctx, &args).await, CliResult::Exit);
    }

    #[tokio::test]
    async fn test_jobs_cancel_json_success() {
        let ctx = MockContext::new();
        let args = CliArgs {
            json: true,
            command: Some(Commands::Jobs {
                command: JobsCommands::Cancel {
                    id: "job1".to_string(),
                },
            }),
        };
        assert_eq!(run_cli(&ctx, &args).await, CliResult::Exit);
    }

    #[tokio::test]
    async fn test_jobs_cancel_fail_cancel() {
        let ctx = MockContext::new().with_failure();
        let args = CliArgs {
            json: false,
            command: Some(Commands::Jobs {
                command: JobsCommands::Cancel {
                    id: "job1".to_string(),
                },
            }),
        };
        let res = run_cli(&ctx, &args).await;
        match res {
            CliResult::Error(e) => assert!(e.contains("Error cancelling job")),
            _ => panic!("Expected Error"),
        }
    }

    #[tokio::test]
    async fn test_jobs_cancel_fail_update_status() {
        let ctx = MockContext::new().with_fail_update_status();
        let args = CliArgs {
            json: false,
            command: Some(Commands::Jobs {
                command: JobsCommands::Cancel {
                    id: "job1".to_string(),
                },
            }),
        };
        let res = run_cli(&ctx, &args).await;
        match res {
            CliResult::Error(e) => {
                assert!(e.contains("JobsCommands::Cancel"));
                assert!(e.contains("ctx.cancel_job"));
                assert!(e.contains("ctx.update_job_status"));
                assert!(e.contains("JobStatus::Cancelled"));
                assert!(e.contains("json_format"));
            }
            _ => panic!("Expected Error"),
        }
    }
}
