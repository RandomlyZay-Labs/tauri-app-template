use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub trait AppEmitter: Send + Sync + 'static {
    fn emit_event(&self, event: &str, payload: serde_json::Value);
}

impl<R: tauri::Runtime> AppEmitter for AppHandle<R> {
    fn emit_event(&self, event: &str, payload: serde_json::Value) {
        let _ = self.emit(event, payload);
    }
}

pub struct NoopEmitter;
impl AppEmitter for NoopEmitter {
    fn emit_event(&self, _event: &str, _payload: serde_json::Value) {}
}

pub fn emit<P: Serialize>(emitter: &dyn AppEmitter, event: &str, payload: P) {
    if let Ok(val) = serde_json::to_value(payload) {
        emitter.emit_event(event, val);
    }
}
