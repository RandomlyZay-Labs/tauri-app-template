use std::process::Command;

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

/// Queries the Freedesktop portal for the current color-scheme preference.
/// Returns `None` if the portal is unavailable (non-Linux, no D-Bus, etc.).
pub fn query_freedesktop_color_scheme() -> Option<ColorScheme> {
    let output = Command::new("gdbus")
        .args([
            "call",
            "--session",
            "--dest=org.freedesktop.portal.Desktop",
            "--object-path=/org/freedesktop/portal/desktop",
            "--method=org.freedesktop.portal.Settings.Read",
            "org.freedesktop.appearance",
            "color-scheme",
        ])
        .output()
        .ok()?;

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

    std::thread::spawn(move || {
        let child = Command::new("gdbus")
            .args([
                "monitor",
                "--session",
                "--dest=org.freedesktop.portal.Desktop",
                "--object-path=/org/freedesktop/portal/desktop",
            ])
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
        let _ = child.kill();
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
}
