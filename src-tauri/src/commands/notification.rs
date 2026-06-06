use crate::error::CResult;
use async_trait::async_trait;
use tauri::Manager;

#[async_trait]
pub trait NotificationService: Send + Sync {
    async fn show(&self, title: &str, body: &str) -> CResult<()>;
}

pub struct RealNotificationService<R: tauri::Runtime> {
    app: tauri::AppHandle<R>,
}

impl<R: tauri::Runtime> RealNotificationService<R> {
    pub fn new(app: tauri::AppHandle<R>) -> Self {
        Self { app }
    }
}

#[async_trait]
impl<R: tauri::Runtime> NotificationService for RealNotificationService<R> {
    async fn show(&self, title: &str, body: &str) -> CResult<()> {
        log::info!(
            "[Backend] RealNotificationService::show: {} - {}",
            title,
            body
        );

        // 1. Tauri Plugin attempt
        if let Some(n) = self
            .app
            .try_state::<tauri_plugin_notification::Notification<R>>()
        {
            match n.inner().builder().title(title).body(body).show() {
                Ok(_) => {
                    log::debug!("[Backend] Notification delivered via plugin");
                }
                Err(e) => {
                    log::error!("[Backend] Notification plugin failed: {}", e);
                }
            }
        } else {
            log::warn!("[Backend] Notification plugin state not found");
        }

        #[cfg(target_os = "linux")]
        {
            log::info!("[Backend] Linux Strategy: Dual Dispatch fallback via notify-send");
            let t = title
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
            let b = body
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");

            tauri::async_runtime::spawn_blocking(move || {
                match std::process::Command::new("notify-send")
                    .arg("-a")
                    .arg("Tauri App Template")
                    .arg("--")
                    .arg(&t)
                    .arg(&b)
                    .status()
                {
                    Ok(status) if status.success() => {
                        log::debug!("[Backend] notify-send fallback succeeded");
                    }
                    Ok(status) => {
                        log::warn!(
                            "[Backend] notify-send fallback exited with error: {}",
                            status
                        );
                    }
                    Err(e) => {
                        log::error!("[Backend] Failed to execute notify-send fallback: {}", e);
                    }
                }
            });
        }

        Ok(())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn notify(app: tauri::AppHandle, title: String, body: String) -> CResult<()> {
    if title.len() > 256 || body.len() > 1024 {
        return Err(crate::error::Error::Validation(
            "Notification content too long".into(),
        ));
    }
    let service = RealNotificationService::new(app);
    service.show(&title, &body).await
}

#[cfg(test)]
#[allow(unsafe_code, clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::Mutex;

    struct MockNotificationService {
        calls: Arc<Mutex<Vec<(String, String)>>>,
    }

    #[async_trait]
    impl NotificationService for MockNotificationService {
        async fn show(&self, title: &str, body: &str) -> CResult<()> {
            let mut calls = self.calls.lock().unwrap();
            calls.push((title.to_string(), body.to_string()));
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_notify_success() {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let service = MockNotificationService {
            calls: calls.clone(),
        };

        let result = service.show("Test Title", "Test Body").await;

        assert!(result.is_ok());
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, "Test Title");
        assert_eq!(calls[0].1, "Test Body");
    }
}
