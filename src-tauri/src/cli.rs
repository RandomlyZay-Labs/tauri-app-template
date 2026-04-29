use crate::services::backup_service::BackupMetadata;
use crate::services::job_service::{JobRow, JobStatus};
use tauri::AppHandle;
use tauri_plugin_cli::Matches;
use serde_json::json;

// ---------------------------------------------------------------------------
// Context trait — lets us swap out the Tauri AppHandle in tests
// ---------------------------------------------------------------------------

pub(crate) trait CliContext {
    fn version(&self) -> String;
    fn product_name(&self) -> String;
    fn list_jobs(&self, status_filter: Option<&str>) -> crate::error::CResult<Vec<JobRow>>;
    fn get_job(&self, job_id: &str) -> crate::error::CResult<JobRow>;
    fn cancel_job(&self, job_id: &str) -> crate::error::CResult<()>;
    fn update_job_status(
        &self,
        job_id: &str,
        status: JobStatus,
        progress: Option<f64>,
        message: Option<&str>,
    ) -> crate::error::CResult<()>;
    fn submit_download(&self, url: &str, dest_dir: &str, filename: Option<&str>) -> crate::error::CResult<JobRow>;
    fn cancel_download(&self, download_id: &str) -> crate::error::CResult<()>;
    fn list_active_downloads(&self) -> crate::error::CResult<Vec<String>>;
    fn create_backup(&self, label: Option<&str>) -> crate::error::CResult<BackupMetadata>;
    fn list_backups(&self) -> crate::error::CResult<Vec<BackupMetadata>>;
    fn delete_backup(&self, backup_id: &str) -> crate::error::CResult<()>;
    fn restore_backup(&self, backup_id: &str) -> crate::error::CResult<()>;
    fn prune_backups(&self, max_backups: u32) -> crate::error::CResult<usize>;
    fn set_secret(&self, key: &str, value: &str) -> crate::error::CResult<()>;
    fn get_secret(&self, key: &str) -> crate::error::CResult<String>;
    fn delete_secret(&self, key: &str) -> crate::error::CResult<()>;
    fn log_path(&self) -> String;
    fn data_dir(&self) -> Option<String>;
}

// ---------------------------------------------------------------------------
// Real AppHandle implementation
// ---------------------------------------------------------------------------

struct AppContext<'a>(&'a AppHandle);

impl CliContext for AppContext<'_> {
    fn version(&self) -> String {
        self.0.config().version.clone().unwrap_or_default()
    }

    fn product_name(&self) -> String {
        self.0.config().product_name.clone().unwrap_or_default()
    }

    fn list_jobs(&self, status_filter: Option<&str>) -> crate::error::CResult<Vec<JobRow>> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        tauri::async_runtime::block_on(state.job_manager.list_jobs(status_filter))
    }

    fn get_job(&self, job_id: &str) -> crate::error::CResult<JobRow> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        tauri::async_runtime::block_on(state.job_manager.get_job(job_id))
    }

    fn cancel_job(&self, job_id: &str) -> crate::error::CResult<()> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        tauri::async_runtime::block_on(state.job_manager.cancel_job(job_id))
    }

    fn update_job_status(
        &self,
        job_id: &str,
        status: JobStatus,
        progress: Option<f64>,
        message: Option<&str>,
    ) -> crate::error::CResult<()> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        tauri::async_runtime::block_on(
            state.job_manager.update_status(job_id, status, progress, message),
        )
    }

    fn submit_download(&self, url: &str, dest_dir: &str, filename: Option<&str>) -> crate::error::CResult<JobRow> {
        use tauri::Manager;
        use crate::services::download_service::DownloadRequest;
        use crate::services::job_service;

        let state = self.0.state::<crate::state::AppState>();
        let request = DownloadRequest {
            url: url.to_string(),
            dest_dir: dest_dir.to_string(),
            filename: filename.map(|s| s.to_string()),
        };

        tauri::async_runtime::block_on(async {
            let job = job_service::spawn_download_job(
                self.0.clone(),
                &state.job_manager,
                &state.download_manager,
                request,
            ).await?;

            // Poll until the job reaches a terminal state to prevent the CLI process from exiting before the download completes.
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                let current = state.job_manager.get_job(&job.id).await?;
                if current.status == crate::services::job_service::JobStatus::Completed
                    || current.status == crate::services::job_service::JobStatus::Failed
                    || current.status == crate::services::job_service::JobStatus::Cancelled
                {
                    break;
                }
            }

            Ok(job)
        })
    }

    fn cancel_download(&self, download_id: &str) -> crate::error::CResult<()> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        tauri::async_runtime::block_on(state.download_manager.cancel_download(download_id))
    }

    fn list_active_downloads(&self) -> crate::error::CResult<Vec<String>> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        Ok(tauri::async_runtime::block_on(state.download_manager.list_active()))
    }

    fn create_backup(&self, label: Option<&str>) -> crate::error::CResult<BackupMetadata> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        let data_dir = state.app_data_dir.as_ref()
            .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
        tauri::async_runtime::block_on(
            crate::services::backup_service::create_backup(&state.db, data_dir, label.map(|s| s.to_string())),
        )
    }

    fn list_backups(&self) -> crate::error::CResult<Vec<BackupMetadata>> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        let data_dir = state.app_data_dir.as_ref()
            .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
        tauri::async_runtime::block_on(crate::services::backup_service::list_backups(data_dir))
    }

    fn delete_backup(&self, backup_id: &str) -> crate::error::CResult<()> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        let data_dir = state.app_data_dir.as_ref()
            .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
        tauri::async_runtime::block_on(crate::services::backup_service::delete_backup(data_dir, backup_id.to_string()))
    }

    fn restore_backup(&self, backup_id: &str) -> crate::error::CResult<()> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        let data_dir = state.app_data_dir.as_ref()
            .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
        tauri::async_runtime::block_on(crate::services::backup_service::prepare_restore(data_dir, backup_id.to_string()))
    }

    fn prune_backups(&self, max_backups: u32) -> crate::error::CResult<usize> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        let data_dir = state.app_data_dir.as_ref()
            .ok_or_else(|| crate::error::Error::Unknown("Data directory not initialized".into()))?;
        tauri::async_runtime::block_on(crate::services::backup_service::prune_backups(data_dir, max_backups))
    }

    fn set_secret(&self, key: &str, value: &str) -> crate::error::CResult<()> {
        crate::services::security_service::set_secret(key, value)
    }

    fn get_secret(&self, key: &str) -> crate::error::CResult<String> {
        crate::services::security_service::get_secret(key)
    }

    fn delete_secret(&self, key: &str) -> crate::error::CResult<()> {
        crate::services::security_service::delete_secret(key)
    }

    fn log_path(&self) -> String {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        state.log_dir.to_string_lossy().to_string()
    }

    fn data_dir(&self) -> Option<String> {
        use tauri::Manager;
        let state = self.0.state::<crate::state::AppState>();
        state.app_data_dir.as_ref().map(|p| p.to_string_lossy().to_string())
    }
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq)]
pub(crate) enum CliResult {
    Exit,
    Continue,
    Error(String),
}

// ---------------------------------------------------------------------------
// Pure routing logic (testable)
// ---------------------------------------------------------------------------

pub(crate) fn run_cli(ctx: &impl CliContext, matches: &Matches) -> CliResult {
    if let Some(help_arg) = matches.args.get("help") {
        if let Some(help_text) = help_arg.value.as_str() {
            print!("{help_text}");
        }
        return CliResult::Exit;
    }

    if matches.args.contains_key("version") {
        println!("{} v{}", ctx.product_name(), ctx.version());
        return CliResult::Exit;
    }

    let json_format = matches
        .args
        .get("json")
        .map(|a| a.occurrences > 0)
        .unwrap_or(false);

    if let Some(sub) = &matches.subcommand {
        match sub.name.as_str() {
            "jobs" => run_jobs_cli(ctx, &sub.matches, json_format),
            "download" => run_download_cli(ctx, &sub.matches, json_format),
            "backup" => run_backup_cli(ctx, &sub.matches, json_format),
            "secret" => run_secret_cli(ctx, &sub.matches, json_format),
            "info" => run_info_cli(ctx, &sub.matches, json_format),
            _ => CliResult::Error(format!("Error: unrecognized subcommand '{}'", sub.name)),
        }
    } else if json_format {
        CliResult::Error("Error: The --json flag requires a subcommand.".to_string())
    } else {
        CliResult::Continue
    }
}

fn run_jobs_cli(ctx: &impl CliContext, matches: &Matches, json_format: bool) -> CliResult {
    let Some(sub) = &matches.subcommand else {
        return CliResult::Error(
            "Error: 'jobs' requires a subcommand. Try 'jobs list', 'jobs get', or 'jobs cancel'.".to_string(),
        );
    };

    match sub.name.as_str() {
        "list" => {
            let status_filter = sub.matches.args.get("status").and_then(|a| a.value.as_str()).map(|s| s.to_string());
            match ctx.list_jobs(status_filter.as_deref()) {
                Ok(jobs) => {
                    if json_format {
                        match serde_json::to_string_pretty(&jobs) {
                            Ok(json_str) => println!("{}", json_str),
                            Err(e) => return CliResult::Error(format!("Serialization error: {}", e)),
                        }
                    } else if jobs.is_empty() {
                        println!("No jobs found.");
                    } else {
                        println!("{:<36} | {:<10} | {:<10} | MESSAGE", "ID", "KIND", "STATUS");
                        println!("{}", "-".repeat(80));
                        for job in jobs {
                            println!("{:<36} | {:<10} | {:<10} | {}", job.id, job.kind.as_str(), job.status.as_str(), job.message.unwrap_or_default());
                        }
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error listing jobs: {e}")),
            }
        }
        "get" => {
            let Some(id_arg) = sub.matches.args.get("id").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: Job ID is required.".to_string());
            };
            match ctx.get_job(id_arg) {
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
            }
        }
        "cancel" => {
            let Some(id_arg) = sub.matches.args.get("id").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: Job ID is required.".to_string());
            };
            match ctx.cancel_job(id_arg) {
                Ok(_) => {
                    let _ = ctx.update_job_status(id_arg, JobStatus::Cancelled, None, Some("Cancelled via CLI"));
                    if json_format {
                        println!("{}", json!({ "status": "success", "message": "Job cancelled" }));
                    } else {
                        println!("Job {id_arg} cancelled successfully.");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error cancelling job: {e}")),
            }
        }
        unknown => CliResult::Error(format!("Error: unrecognized subcommand '{unknown}' for 'jobs'")),
    }
}

fn run_download_cli(ctx: &impl CliContext, matches: &Matches, json_format: bool) -> CliResult {
    let Some(sub) = &matches.subcommand else {
        return CliResult::Error(
            "Error: 'download' requires a subcommand. Try 'download submit', 'download cancel', or 'download list'.".to_string(),
        );
    };

    match sub.name.as_str() {
        "submit" => {
            let Some(url) = sub.matches.args.get("url").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: --url is required.".to_string());
            };
            let Some(dest) = sub.matches.args.get("dest").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: --dest is required.".to_string());
            };
            let filename = sub.matches.args.get("filename").and_then(|a| a.value.as_str());

            match ctx.submit_download(url, dest, filename) {
                Ok(job) => {
                    if json_format {
                        match serde_json::to_string_pretty(&job) {
                            Ok(json_str) => println!("{}", json_str),
                            Err(e) => return CliResult::Error(format!("Serialization error: {}", e)),
                        }
                    } else {
                        println!("Download submitted.");
                        println!("  Job ID: {}", job.id);
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error submitting download: {e}")),
            }
        }
        "cancel" => {
            let Some(id_arg) = sub.matches.args.get("id").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: Download ID is required.".to_string());
            };
            match ctx.cancel_download(id_arg) {
                Ok(_) => {
                    if json_format {
                        println!("{}", json!({ "status": "success", "message": "Download cancelled" }));
                    } else {
                        println!("Download {id_arg} cancelled.");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error cancelling download: {e}")),
            }
        }
        "list" => {
            match ctx.list_active_downloads() {
                Ok(ids) => {
                    if json_format {
                        match serde_json::to_string_pretty(&ids) {
                            Ok(json_str) => println!("{}", json_str),
                            Err(e) => return CliResult::Error(format!("Serialization error: {}", e)),
                        }
                    } else if ids.is_empty() {
                        println!("No active downloads.");
                    } else {
                        println!("Active downloads:");
                        for id in ids {
                            println!("  {id}");
                        }
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error listing downloads: {e}")),
            }
        }
        unknown => CliResult::Error(format!("Error: unrecognized subcommand '{unknown}' for 'download'")),
    }
}

fn run_backup_cli(ctx: &impl CliContext, matches: &Matches, json_format: bool) -> CliResult {
    let Some(sub) = &matches.subcommand else {
        return CliResult::Error(
            "Error: 'backup' requires a subcommand. Try 'backup create', 'backup list', 'backup delete', 'backup restore', or 'backup prune'.".to_string(),
        );
    };

    match sub.name.as_str() {
        "create" => {
            let label = sub.matches.args.get("label").and_then(|a| a.value.as_str());
            match ctx.create_backup(label) {
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
            }
        }
        "list" => {
            match ctx.list_backups() {
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
                            println!("{:<40} | {:<10} | {:<8} | {}", b.id, b.label.unwrap_or_default(), b.size_bytes, b.created_at);
                        }
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error listing backups: {e}")),
            }
        }
        "delete" => {
            let Some(id_arg) = sub.matches.args.get("id").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: Backup ID is required.".to_string());
            };
            match ctx.delete_backup(id_arg) {
                Ok(_) => {
                    if json_format {
                        println!("{}", json!({ "status": "success", "message": "Backup deleted" }));
                    } else {
                        println!("Backup {id_arg} deleted.");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error deleting backup: {e}")),
            }
        }
        "restore" => {
            let Some(id_arg) = sub.matches.args.get("id").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: Backup ID is required.".to_string());
            };
            match ctx.restore_backup(id_arg) {
                Ok(_) => {
                    if json_format {
                        println!("{}", json!({ "status": "success", "message": "Restore prepared. Restart to apply." }));
                    } else {
                        println!("Restore prepared from backup {id_arg}. Restart the application to apply.");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error restoring backup: {e}")),
            }
        }
        "prune" => {
            let max: u32 = sub.matches.args.get("max")
                .and_then(|a| a.value.as_str())
                .and_then(|s| s.parse().ok())
                .unwrap_or(5);
            match ctx.prune_backups(max) {
                Ok(count) => {
                    if json_format {
                        println!("{}", json!({ "status": "success", "pruned": count }));
                    } else {
                        println!("Pruned {count} old backup(s). Keeping up to {max}.");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error pruning backups: {e}")),
            }
        }
        unknown => CliResult::Error(format!("Error: unrecognized subcommand '{unknown}' for 'backup'")),
    }
}

fn run_secret_cli(ctx: &impl CliContext, matches: &Matches, json_format: bool) -> CliResult {
    let Some(sub) = &matches.subcommand else {
        return CliResult::Error(
            "Error: 'secret' requires a subcommand. Try 'secret set', 'secret get', or 'secret delete'.".to_string(),
        );
    };

    match sub.name.as_str() {
        "set" => {
            let Some(key) = sub.matches.args.get("key").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: --key is required.".to_string());
            };
            let Some(value) = sub.matches.args.get("value").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: --value is required.".to_string());
            };
            match ctx.set_secret(key, value) {
                Ok(_) => {
                    if json_format {
                        println!("{}", json!({ "status": "success", "message": "Secret stored" }));
                    } else {
                        println!("Secret '{key}' stored.");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error storing secret: {e}")),
            }
        }
        "get" => {
            let Some(key) = sub.matches.args.get("key").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: --key is required.".to_string());
            };
            match ctx.get_secret(key) {
                Ok(val) => {
                    if json_format {
                        println!("{}", json!({ "key": key, "value": val }));
                    } else {
                        println!("{val}");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error retrieving secret: {e}")),
            }
        }
        "delete" => {
            let Some(key) = sub.matches.args.get("key").and_then(|a| a.value.as_str()) else {
                return CliResult::Error("Error: --key is required.".to_string());
            };
            match ctx.delete_secret(key) {
                Ok(_) => {
                    if json_format {
                        println!("{}", json!({ "status": "success", "message": "Secret deleted" }));
                    } else {
                        println!("Secret '{key}' deleted.");
                    }
                    CliResult::Exit
                }
                Err(e) => CliResult::Error(format!("Error deleting secret: {e}")),
            }
        }
        unknown => CliResult::Error(format!("Error: unrecognized subcommand '{unknown}' for 'secret'")),
    }
}

fn run_info_cli(ctx: &impl CliContext, matches: &Matches, json_format: bool) -> CliResult {
    let Some(sub) = &matches.subcommand else {
        return CliResult::Error(
            "Error: 'info' requires a subcommand. Try 'info log-path' or 'info data-dir'.".to_string(),
        );
    };

    match sub.name.as_str() {
        "log-path" => {
            let path = ctx.log_path();
            if json_format {
                println!("{}", json!({ "log_path": path }));
            } else {
                println!("{path}");
            }
            CliResult::Exit
        }
        "data-dir" => {
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
        unknown => CliResult::Error(format!("Error: unrecognized subcommand '{unknown}' for 'info'")),
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

pub fn handle_cli(app: &AppHandle, matches: &Matches) -> bool {
    let ctx = AppContext(app);
    match run_cli(&ctx, matches) {
        CliResult::Exit => true,
        CliResult::Continue => false,
        CliResult::Error(msg) => {
            eprintln!("{msg}");
            std::process::exit(1);
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
    use serde_json::Value;
    use std::collections::HashMap;
    use tauri_plugin_cli::{ArgData, Matches, SubcommandMatches};

    fn flag_arg(present: bool) -> ArgData {
        let mut a = ArgData::default();
        a.value = Value::Bool(present);
        a.occurrences = if present { 1 } else { 0 };
        a
    }

    fn string_arg(s: &str) -> ArgData {
        let mut a = ArgData::default();
        a.value = Value::String(s.to_string());
        a.occurrences = 1;
        a
    }

    fn empty_matches() -> Matches { Matches::default() }

    fn matches_with_args(args: HashMap<String, ArgData>) -> Matches {
        let mut m = Matches::default();
        m.args = args;
        m
    }

    fn matches_with_subcommand(name: &str, sub_matches: Matches) -> Matches {
        let mut sub = SubcommandMatches::default();
        sub.name = name.to_string();
        sub.matches = sub_matches;
        let mut m = Matches::default();
        m.subcommand = Some(Box::new(sub));
        m
    }

    fn matches_with_args_and_subcommand(args: HashMap<String, ArgData>, sub_name: &str, sub_matches: Matches) -> Matches {
        let mut sub = SubcommandMatches::default();
        sub.name = sub_name.to_string();
        sub.matches = sub_matches;
        let mut m = Matches::default();
        m.args = args;
        m.subcommand = Some(Box::new(sub));
        m
    }

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
            }
        }
        fn with_jobs(mut self, jobs: Vec<JobRow>) -> Self { self.jobs = jobs; self }
        fn with_backups(mut self, backups: Vec<BackupMetadata>) -> Self { self.backups = backups; self }
        fn with_downloads(mut self, downloads: Vec<String>) -> Self { self.downloads = downloads; self }
        fn with_failure(mut self) -> Self { self.fail_ops = true; self }
    }

    impl CliContext for MockContext {
        fn version(&self) -> String { self.version.clone() }
        fn product_name(&self) -> String { self.product_name.clone() }

        fn list_jobs(&self, status_filter: Option<&str>) -> CResult<Vec<JobRow>> {
            if self.fail_ops { return Err(Error::Unknown("list failed".into())); }
            let filtered = self.jobs.iter()
                .filter(|j| status_filter.map(|f| j.status.as_str() == f).unwrap_or(true))
                .cloned().collect();
            Ok(filtered)
        }

        fn get_job(&self, job_id: &str) -> CResult<JobRow> {
            if self.fail_ops { return Err(Error::NotFound(format!("No job: {job_id}"))); }
            self.jobs.iter().find(|j| j.id == job_id).cloned()
                .ok_or_else(|| Error::NotFound(format!("No job: {job_id}")))
        }

        fn cancel_job(&self, job_id: &str) -> CResult<()> {
            if self.fail_ops { return Err(Error::NotFound(format!("No active job: {job_id}"))); }
            Ok(())
        }

        fn update_job_status(&self, _: &str, _: JobStatus, _: Option<f64>, _: Option<&str>) -> CResult<()> { Ok(()) }

        fn submit_download(&self, _url: &str, _dest: &str, _filename: Option<&str>) -> CResult<JobRow> {
            if self.fail_ops { return Err(Error::Unknown("submit failed".into())); }
            Ok(make_job("dl-job-1", JobStatus::Pending))
        }

        fn cancel_download(&self, id: &str) -> CResult<()> {
            if self.fail_ops { return Err(Error::NotFound(format!("No download: {id}"))); }
            Ok(())
        }

        fn list_active_downloads(&self) -> CResult<Vec<String>> {
            if self.fail_ops { return Err(Error::Unknown("list failed".into())); }
            Ok(self.downloads.clone())
        }

        fn create_backup(&self, _label: Option<&str>) -> CResult<BackupMetadata> {
            if self.fail_ops { return Err(Error::Unknown("backup failed".into())); }
            Ok(make_backup("new-backup.db"))
        }

        fn list_backups(&self) -> CResult<Vec<BackupMetadata>> {
            if self.fail_ops { return Err(Error::Unknown("list failed".into())); }
            Ok(self.backups.clone())
        }

        fn delete_backup(&self, id: &str) -> CResult<()> {
            if self.fail_ops { return Err(Error::NotFound(format!("No backup: {id}"))); }
            Ok(())
        }

        fn restore_backup(&self, id: &str) -> CResult<()> {
            if self.fail_ops { return Err(Error::NotFound(format!("No backup: {id}"))); }
            Ok(())
        }

        fn prune_backups(&self, _max: u32) -> CResult<usize> {
            if self.fail_ops { return Err(Error::Unknown("prune failed".into())); }
            Ok(2)
        }

        fn set_secret(&self, _key: &str, _value: &str) -> CResult<()> {
            if self.fail_ops { return Err(Error::Unknown("set failed".into())); }
            Ok(())
        }

        fn get_secret(&self, key: &str) -> CResult<String> {
            if self.fail_ops { return Err(Error::NotFound(format!("No secret: {key}"))); }
            Ok(self.secrets.get(key).cloned().unwrap_or_else(|| "test-value".to_string()))
        }

        fn delete_secret(&self, _key: &str) -> CResult<()> {
            if self.fail_ops { return Err(Error::Unknown("delete failed".into())); }
            Ok(())
        }

        fn log_path(&self) -> String { self.log_path_val.clone() }
        fn data_dir(&self) -> Option<String> { self.data_dir_val.clone() }
    }

    // ---- Top-level routing tests ----

    #[test]
    fn test_help_flag_returns_exit() {
        let ctx = MockContext::new();
        let mut args = HashMap::new();
        args.insert("help".to_string(), string_arg("Usage: app [OPTIONS] [COMMAND]"));
        assert_eq!(run_cli(&ctx, &matches_with_args(args)), CliResult::Exit);
    }

    #[test]
    fn test_version_flag_returns_exit() {
        let ctx = MockContext::new();
        let mut args = HashMap::new();
        args.insert("version".to_string(), flag_arg(true));
        assert_eq!(run_cli(&ctx, &matches_with_args(args)), CliResult::Exit);
    }

    #[test]
    fn test_no_args_continues_to_gui() {
        assert_eq!(run_cli(&MockContext::new(), &empty_matches()), CliResult::Continue);
    }

    #[test]
    fn test_json_flag_without_subcommand_is_error() {
        let mut args = HashMap::new();
        args.insert("json".to_string(), flag_arg(true));
        assert!(matches!(run_cli(&MockContext::new(), &matches_with_args(args)), CliResult::Error(_)));
    }

    #[test]
    fn test_unknown_subcommand_is_error() {
        let result = run_cli(&MockContext::new(), &matches_with_subcommand("unknown-cmd", empty_matches()));
        if let CliResult::Error(msg) = result { assert!(msg.contains("unrecognized subcommand")); } else { panic!("expected error"); }
    }

    // ---- Jobs tests ----

    #[test] fn test_jobs_without_subcommand_is_error() {
        let r = run_cli(&MockContext::new(), &matches_with_subcommand("jobs", empty_matches()));
        assert!(matches!(r, CliResult::Error(_)));
    }

    #[test] fn test_jobs_list_empty() {
        let m = matches_with_subcommand("jobs", matches_with_subcommand("list", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_jobs_list_with_jobs() {
        let ctx = MockContext::new().with_jobs(vec![make_job("j1", JobStatus::Pending)]);
        let m = matches_with_subcommand("jobs", matches_with_subcommand("list", empty_matches()));
        assert_eq!(run_cli(&ctx, &m), CliResult::Exit);
    }

    #[test] fn test_jobs_list_json() {
        let ctx = MockContext::new().with_jobs(vec![make_job("j1", JobStatus::Pending)]);
        let mut top = HashMap::new();
        top.insert("json".to_string(), flag_arg(true));
        let m = matches_with_args_and_subcommand(top, "jobs", matches_with_subcommand("list", empty_matches()));
        assert_eq!(run_cli(&ctx, &m), CliResult::Exit);
    }

    #[test] fn test_jobs_list_error() {
        let ctx = MockContext::new().with_failure();
        let m = matches_with_subcommand("jobs", matches_with_subcommand("list", empty_matches()));
        assert!(matches!(run_cli(&ctx, &m), CliResult::Error(_)));
    }

    #[test] fn test_jobs_get_success() {
        let ctx = MockContext::new().with_jobs(vec![make_job("j1", JobStatus::Running)]);
        let mut args = HashMap::new();
        args.insert("id".to_string(), string_arg("j1"));
        let m = matches_with_subcommand("jobs", matches_with_subcommand("get", matches_with_args(args)));
        assert_eq!(run_cli(&ctx, &m), CliResult::Exit);
    }

    #[test] fn test_jobs_get_missing_id() {
        let m = matches_with_subcommand("jobs", matches_with_subcommand("get", empty_matches()));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_jobs_cancel_success() {
        let ctx = MockContext::new().with_jobs(vec![make_job("j1", JobStatus::Running)]);
        let mut args = HashMap::new();
        args.insert("id".to_string(), string_arg("j1"));
        let m = matches_with_subcommand("jobs", matches_with_subcommand("cancel", matches_with_args(args)));
        assert_eq!(run_cli(&ctx, &m), CliResult::Exit);
    }

    #[test] fn test_jobs_cancel_missing_id() {
        let m = matches_with_subcommand("jobs", matches_with_subcommand("cancel", empty_matches()));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    // ---- Download tests ----

    #[test] fn test_download_without_subcommand_is_error() {
        let r = run_cli(&MockContext::new(), &matches_with_subcommand("download", empty_matches()));
        assert!(matches!(r, CliResult::Error(_)));
    }

    #[test] fn test_download_submit_success() {
        let mut args = HashMap::new();
        args.insert("url".to_string(), string_arg("https://example.com/f.zip"));
        args.insert("dest".to_string(), string_arg("/tmp"));
        let m = matches_with_subcommand("download", matches_with_subcommand("submit", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_download_submit_missing_url() {
        let mut args = HashMap::new();
        args.insert("dest".to_string(), string_arg("/tmp"));
        let m = matches_with_subcommand("download", matches_with_subcommand("submit", matches_with_args(args)));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_download_submit_missing_dest() {
        let mut args = HashMap::new();
        args.insert("url".to_string(), string_arg("https://example.com/f.zip"));
        let m = matches_with_subcommand("download", matches_with_subcommand("submit", matches_with_args(args)));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_download_submit_error() {
        let ctx = MockContext::new().with_failure();
        let mut args = HashMap::new();
        args.insert("url".to_string(), string_arg("https://example.com/f.zip"));
        args.insert("dest".to_string(), string_arg("/tmp"));
        let m = matches_with_subcommand("download", matches_with_subcommand("submit", matches_with_args(args)));
        assert!(matches!(run_cli(&ctx, &m), CliResult::Error(_)));
    }

    #[test] fn test_download_cancel_success() {
        let mut args = HashMap::new();
        args.insert("id".to_string(), string_arg("dl-1"));
        let m = matches_with_subcommand("download", matches_with_subcommand("cancel", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_download_cancel_missing_id() {
        let m = matches_with_subcommand("download", matches_with_subcommand("cancel", empty_matches()));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_download_list_empty() {
        let m = matches_with_subcommand("download", matches_with_subcommand("list", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_download_list_with_items() {
        let ctx = MockContext::new().with_downloads(vec!["dl-1".into(), "dl-2".into()]);
        let m = matches_with_subcommand("download", matches_with_subcommand("list", empty_matches()));
        assert_eq!(run_cli(&ctx, &m), CliResult::Exit);
    }

    // ---- Backup tests ----

    #[test] fn test_backup_without_subcommand_is_error() {
        assert!(matches!(run_cli(&MockContext::new(), &matches_with_subcommand("backup", empty_matches())), CliResult::Error(_)));
    }

    #[test] fn test_backup_create_success() {
        let m = matches_with_subcommand("backup", matches_with_subcommand("create", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_backup_create_with_label() {
        let mut args = HashMap::new();
        args.insert("label".to_string(), string_arg("before-update"));
        let m = matches_with_subcommand("backup", matches_with_subcommand("create", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_backup_create_error() {
        let ctx = MockContext::new().with_failure();
        let m = matches_with_subcommand("backup", matches_with_subcommand("create", empty_matches()));
        assert!(matches!(run_cli(&ctx, &m), CliResult::Error(_)));
    }

    #[test] fn test_backup_list_empty() {
        let m = matches_with_subcommand("backup", matches_with_subcommand("list", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_backup_list_with_items() {
        let ctx = MockContext::new().with_backups(vec![make_backup("b1.db"), make_backup("b2.db")]);
        let m = matches_with_subcommand("backup", matches_with_subcommand("list", empty_matches()));
        assert_eq!(run_cli(&ctx, &m), CliResult::Exit);
    }

    #[test] fn test_backup_delete_success() {
        let mut args = HashMap::new();
        args.insert("id".to_string(), string_arg("b1.db"));
        let m = matches_with_subcommand("backup", matches_with_subcommand("delete", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_backup_delete_missing_id() {
        let m = matches_with_subcommand("backup", matches_with_subcommand("delete", empty_matches()));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_backup_restore_success() {
        let mut args = HashMap::new();
        args.insert("id".to_string(), string_arg("b1.db"));
        let m = matches_with_subcommand("backup", matches_with_subcommand("restore", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_backup_restore_missing_id() {
        let m = matches_with_subcommand("backup", matches_with_subcommand("restore", empty_matches()));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_backup_prune_default() {
        let m = matches_with_subcommand("backup", matches_with_subcommand("prune", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_backup_prune_with_max() {
        let mut args = HashMap::new();
        args.insert("max".to_string(), string_arg("3"));
        let m = matches_with_subcommand("backup", matches_with_subcommand("prune", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    // ---- Secret tests ----

    #[test] fn test_secret_without_subcommand_is_error() {
        assert!(matches!(run_cli(&MockContext::new(), &matches_with_subcommand("secret", empty_matches())), CliResult::Error(_)));
    }

    #[test] fn test_secret_set_success() {
        let mut args = HashMap::new();
        args.insert("key".to_string(), string_arg("api-key"));
        args.insert("value".to_string(), string_arg("abc123"));
        let m = matches_with_subcommand("secret", matches_with_subcommand("set", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_secret_set_missing_key() {
        let mut args = HashMap::new();
        args.insert("value".to_string(), string_arg("abc123"));
        let m = matches_with_subcommand("secret", matches_with_subcommand("set", matches_with_args(args)));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_secret_get_success() {
        let mut args = HashMap::new();
        args.insert("key".to_string(), string_arg("api-key"));
        let m = matches_with_subcommand("secret", matches_with_subcommand("get", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_secret_get_missing_key() {
        let m = matches_with_subcommand("secret", matches_with_subcommand("get", empty_matches()));
        assert!(matches!(run_cli(&MockContext::new(), &m), CliResult::Error(_)));
    }

    #[test] fn test_secret_delete_success() {
        let mut args = HashMap::new();
        args.insert("key".to_string(), string_arg("api-key"));
        let m = matches_with_subcommand("secret", matches_with_subcommand("delete", matches_with_args(args)));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_secret_delete_error() {
        let ctx = MockContext::new().with_failure();
        let mut args = HashMap::new();
        args.insert("key".to_string(), string_arg("api-key"));
        let m = matches_with_subcommand("secret", matches_with_subcommand("delete", matches_with_args(args)));
        assert!(matches!(run_cli(&ctx, &m), CliResult::Error(_)));
    }

    // ---- Info tests ----

    #[test] fn test_info_without_subcommand_is_error() {
        assert!(matches!(run_cli(&MockContext::new(), &matches_with_subcommand("info", empty_matches())), CliResult::Error(_)));
    }

    #[test] fn test_info_log_path() {
        let m = matches_with_subcommand("info", matches_with_subcommand("log-path", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_info_log_path_json() {
        let mut top = HashMap::new();
        top.insert("json".to_string(), flag_arg(true));
        let m = matches_with_args_and_subcommand(top, "info", matches_with_subcommand("log-path", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_info_data_dir() {
        let m = matches_with_subcommand("info", matches_with_subcommand("data-dir", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }

    #[test] fn test_info_data_dir_json() {
        let mut top = HashMap::new();
        top.insert("json".to_string(), flag_arg(true));
        let m = matches_with_args_and_subcommand(top, "info", matches_with_subcommand("data-dir", empty_matches()));
        assert_eq!(run_cli(&MockContext::new(), &m), CliResult::Exit);
    }
}
