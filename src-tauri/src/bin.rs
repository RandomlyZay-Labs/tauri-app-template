#![allow(clippy::expect_used)]
use clap::Parser;
use tauri_app_template_lib::cli::{CliArgs, StandaloneContext, CliResult, run_cli};
use tauri_app_template_lib::services::job_service::JobManager;
use tauri_app_template_lib::services::download_service::DownloadManager;

#[tokio::main]
async fn main() {
    let args = CliArgs::parse();
    
    // Resolve data dir (mirrors Tauri's default logic for the app identifier)
    let data_dir = if let Ok(val) = std::env::var("TAURI_APP_TEMPLATE_DATA_DIR") {
        tauri_app_template_lib::util::resolve_dev_data_dir(val)
    } else {
        // Standard Tauri formula: {base_data_dir}/{identifier}
        let identifier = "io.github.randomlyzay-labs.tauri-app-template";
        dirs::data_dir()
            .expect("Failed to resolve base data directory")
            .join(identifier)
    };

    let log_dir = data_dir.join("logs");

    let db_pool = tauri_app_template_lib::setup::database::init(Some(&data_dir))
        .await
        .expect("Failed to initialize database");

    let ctx = StandaloneContext {
        version: env!("CARGO_PKG_VERSION").to_string(),
        product_name: "Tauri App Template".to_string(),
        job_manager: JobManager::new(db_pool.clone()),
        download_manager: DownloadManager::new(3),
        db: db_pool,
        data_dir,
        log_dir,
    };

    match run_cli(&ctx, &args).await {
        CliResult::Exit => {}
        CliResult::Error(msg) => {
            eprintln!("{msg}");
            std::process::exit(1);
        }
    }
}
