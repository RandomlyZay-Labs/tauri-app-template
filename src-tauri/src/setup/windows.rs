#[cfg(windows)]
use windows::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};

/// Attaches the process to the console of the parent process.
/// This is required for CLI output on Windows when the app is compiled with
/// `windows_subsystem = "windows"`.
#[cfg(windows)]
#[allow(unsafe_code)]
pub fn attach_console() {
    unsafe {
        // Attempt to attach to the parent process's console
        let _ = AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

#[cfg(not(windows))]
pub fn attach_console() {}

/// Writes an Enter key event directly into the attached console's input buffer.
/// This restores the shell prompt after a GUI-subsystem process exits.
///
/// Unlike `SendInput` (which targets the global foreground window), this writes
/// to the `CONIN$` handle so it is safe for piped output, redirection, scripted
/// chains, and CI environments.
#[cfg(windows)]
#[allow(unsafe_code)]
pub fn simulate_enter_key() {
    use std::mem;
    use windows::Win32::System::Console::{
        WriteConsoleInputW, INPUT_RECORD, KEY_EVENT, KEY_EVENT_RECORD,
    };
    use windows::Win32::Foundation::HANDLE;
    use windows::core::PCWSTR;

    unsafe {
        // Open the console input buffer directly — this handle is valid even
        // when stdout/stderr are redirected (pipes, files).
        let name: Vec<u16> = "CONIN$\0".encode_utf16().collect();
        let handle = windows::Win32::Storage::FileSystem::CreateFileW(
            PCWSTR(name.as_ptr()),
            (windows::Win32::Storage::FileSystem::FILE_GENERIC_READ
                | windows::Win32::Storage::FileSystem::FILE_GENERIC_WRITE)
                .0,
            windows::Win32::Storage::FileSystem::FILE_SHARE_READ
                | windows::Win32::Storage::FileSystem::FILE_SHARE_WRITE,
            None,
            windows::Win32::Storage::FileSystem::OPEN_EXISTING,
            windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL,
            HANDLE::default(),
        );

        let Ok(conin) = handle else {
            return;
        };

        let mut key: KEY_EVENT_RECORD = mem::zeroed();
        key.bKeyDown = true.into();
        key.wRepeatCount = 1;
        key.uChar.UnicodeChar = b'\r' as u16;

        let mut record: INPUT_RECORD = mem::zeroed();
        record.EventType = KEY_EVENT as u16;
        record.Event.KeyEvent = key;

        let records = [record];
        let mut written: u32 = 0;
        let _ = WriteConsoleInputW(conin, &records, &mut written);

        let _ = windows::Win32::Foundation::CloseHandle(conin);
    }
}

/// No-op on non-Windows platforms.
#[cfg(not(windows))]
pub fn simulate_enter_key() {}
