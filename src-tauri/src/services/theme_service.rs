// SPDX-License-Identifier: MIT
use std::process::Command;
use std::time::Duration;
use wait_timeout::ChildExt;

/// Freedesktop portal color-scheme values.
/// - 0: No preference
/// - 1: Prefer dark
/// - 2: Prefer light
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorScheme {
    NoPreference,
    Dark,
    Light,
}

impl ColorScheme {
    fn from_portal_value(val: u32) -> Self {
        match val {
            1 => Self::Dark,
            2 => Self::Light,
            _ => Self::NoPreference,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Dark => "dark",
            Self::Light => "light",
            Self::NoPreference => "no-preference",
        }
    }
}

/// Thread-safe state to hold the theme watcher child process for cleanup on exit.
pub struct ThemeWatcherState {
    pub child: std::sync::Mutex<Option<std::process::Child>>,
}

/// Queries the Freedesktop portal for the current color-scheme preference.
/// Returns `None` if the portal is unavailable (non-Linux, no D-Bus, etc.).
pub fn query_freedesktop_color_scheme() -> Option<ColorScheme> {
    let mut cmd = crate::util::new_system_command("gdbus");
    cmd.args([
        "call",
        "--session",
        "--dest=org.freedesktop.portal.Desktop",
        "--object-path=/org/freedesktop/portal/desktop",
        "--method=org.freedesktop.portal.Settings.Read",
        "org.freedesktop.appearance",
        "color-scheme",
    ]);
    query_color_scheme_internal(cmd, Duration::from_secs(1))
}

fn query_color_scheme_internal(mut cmd: Command, timeout: Duration) -> Option<ColorScheme> {
    let mut child = cmd
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .ok()?;

    match child.wait_timeout(timeout) {
        Ok(Some(_status)) => {}
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
    }

    let output = child.wait_with_output().ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_color_scheme_response(&stdout)
}

/// Parses the `gdbus call` output for color-scheme.
/// Format is typically: `(<<uint32 1>>,)` or `(<<1>>,)`
fn parse_color_scheme_response(response: &str) -> Option<ColorScheme> {
    // Extract the innermost integer value from nested variant wrappers.
    // The response looks like: (<<uint32 1>>,) or (<<1>>,)
    let trimmed = response.trim();

    // Try to find "uint32 N" first
    if let Some(pos) = trimmed.find("uint32 ") {
        let after = &trimmed[pos + 7..];
        let num_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(val) = num_str.parse::<u32>() {
            return Some(ColorScheme::from_portal_value(val));
        }
    }

    // Fallback: find the last digit in the string (handles formats like (<<1>>,))
    for ch in trimmed.chars().rev() {
        if ch.is_ascii_digit()
            && let Some(val) = ch.to_digit(10)
        {
            return Some(ColorScheme::from_portal_value(val));
        }
    }

    None
}

/// Spawns a background task that monitors the Freedesktop portal for
/// color-scheme changes via `gdbus monitor` and emits a Tauri event
/// (`system-theme-changed`) whenever the value changes.
pub fn spawn_theme_watcher<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>) {
    use tauri::Emitter;
    use tauri::Manager;

    std::thread::spawn(move || {
        let mut cmd = crate::util::new_system_command("gdbus");
        cmd.args([
            "monitor",
            "--session",
            "--dest=org.freedesktop.portal.Desktop",
            "--object-path=/org/freedesktop/portal/desktop",
        ]);
        let child = cmd
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn();

        let mut child = match child {
            Ok(c) => c,
            Err(e) => {
                log::warn!("Failed to spawn gdbus monitor for theme changes: {e}");
                return;
            }
        };

        let stdout = match child.stdout.take() {
            Some(s) => s,
            None => {
                log::warn!("Failed to capture gdbus monitor stdout");
                return;
            }
        };

        if let Some(state) = app_handle.try_state::<ThemeWatcherState>()
            && let Ok(mut lock) = state.child.lock()
        {
            *lock = Some(child);
        }

        use std::io::BufRead;
        let reader = std::io::BufReader::new(stdout);

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };

            // Filter for color-scheme setting changes
            if !line.contains("org.freedesktop.appearance") || !line.contains("color-scheme") {
                continue;
            }

            if let Some(scheme) = parse_color_scheme_response(&line) {
                log::info!("System theme changed: {}", scheme.as_str());
                let _ = app_handle.emit("system-theme-changed", scheme.as_str());
            }
        }

        // Clean up the child process
        if let Some(state) = app_handle.try_state::<ThemeWatcherState>()
            && let Ok(mut lock) = state.child.lock()
            && let Some(mut c) = lock.take()
        {
            let _ = c.kill();
            let _ = c.wait();
        }
    });
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_color_scheme_dark() {
        let response = "(<<uint32 1>>,)";
        let result = parse_color_scheme_response(response);
        assert_eq!(result, Some(ColorScheme::Dark));
    }

    #[test]
    fn test_parse_color_scheme_light() {
        let response = "(<<uint32 2>>,)";
        let result = parse_color_scheme_response(response);
        assert_eq!(result, Some(ColorScheme::Light));
    }

    #[test]
    fn test_parse_color_scheme_no_preference() {
        let response = "(<<uint32 0>>,)";
        let result = parse_color_scheme_response(response);
        assert_eq!(result, Some(ColorScheme::NoPreference));
    }

    #[test]
    fn test_parse_color_scheme_compact_format() {
        let response = "(<<1>>,)";
        let result = parse_color_scheme_response(response);
        assert_eq!(result, Some(ColorScheme::Dark));
    }

    #[test]
    fn test_parse_color_scheme_empty() {
        let response = "";
        let result = parse_color_scheme_response(response);
        assert_eq!(result, None);
    }

    #[test]
    fn test_parse_color_scheme_gdbus_monitor_line() {
        // Real gdbus monitor output line
        let line = "/org/freedesktop/portal/desktop: org.freedesktop.portal.Settings.SettingChanged ('org.freedesktop.appearance', 'color-scheme', <<uint32 1>>)";
        let result = parse_color_scheme_response(line);
        assert_eq!(result, Some(ColorScheme::Dark));
    }

    #[test]
    fn test_color_scheme_as_str() {
        assert_eq!(ColorScheme::Dark.as_str(), "dark");
        assert_eq!(ColorScheme::Light.as_str(), "light");
        assert_eq!(ColorScheme::NoPreference.as_str(), "no-preference");
    }

    #[test]
    fn test_query_color_scheme_spawn_failure() {
        let cmd = Command::new("non_existent_command_xyz_123");
        let result = query_color_scheme_internal(cmd, Duration::from_secs(1));
        assert_eq!(result, None);
    }

    #[test]
    fn test_query_color_scheme_success() {
        let mut cmd = Command::new("echo");
        cmd.arg("(<<uint32 1>>,)");
        let result = query_color_scheme_internal(cmd, Duration::from_secs(1));
        assert_eq!(result, Some(ColorScheme::Dark));
    }

    #[test]
    fn test_query_color_scheme_timeout() {
        let mut cmd = Command::new("sleep");
        cmd.arg("5");
        let start = std::time::Instant::now();
        let result = query_color_scheme_internal(cmd, Duration::from_millis(100));
        let elapsed = start.elapsed();
        assert_eq!(result, None);
        assert!(elapsed < Duration::from_secs(2));
    }
}
