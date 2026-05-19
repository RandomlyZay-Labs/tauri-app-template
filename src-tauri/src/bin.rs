use clap::Parser;
use tauri_app_template_lib::cli::{CliArgs, StandaloneContext, CliResult, run_cli};
use tauri_app_template_lib::services::job_service::JobManager;

#[tokio::main]
async fn main() -> std::process::ExitCode {
    let args = CliArgs::parse();
    
    // Resolve data dir (mirrors Tauri's default logic for the app identifier)
    let data_dir = if let Ok(val) = std::env::var("TAURI_APP_TEMPLATE_DATA_DIR") {
        tauri_app_template_lib::util::resolve_dev_data_dir(val)
    } else {
        let identifier = "io.github.randomlyzay-labs.tauri-app-template";
        match dirs::data_dir() {
            Some(dir) => dir.join(identifier),
            None => {
                eprintln!("Error: Failed to resolve base data directory");
                return std::process::ExitCode::from(1);
            }
        }
    };

    let log_dir = data_dir.join("logs");

    let db_pool = match tauri_app_template_lib::setup::database::init(Some(&data_dir)).await {
        Ok(pool) => pool,
        Err(err) => {
            eprintln!("Error: Failed to initialize database: {err}");
            return std::process::ExitCode::from(1);
        }
    };

    if let Err(err) = keyring::use_native_store(true) {
        eprintln!("Error: Failed to initialize native keyring store: {err}");
        return std::process::ExitCode::from(1);
    }

    let ctx = StandaloneContext {
        version: env!("CARGO_PKG_VERSION").to_string(),
        product_name: "Tauri App Template".to_string(),
        job_manager: JobManager::new(db_pool.clone()),
        db: db_pool,
        data_dir,
        log_dir,
    };

    match run_cli(&ctx, &args).await {
        CliResult::Exit => std::process::ExitCode::SUCCESS,
        CliResult::Error(msg) => {
            eprintln!("{msg}");
            std::process::ExitCode::from(1)
        }
    }
}

