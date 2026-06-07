#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// DEBUG_VERSION: 1.0.1
use std::env;

use tauri_app_template_lib::{run_app, util};

#[allow(unsafe_code)]
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--compat".to_string()) {
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    let _ = fix_path_env::fix();

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

    // ---------------------------------------------------------
    // 3. RUN APP
    // ---------------------------------------------------------
    run_app(dev_data_dir);
}
