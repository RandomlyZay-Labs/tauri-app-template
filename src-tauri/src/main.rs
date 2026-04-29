// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::path::PathBuf;

use tauri_app_template_lib::{run_app, util};

fn main() {
    let _ = fix_path_env::fix();

    // ---------------------------------------------------------
    // 1. GENERATE BINDINGS (Dev Only)
    // ---------------------------------------------------------
    #[cfg(debug_assertions)]
    {
        use specta_typescript::{BigIntExportBehavior, Typescript};
        use std::fs;
        use tauri_app_template_lib::api;

        let builder = api::collect();
        let ts_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/bindings.ts");

        let ts_config = Typescript::default().bigint(BigIntExportBehavior::BigInt);

        match builder.export_str(&ts_config) {
            Ok(mut content) => {
                content.push_str("\n;(() => { TAURI_CHANNEL; __makeEvents__; })();");
                let _ = fs::write(&ts_path, content);
            }
            Err(e) => log::error!("Bindings gen error: {}", e),
        }

        // Catch the env var and kill the process right after generating the bindings
        if env::var("TAURI_GEN_BINDINGS_ONLY").is_ok() {
            log::info!("✅ Bindings generated. Exiting...");
            std::process::exit(0);
        }
    }

    // ---------------------------------------------------------
    // 2. RESOLVE DATA DIRECTORY
    // ---------------------------------------------------------
    // In Dev: respects env var (defaults to "dev_data")
    // In Prod: uses standard OS data dir + Folder Name
    let data_dir = if let Ok(dev_path_str) = env::var("TAURI_APP_TEMPLATE_DATA_DIR") {
        util::resolve_dev_data_dir(dev_path_str)
    } else {
        util::resolve_os_app_data_dir().join(util::DATA_FOLDER_NAME)
    };

    // ---------------------------------------------------------
    // 3. LIFECYCLE CHECKS (Reset / Restore)
    // ---------------------------------------------------------

    // Check for factory reset
    util::check_and_perform_reset(&data_dir);

    // Check for database restore
    util::check_and_perform_restore(&data_dir);

    // ---------------------------------------------------------
    // 4. RUN APP
    // ---------------------------------------------------------
    run_app(Some(data_dir));
}
