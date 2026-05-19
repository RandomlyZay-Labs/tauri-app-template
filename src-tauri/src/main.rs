#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// DEBUG_VERSION: 1.0.2
use std::env;

use tauri_app_template_lib::{run_app, util};

fn trace(msg: &str) {
    if let Ok(temp_dir) = std::env::var("TEMP") {
        let path = std::path::Path::new(&temp_dir).join("tauri_launch_trace.txt");
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            use std::io::Write;
            let _ = writeln!(file, "[MAIN] TRACE: {}", msg);
        }
    }
}

fn main() {
    trace("main started");
    let _ = fix_path_env::fix();
    trace("fix_path_env called");

    // ---------------------------------------------------------
    // 1. GENERATE BINDINGS (Dev Only)
    // ---------------------------------------------------------
    #[cfg(debug_assertions)]
    {
        use specta_typescript::{BigIntExportBehavior, Typescript};
        use std::fs;
        use std::path::PathBuf;
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
    // 2. RESOLVE DEV DATA DIRECTORY
    // ---------------------------------------------------------
    // In Dev: respects env var (defaults to None, which uses Tauri default)
    let dev_data_dir = env::var("TAURI_APP_TEMPLATE_DATA_DIR")
        .ok()
        .map(util::resolve_dev_data_dir);

    trace("calling run_app");
    run_app(dev_data_dir);
    trace("run_app exited (should not happen in normal GUI run)");
}
