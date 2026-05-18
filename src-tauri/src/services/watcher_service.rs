use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;

#[derive(Clone)]
pub struct WatcherManager {
    debouncers: Arc<Mutex<HashMap<String, Debouncer<RecommendedWatcher>>>>,
}

impl std::fmt::Debug for WatcherManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let count = self.debouncers.lock().map(|g| g.len()).unwrap_or(0);
        f.debug_struct("WatcherManager")
            .field("count", &count)
            .finish()
    }
}

impl WatcherManager {
    pub fn new() -> Self {
        Self {
            debouncers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn watch<R: tauri::Runtime>(&self, app: tauri::AppHandle<R>, path_str: String) -> Result<(), String> {
        let path = crate::util::resolve_path(&path_str).map_err(|e| e.to_string())?;
        let resolved_key = path.to_string_lossy().to_string();

        if !path.exists() {
            return Err("Path does not exist".to_string());
        }

        let mut debouncers = self.debouncers.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        
        if debouncers.len() >= 10 {
            return Err("Too many active watchers".to_string());
        }

        if debouncers.contains_key(&resolved_key) {
            return Ok(());
        }

        let app_handle = app.clone();
        let event_path = resolved_key.clone();
        let target_path = path.clone();
        let is_dir = path.is_dir();

        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            move |res: DebounceEventResult| match res {
                Ok(events) => {
                    let should_emit = if is_dir {
                        true
                    } else {
                        events.into_iter().any(|e| e.path == target_path)
                    };

                    if should_emit {
                        let _ = app_handle.emit("fs://change", &event_path);
                    }
                }
                Err(e) => log::error!("Watch error: {:?}", e),
            },
        )
        .map_err(|e| e.to_string())?;

        let watch_target = if is_dir {
            path.clone()
        } else {
            path.parent().unwrap_or(&path).to_path_buf()
        };

        debouncer
            .watcher()
            .watch(
                &watch_target,
                if is_dir {
                    RecursiveMode::Recursive
                } else {
                    RecursiveMode::NonRecursive
                },
            )
            .map_err(|e| e.to_string())?;

        debouncers.insert(resolved_key, debouncer);

        Ok(())
    }

    pub fn unwatch(&self, path_str: String) -> Result<(), String> {
        let path = crate::util::resolve_path(&path_str).map_err(|e| e.to_string())?;
        let resolved_key = path.to_string_lossy().to_string();

        let mut debouncers = self.debouncers.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        debouncers.remove(&resolved_key);
        Ok(())
    }

    /// Returns the number of active watchers. Useful for testing and rate limiting.
    #[cfg(test)]
    pub fn active_count(&self) -> usize {
        self.debouncers.lock().map(|g| g.len()).unwrap_or(0)
    }
}

impl Default for WatcherManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn new_manager_has_no_watchers() {
        let mgr = WatcherManager::new();
        assert_eq!(mgr.active_count(), 0);
    }

    #[test]
    fn debug_format_shows_count() {
        let mgr = WatcherManager::new();
        let debug_str = format!("{:?}", mgr);
        assert!(debug_str.contains("WatcherManager"));
        assert!(debug_str.contains("count"));
        assert!(debug_str.contains("0"));
    }

    #[test]
    fn clone_shares_state() {
        let mgr = WatcherManager::new();
        let mgr2 = mgr.clone();

        // Both should report the same count (they share the Arc)
        assert_eq!(mgr.active_count(), 0);
        assert_eq!(mgr2.active_count(), 0);

        // Verify they share the same underlying data via Arc pointer equality
        assert!(Arc::ptr_eq(&mgr.debouncers, &mgr2.debouncers));
    }

    #[test]
    fn unwatch_nonexistent_path_is_noop() {
        let mgr = WatcherManager::new();
        let result = mgr.unwatch("/some/path/that/was/never/watched".to_string());
        assert!(result.is_ok(), "unwatch of non-watched path should succeed");
        assert_eq!(mgr.active_count(), 0);
    }

    #[test]
    fn watch_fails_for_nonexistent_path() {
        let mgr = WatcherManager::new();
        let app = tauri::test::mock_app();
        let result = mgr.watch(app.handle().clone(), "/non/existent/path".to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Path does not exist");
    }

    #[test]
    fn watch_and_unwatch_lifecycle() {
        let mgr = WatcherManager::new();
        let app = tauri::test::mock_app();
        
        // Create a temp file to watch
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        std::fs::write(&file_path, "initial content").unwrap();
        let path_str = file_path.to_string_lossy().to_string();

        // 1. Watch
        mgr.watch(app.handle().clone(), path_str.clone()).expect("watch failed");
        assert_eq!(mgr.active_count(), 1);

        // 2. Watch same path again (should be no-op)
        mgr.watch(app.handle().clone(), path_str.clone()).expect("watch again failed");
        assert_eq!(mgr.active_count(), 1);

        // 3. Unwatch
        mgr.unwatch(path_str).expect("unwatch failed");
        assert_eq!(mgr.active_count(), 0);
    }

    #[test]
    fn watcher_limit_is_enforced() {
        let mgr = WatcherManager::new();
        let app = tauri::test::mock_app();
        let temp_dir = tempfile::tempdir().unwrap();

        // Create 10 temp files
        for i in 0..10 {
            let file_path = temp_dir.path().join(format!("test{}.txt", i));
            std::fs::write(&file_path, "content").unwrap();
            let path_str = file_path.to_string_lossy().to_string();
            mgr.watch(app.handle().clone(), path_str).expect("watch should succeed for first 10");
        }

        assert_eq!(mgr.active_count(), 10);

        // Attempt to watch the 11th file
        let file_path11 = temp_dir.path().join("test11.txt");
        std::fs::write(&file_path11, "content").unwrap();
        let path_str11 = file_path11.to_string_lossy().to_string();
        let result = mgr.watch(app.handle().clone(), path_str11);

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Too many active watchers");
    }

    #[tokio::test]
    async fn test_watcher_emits_event_on_change() -> Result<(), Box<dyn std::error::Error>> {
        use tauri::Listener;
        use std::sync::atomic::{AtomicBool, Ordering};

        let mgr = WatcherManager::new();
        let app = tauri::test::mock_app();
        let handle = app.handle();

        // Create a temp file to watch
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test_emit.txt");
        std::fs::write(&file_path, "initial content").unwrap();
        let path_str = file_path.to_string_lossy().to_string();

        let received = Arc::new(AtomicBool::new(false));
        let r_clone = received.clone();

        handle.listen("fs://change", move |_event| {
            r_clone.store(true, Ordering::SeqCst);
        });

        // Start watching
        mgr.watch(handle.clone(), path_str.clone()).expect("watch failed");

        // Modify the file to trigger an event
        std::fs::write(&file_path, "updated content").unwrap();

        // Debouncer is set to 500ms in the code. Wait long enough for it to fire.
        let mut found = false;
        for _ in 0..20 {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            if received.load(Ordering::SeqCst) {
                found = true;
                break;
            }
        }

        assert!(found, "Should have received fs://change event after file modification");

        // Cleanup
        mgr.unwatch(path_str).expect("unwatch failed");
        Ok(())
    }
}
