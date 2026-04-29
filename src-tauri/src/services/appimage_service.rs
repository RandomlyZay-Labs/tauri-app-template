use crate::error::CResult;

#[cfg(unix)]
mod platform {
    use crate::error::CResult;
    use std::env;
    use std::os::unix::fs::symlink;
    use std::path::PathBuf;

    pub fn is_appimage() -> bool {
        env::var("APPIMAGE").is_ok()
    }

    pub fn integrate_appimage() -> CResult<()> {
        log::debug!("[AppImageService] Attempting to integrate AppImage");
        let appimage_path = env::var("APPIMAGE")
            .map_err(|_| crate::error::Error::Unknown("Not running as an AppImage".into()))?;

        let home_dir = env::var("HOME")
            .map_err(|_| crate::error::Error::Unknown("Could not determine home directory".into()))?;

        let local_bin = PathBuf::from(home_dir).join(".local/bin");

        if !local_bin.exists() {
            std::fs::create_dir_all(&local_bin)
                .map_err(|e| crate::error::Error::Io(e.to_string()))?;
        }

        let symlink_path = local_bin.join("tauri-app-template");

        // Skip re-creation when the symlink already points to the current AppImage
        if symlink_path.is_symlink()
            && let Ok(target) = std::fs::read_link(&symlink_path)
            && target == *std::path::Path::new(&appimage_path)
        {
            log::debug!("AppImage symlink already up-to-date, skipping integration");
            return Ok(());
        }

        if symlink_path.exists() || symlink_path.is_symlink() {
            std::fs::remove_file(&symlink_path)
                .map_err(|e| crate::error::Error::Io(e.to_string()))?;
        }

        symlink(&appimage_path, &symlink_path)
            .map_err(|e| crate::error::Error::Io(e.to_string()))?;

        log::info!(
            "Successfully symlinked AppImage from {} to {}",
            appimage_path,
            symlink_path.display()
        );

        Ok(())
    }
}

#[cfg(not(unix))]
mod platform {
    use crate::error::CResult;

    pub fn is_appimage() -> bool {
        false
    }

    pub fn integrate_appimage() -> CResult<()> {
        Err(crate::error::Error::Unknown(
            "AppImage integration is only supported on Linux".into(),
        ))
    }
}

pub fn is_appimage() -> bool {
    platform::is_appimage()
}

pub fn integrate_appimage() -> CResult<()> {
    platform::integrate_appimage()
}

#[cfg(test)]
#[allow(unsafe_code, clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[cfg(not(unix))]
    mod non_unix {
        use super::*;

        #[test]
        fn is_appimage_always_false_on_non_unix() {
            assert!(!is_appimage());
        }

        #[test]
        fn integrate_appimage_errors_on_non_unix() {
            let result = integrate_appimage();
            assert!(result.is_err());
        }
    }

    #[cfg(unix)]
    mod unix {
        use std::env;
        use std::fs;
        use std::os::unix::fs::symlink;
        use std::sync::{Mutex, MutexGuard};

        /// Serializes tests that mutate process-global env vars (HOME, APPIMAGE).
        /// Without this, parallel test threads race on env::set_var.
        static ENV_MUTEX: Mutex<()> = Mutex::new(());

        /// Guards env vars so they are restored (or removed) when the test ends,
        /// even on panic. Also holds the ENV_MUTEX lock for the test's lifetime.
        struct EnvGuard {
            key: &'static str,
            prev: Option<String>,
        }

        impl EnvGuard {
            fn set(key: &'static str, value: &str) -> Self {
                let prev = env::var(key).ok();
                unsafe { env::set_var(key, value) };
                Self { key, prev }
            }

            fn remove(key: &'static str) -> Self {
                let prev = env::var(key).ok();
                unsafe { env::remove_var(key) };
                Self { key, prev }
            }
        }

        impl Drop for EnvGuard {
            fn drop(&mut self) {
                match &self.prev {
                    Some(v) => unsafe { env::set_var(self.key, v) },
                    None => unsafe { env::remove_var(self.key) },
                }
            }
        }

        fn lock_env() -> MutexGuard<'static, ()> {
            ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner())
        }

        #[test]
        fn is_appimage_true_when_env_set() {
            let _lock = lock_env();
            let _guard = EnvGuard::set("APPIMAGE", "/tmp/fake.AppImage");
            assert!(super::is_appimage());
        }

        #[test]
        fn is_appimage_false_when_env_unset() {
            let _lock = lock_env();
            let _guard = EnvGuard::remove("APPIMAGE");
            assert!(!super::is_appimage());
        }

        #[test]
        fn integrate_errors_when_appimage_env_missing() {
            let _lock = lock_env();
            let _guard = EnvGuard::remove("APPIMAGE");
            let result = super::integrate_appimage();
            assert!(result.is_err());
        }

        #[test]
        fn integrate_creates_symlink_in_local_bin() {
            let _lock = lock_env();
            let tmp = tempfile::tempdir().expect("failed to create temp dir");
            let home = tmp.path().join("home");
            let local_bin = home.join(".local/bin");
            let fake_appimage = tmp.path().join("FakeApp.AppImage");
            fs::write(&fake_appimage, "binary-content").expect("write fake appimage");

            let _g1 = EnvGuard::set("HOME", home.to_str().unwrap());
            let _g2 = EnvGuard::set("APPIMAGE", fake_appimage.to_str().unwrap());

            super::integrate_appimage().expect("integrate should succeed");

            let symlink_path = local_bin.join("tauri-app-template");
            assert!(symlink_path.is_symlink(), "symlink should exist");
            let target = fs::read_link(&symlink_path).expect("read_link");
            assert_eq!(target, fake_appimage);
        }

        #[test]
        fn integrate_is_idempotent_when_symlink_up_to_date() {
            let _lock = lock_env();
            let tmp = tempfile::tempdir().expect("failed to create temp dir");
            let home = tmp.path().join("home");
            let local_bin = home.join(".local/bin");
            fs::create_dir_all(&local_bin).expect("create local_bin");
            let fake_appimage = tmp.path().join("FakeApp.AppImage");
            fs::write(&fake_appimage, "binary-content").expect("write fake appimage");

            // Pre-create the symlink pointing at the same target
            let symlink_path = local_bin.join("tauri-app-template");
            symlink(&fake_appimage, &symlink_path).expect("pre-create symlink");

            let _g1 = EnvGuard::set("HOME", home.to_str().unwrap());
            let _g2 = EnvGuard::set("APPIMAGE", fake_appimage.to_str().unwrap());

            super::integrate_appimage().expect("idempotent call should succeed");

            // Symlink still points to the same target
            let target = fs::read_link(&symlink_path).expect("read_link");
            assert_eq!(target, fake_appimage);
        }

        #[test]
        fn integrate_replaces_stale_symlink() {
            let _lock = lock_env();
            let tmp = tempfile::tempdir().expect("failed to create temp dir");
            let home = tmp.path().join("home");
            let local_bin = home.join(".local/bin");
            fs::create_dir_all(&local_bin).expect("create local_bin");

            let old_appimage = tmp.path().join("OldApp.AppImage");
            let new_appimage = tmp.path().join("NewApp.AppImage");
            fs::write(&old_appimage, "old").expect("write old");
            fs::write(&new_appimage, "new").expect("write new");

            // Pre-create symlink pointing at the OLD target
            let symlink_path = local_bin.join("tauri-app-template");
            symlink(&old_appimage, &symlink_path).expect("pre-create stale symlink");

            let _g1 = EnvGuard::set("HOME", home.to_str().unwrap());
            let _g2 = EnvGuard::set("APPIMAGE", new_appimage.to_str().unwrap());

            super::integrate_appimage().expect("replace stale symlink should succeed");

            let target = fs::read_link(&symlink_path).expect("read_link");
            assert_eq!(target, new_appimage);
        }

        #[test]
        fn integrate_creates_local_bin_if_missing() {
            let _lock = lock_env();
            let tmp = tempfile::tempdir().expect("failed to create temp dir");
            let home = tmp.path().join("home");
            let local_bin = home.join(".local/bin");
            let fake_appimage = tmp.path().join("FakeApp.AppImage");
            fs::write(&fake_appimage, "binary-content").expect("write fake appimage");

            assert!(!local_bin.exists(), "local_bin should not exist yet");

            let _g1 = EnvGuard::set("HOME", home.to_str().unwrap());
            let _g2 = EnvGuard::set("APPIMAGE", fake_appimage.to_str().unwrap());

            super::integrate_appimage().expect("should create directories and symlink");

            assert!(local_bin.exists(), "local_bin should have been created");
        }
    }
}
