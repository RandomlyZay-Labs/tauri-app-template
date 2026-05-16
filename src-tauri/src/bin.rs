use std::env;
use std::process::{Command, Stdio};

fn main() {
    if let Err(e) = run() {
        eprintln!("CLI Wrapper Error: {e}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    // Collect all arguments passed to this wrapper, excluding the wrapper's own path.
    let args: Vec<String> = env::args().skip(1).collect();

    // The CLI wrapper (this binary) will be named tauri-app-template.com and 
    // live in the same directory as tauri-app-template.exe.
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe.parent().ok_or("Failed to get exe directory")?;
    
    // We target the main GUI binary which contains the actual logic.
    let target_exe = exe_dir.join("tauri-app-template.exe");

    // Spawn the main application as a child process.
    // By inheriting stdin/stdout/stderr, we ensure that the parent console
    // correctly handles the I/O of the GUI app's CLI mode.
    let mut child = Command::new(target_exe)
        .args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()?;

    // Wait for the main application to finish and exit with the same status code.
    let status = child.wait()?;
    std::process::exit(status.code().unwrap_or(0));
}
