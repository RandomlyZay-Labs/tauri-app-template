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
        eprintln!("Warning: Failed to initialize native keyring store: {err}. Keyring-dependent features will not be available.");
    }

    let ctx = StandaloneContext {
        version: env!("CARGO_PKG_VERSION").to_string(),
        product_name: "Tauri App Template".to_string(),
        job_manager: JobManager::new(db_pool.clone()),
        db: db_pool,
        data_dir: data_dir.clone(),
        log_dir,
    };

    // CLI version gate: check if CLI version matches the app version
    let version_file = data_dir.join("app_version.txt");
    if let Ok(app_version) = std::fs::read_to_string(&version_file) {
        let app_version = app_version.trim();
        let cli_version = env!("CARGO_PKG_VERSION");
        if app_version != cli_version {
            println!("CLI version ({}) does not match the installed app version ({}).", cli_version, app_version);
            print!("Would you like to update the CLI? [Y/n]: ");
            use std::io::{stdin, stdout, Write};
            stdout().flush().ok();
            let mut input = String::new();
            stdin().read_line(&mut input).ok();
            let input = input.trim().to_lowercase();
            if input == "y" || input == "yes" || input.is_empty() {
                let cli_path = match tauri_app_template_lib::services::cli_mgmt_service::CliMgmtService::get_cli_path() {
                    Ok(p) => p,
                    Err(e) => {
                        eprintln!("Error resolving CLI path: {}", e);
                        return std::process::ExitCode::from(1);
                    }
                };
                match tauri_app_template_lib::services::cli_update_service::update_cli_standalone(app_version, &cli_path).await {
                    Ok(_) => {
                        println!("CLI updated successfully! Please re-run your command.");
                        return std::process::ExitCode::SUCCESS;
                    }
                    Err(e) => {
                        eprintln!("Failed to update CLI: {}", e);
                        return std::process::ExitCode::from(1);
                    }
                }
            } else {
                eprintln!("CLI version mismatch. Exiting.");
                return std::process::ExitCode::from(1);
            }
        }
    }

    match run_cli(&ctx, &args).await {
        CliResult::Exit => std::process::ExitCode::SUCCESS,
        CliResult::Error(msg) => {
            eprintln!("{msg}");
            std::process::ExitCode::from(1)
        }
    }
}

