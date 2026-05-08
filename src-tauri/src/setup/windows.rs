#[cfg(windows)]
use windows::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};

/// Attaches the process to the console of the parent process.
/// This is required for CLI output on Windows when the app is compiled with
/// `windows_subsystem = "windows"`.
#[cfg(windows)]
pub fn attach_console() {
    unsafe {
        // Attempt to attach to the parent process's console
        let _ = AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

/// No-op on non-Windows platforms.
#[cfg(not(windows))]
pub fn attach_console() {}
