// SPDX-License-Identifier: MIT
use serde::Serialize;
use specta::Type;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Type)]
#[serde(tag = "type", content = "message")]
pub enum Error {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Unexpected error: {0}")]
    Unknown(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Network error: {0}")]
    Network(String),
}

impl From<sqlx::Error> for Error {
    fn from(error: sqlx::Error) -> Self {
        match error {
            sqlx::Error::RowNotFound => Self::NotFound("Item not found".into()),
            _ => Self::Database(error.to_string()),
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error.to_string())
    }
}

impl From<reqwest::Error> for Error {
    fn from(error: reqwest::Error) -> Self {
        Self::Network(error.to_string())
    }
}

impl From<String> for Error {
    fn from(message: String) -> Self {
        Self::Unknown(message)
    }
}

pub type CResult<T> = Result<T, Error>;
