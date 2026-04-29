// SPDX-License-Identifier: MIT
use std::env;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-env-changed=POSTHOG_API_KEY");

    // Load .env file if it exists at src-tauri
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    let env_path = Path::new(&manifest_dir).join(".env");

    println!("cargo:rerun-if-changed={}", env_path.display());

    // 1. Resolve POSTHOG_API_KEY from environment or .env
    let mut posthog_key = env::var("POSTHOG_API_KEY").ok();
    
    // Keep track of other loaded .env keys to set cargo:rustc-env
    let mut env_vars = std::collections::HashMap::new();

    if let Ok(file) = File::open(&env_path) {
        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            if let Some((key, val)) = trimmed.split_once('=') {
                let key = key.trim().to_string();
                let val = val.trim().trim_matches('"').trim_matches('\'').to_string();
                if !key.is_empty() {
                    env_vars.insert(key, val);
                }
            }
        }
    }

    if posthog_key.is_none() {
        posthog_key = env_vars.get("POSTHOG_API_KEY")
            .filter(|val| !val.is_empty())
            .cloned();
    }

    // 2. Explicitly set POSTHOG_API_KEY for compiler if we resolved a non-empty one
    if let Some(ref key) = posthog_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            println!("cargo:rustc-env=POSTHOG_API_KEY={}", trimmed);
        }
    }

    // 3. Set cargo:rustc-env for other env vars in .env if not in environment
    let allowed_keys = ["DATABASE_URL"];
    for (key, val) in env_vars {
        if key != "POSTHOG_API_KEY" && allowed_keys.contains(&key.as_str()) && env::var(&key).is_err() {
            println!("cargo:rustc-env={}={}", key, val);
        }
    }

    tauri_build::build()
}

