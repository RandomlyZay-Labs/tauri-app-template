use crate::commands;
use crate::services::backup_service::BackupMetadata;
use crate::services::download_service::{
    DownloadProgress, DownloadRequest, DownloadResult, DownloadStatus,
};
use crate::services::job_service::{JobKind, JobProgress, JobRow, JobStatus};
use tauri_specta::{Builder, ErrorHandlingMode, collect_commands};

/// Collects all commands and types for Specta to generate TypeScript bindings.
pub fn collect() -> Builder {
    Builder::new()
        .error_handling(ErrorHandlingMode::Throw)
        .commands(collect_commands![
            commands::system::get_log_path,
            commands::system::export_diagnostics,
            commands::system::get_data_dir,
            commands::system::open_log_dir,
            commands::system::open_data_dir,
            commands::system::reset_application,
            commands::system::set_log_level,
            commands::system::get_version,
            commands::tray::set_tray_settings,
            commands::notification::notify,
            // Backup commands
            commands::backup::create_backup,
            commands::backup::list_backups,
            commands::backup::restore_backup,
            commands::backup::prune_backups,
            commands::backup::delete_backup,
            // Download commands
            commands::download::start_download,
            commands::download::cancel_download,
            commands::download::list_active_downloads,
            // Job commands
            commands::job::list_jobs,
            commands::job::get_job,
            commands::job::cancel_job,
            commands::job::submit_download_job,
            // Security commands
            commands::security::set_secret,
            commands::security::get_secret,
            commands::security::delete_secret,
            // Watcher commands
            commands::watcher::watch_path,
            commands::watcher::unwatch_path,
            // AppImage commands
            commands::appimage::is_appimage,
            commands::appimage::integrate_appimage,
        ])
        .typ::<BackupMetadata>()
        .typ::<DownloadProgress>()
        .typ::<DownloadRequest>()
        .typ::<DownloadResult>()
        .typ::<DownloadStatus>()
        .typ::<JobRow>()
        .typ::<JobProgress>()
        .typ::<JobStatus>()
        .typ::<JobKind>()
}
