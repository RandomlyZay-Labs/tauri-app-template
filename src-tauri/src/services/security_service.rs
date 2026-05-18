use crate::error::{CResult, Error};
use keyring_core::Entry;

const SERVICE_NAME: &str = "io.github.randomlyzay-labs.tauri-app-template";

pub fn set_secret(key: &str, value: &str) -> CResult<()> {
    log::debug!("[SecurityService] Setting secret");
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e: keyring_core::Error| Error::Unknown(e.to_string()))?;
    entry
        .set_password(value)
        .map_err(|e: keyring_core::Error| Error::Unknown(e.to_string()))?;
    Ok(())
}

pub fn get_secret(key: &str) -> CResult<String> {
    log::debug!("[SecurityService] Getting secret");
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e: keyring_core::Error| Error::Unknown(e.to_string()))?;
    let secret = entry
        .get_password()
        .map_err(|e: keyring_core::Error| Error::Unknown(e.to_string()))?;
    Ok(secret)
}

pub fn delete_secret(key: &str) -> CResult<()> {
    log::debug!("[SecurityService] Deleting secret");
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e: keyring_core::Error| Error::Unknown(e.to_string()))?;
    entry
        .delete_credential()
        .map_err(|e: keyring_core::Error| Error::Unknown(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    use std::sync::{Arc, Mutex, LazyLock};
    use std::collections::HashMap;
    use keyring_core::api::{CredentialApi, CredentialStoreApi};

    type MockStore = Arc<Mutex<HashMap<String, Vec<u8>>>>;

    static STORE: LazyLock<MockStore> = 
        LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

    static INJECTED_ERROR: LazyLock<Mutex<Option<keyring_core::Error>>> = 
        LazyLock::new(|| Mutex::new(None));

    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    fn inject_mock_error(err: keyring_core::Error) {
        *INJECTED_ERROR.lock().unwrap() = Some(err);
    }

    fn clear_mock_error() {
        *INJECTED_ERROR.lock().unwrap() = None;
    }

    struct MyMockBuilder {
        store: MockStore,
    }

    struct MyMockCredential {
        service: String,
        user: String,
        store: MockStore,
    }

    impl CredentialStoreApi for MyMockBuilder {
        fn vendor(&self) -> String { "mock".to_string() }
        fn id(&self) -> String { "mock-id".to_string() }
        fn build(&self, service: &str, user: &str, _modifiers: Option<&HashMap<&str, &str>>) -> keyring_core::Result<Entry> {
            let cred = MyMockCredential {
                service: service.to_string(),
                user: user.to_string(),
                store: self.store.clone(),
            };
            Ok(Entry::new_with_credential(Arc::new(cred)))
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    impl CredentialApi for MyMockCredential {
        fn set_secret(&self, secret: &[u8]) -> keyring_core::error::Result<()> {
            if let Some(err) = INJECTED_ERROR.lock().unwrap().take() {
                return Err(err);
            }
            self.store.lock().unwrap().insert(self.user.clone(), secret.to_vec());
            Ok(())
        }
        fn get_secret(&self) -> keyring_core::error::Result<Vec<u8>> {
            if let Some(err) = INJECTED_ERROR.lock().unwrap().take() {
                return Err(err);
            }
            self.store.lock().unwrap().get(&self.user)
                .cloned()
                .ok_or(keyring_core::Error::NoEntry)
        }
        fn delete_credential(&self) -> keyring_core::error::Result<()> {
            if let Some(err) = INJECTED_ERROR.lock().unwrap().take() {
                return Err(err);
            }
            self.store.lock().unwrap().remove(&self.user)
                .map(|_| ())
                .ok_or(keyring_core::Error::NoEntry)
        }
        fn get_credential(&self) -> std::result::Result<Option<Arc<dyn CredentialApi + Send + Sync>>, keyring_core::Error> {
            Ok(None)
        }
        fn get_specifiers(&self) -> Option<(String, String)> {
            Some((self.service.clone(), self.user.clone()))
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    /// Installs a persistent mock credential builder so that all Entry instances
    /// share the same in-memory store. This allows testing persistence across
    /// set_secret and get_secret calls.
    /// 
    /// Returns a MutexGuard to ensure tests using the mock keyring run sequentially
    /// and don't interfere with each other's state.
    fn use_mock_keyring() -> std::sync::MutexGuard<'static, ()> {
        let guard = TEST_MUTEX.lock().unwrap();
        use std::sync::Once;
        static INIT: Once = Once::new();
        INIT.call_once(|| {
            // Use try_lock to avoid panicking if something went wrong in a previous test
            // although here we are inside call_once.
            keyring_core::set_default_store(Arc::new(MyMockBuilder { 
                store: Arc::clone(&STORE) 
            }));
        });
        
        // Ensure we can lock the store. If poisoned, we try to clear it anyway.
        match STORE.lock() {
            Ok(mut s) => s.clear(),
            Err(poisoned) => {
                let mut s = poisoned.into_inner();
                s.clear();
            }
        }
        
        clear_mock_error();
        guard
    }

    /// The mock backend creates an independent MockCredential per Entry::new()
    /// call, so we test the full credential lifecycle (set → get → overwrite
    /// → delete → get-missing) on a single Entry instance.
    #[test]
    fn credential_lifecycle_on_single_entry() {
        let _guard = use_mock_keyring();
        let entry = Entry::new(SERVICE_NAME, "lifecycle_key").expect("entry creation");

        // Set and retrieve
        entry.set_password("initial-secret").expect("set_password");
        assert_eq!(entry.get_password().expect("get_password"), "initial-secret");

        // Overwrite and retrieve
        entry.set_password("updated-secret").expect("overwrite");
        assert_eq!(entry.get_password().expect("get after overwrite"), "updated-secret");

        // Delete and verify absence
        entry.delete_credential().expect("delete");
        assert!(entry.get_password().is_err(), "password should be gone after delete");
    }

    #[test]
    fn get_password_missing_returns_error() {
        let _guard = use_mock_keyring();
        let entry = Entry::new(SERVICE_NAME, "never_set_key").expect("entry creation");
        assert!(entry.get_password().is_err());
    }

    #[test]
    fn delete_missing_credential_returns_error() {
        let _guard = use_mock_keyring();
        let entry = Entry::new(SERVICE_NAME, "never_set_either").expect("entry creation");
        assert!(entry.delete_credential().is_err());
    }

    /// Verifies that the service functions correctly map keyring errors into
    /// our CResult<T> error type.
    #[test]
    fn get_secret_maps_error_correctly() {
        let _guard = use_mock_keyring();
        let result = get_secret("nonexistent_service_key");
        assert!(result.is_err());
        let err = result.unwrap_err();
        match err {
            Error::Unknown(msg) => assert!(msg.contains("No matching entry") || msg.contains("No matching credential"), "unexpected: {msg}"),
            other => panic!("expected Error::Unknown, got: {other:?}"),
        }
    }

    #[test]
    fn delete_secret_maps_error_correctly() {
        let _guard = use_mock_keyring();
        let result = delete_secret("nonexistent_delete_key");
        assert!(result.is_err());
        let err = result.unwrap_err();
        match err {
            Error::Unknown(msg) => assert!(msg.contains("No matching entry") || msg.contains("No matching credential"), "unexpected: {msg}"),
            other => panic!("expected Error::Unknown, got: {other:?}"),
        }
    }

    /// Verifies that set_secret succeeds (Entry construction + set_password work
    /// with the mock backend).
    #[test]
    fn set_secret_succeeds_with_mock() {
        let _guard = use_mock_keyring();
        let result = set_secret("mock_set_test", "some-value");
        assert!(result.is_ok(), "set_secret should succeed with mock backend");
    }

    #[test]
    fn test_public_api_lifecycle_and_persistence() {
        let _guard = use_mock_keyring();
        let key = "persistence_test_key";
        let secret = "super-secret-123";

        // 1. Set the secret using public API
        set_secret(key, secret).expect("failed to set secret");

        // 2. Retrieve the secret using public API (different Entry instance internally)
        let retrieved = get_secret(key).expect("failed to get secret");
        assert_eq!(retrieved, secret, "retrieved secret does not match set secret");

        // 3. Update the secret
        let new_secret = "updated-secret-456";
        set_secret(key, new_secret).expect("failed to update secret");

        // 4. Verify update
        let updated = get_secret(key).expect("failed to get updated secret");
        assert_eq!(updated, new_secret, "updated secret does not match");

        // 5. Delete the secret
        delete_secret(key).expect("failed to delete secret");

        // 6. Verify deletion
        assert!(get_secret(key).is_err(), "secret should be gone after delete_secret");
    }

    #[test]
    fn test_error_propagation_platform_failure() {
        let _guard = use_mock_keyring();
        inject_mock_error(keyring_core::Error::PlatformFailure(Box::new(std::io::Error::other("OS Keychain Locked"))));
        
        let result = get_secret("any_key");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("OS Keychain Locked"));
        
        clear_mock_error();
    }
}
