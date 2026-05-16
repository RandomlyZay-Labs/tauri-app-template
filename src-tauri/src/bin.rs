use std::env;
use std::process::{Command, Stdio};

fn main() {
    if let Err(e) = run() {
        eprintln!("CLI Wrapper Error: {e}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().skip(1).collect();
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe.parent().ok_or("Failed to get exe directory")?;
    
    // Check if we are in a 'bin' subdirectory (installed state)
    let mut target_exe = exe_dir.join("tauri-app-template.exe");
    if !target_exe.exists() {
        // Try parent directory (installed state where proxy is in $INSTDIR/bin/)
        if let Some(parent) = exe_dir.parent() {
            target_exe = parent.join("tauri-app-template.exe");
        }
    }

    if !target_exe.exists() {
        return Err("Could not find tauri-app-template.exe next to or above the CLI wrapper.".into());
    }

    let mut child = Command::new(target_exe)
        .args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()?;

    let status = child.wait()?;
    std::process::exit(status.code().unwrap_or(0));
}
