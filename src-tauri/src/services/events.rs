// SPDX-License-Identifier: MIT
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub trait AppEmitter: Send + Sync + 'static {
    fn emit_event(&self, event: &str, payload: serde_json::Value) -> Result<(), tauri::Error>;
}

impl<R: tauri::Runtime> AppEmitter for AppHandle<R> {
    fn emit_event(&self, event: &str, payload: serde_json::Value) -> Result<(), tauri::Error> {
        self.emit(event, payload)
    }
}

pub struct NoopEmitter;
impl AppEmitter for NoopEmitter {
    fn emit_event(&self, _event: &str, _payload: serde_json::Value) -> Result<(), tauri::Error> {
        Ok(())
    }
}

pub fn emit<P: Serialize>(emitter: &dyn AppEmitter, event: &str, payload: P) {
    match serde_json::to_value(payload) {
        Ok(val) => {
            if let Err(e) = emitter.emit_event(event, val) {
                log::error!("Failed to emit event '{}': {}", event, e);
            }
        }
        Err(e) => {
            log::error!("Failed to serialize payload for event '{}': {}", event, e);
        }
    }
}
