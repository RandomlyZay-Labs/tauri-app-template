use crate::error::CResult;
use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use std::fs;
use std::path::PathBuf;

pub async fn init(custom_data_dir: Option<&PathBuf>) -> CResult<SqlitePool> {
    let db_path = if let Some(dir) = custom_data_dir {
        dir.join("tauri_app_template.db")
    } else {
        // Default to current directory if not specified
        PathBuf::from("tauri_app_template.db")
    };

    if let Some(parent) = db_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new().connect_with(options).await?;

    // Embed and run migrations from the migrations folder
    // Path is relative to CARGO_MANIFEST_DIR (src-tauri)
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| crate::error::Error::Database(e.to_string()))?;

    Ok(pool)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_db_init() {
        let tmp = tempdir().expect("Failed to create temp dir");
        let data_dir = tmp.path().to_path_buf();

        let pool = init(Some(&data_dir))
            .await
            .expect("Failed to init database");

        // Verify file exists
        assert!(data_dir.join("tauri_app_template.db").exists());

        // Verify we can query it
        let row: (i32,) = sqlx::query_as("SELECT 1")
            .fetch_one(&pool)
            .await
            .expect("Failed to query DB");
        assert_eq!(row.0, 1);

        // Verify migrations ran (assuming there is a 'jobs' table from migrations)
        // I'll check migrations table instead to be safe
        let m_row: (i32,) = sqlx::query_as("SELECT count(*) FROM _sqlx_migrations")
            .fetch_one(&pool)
            .await
            .expect("Failed to check migrations");
        assert!(m_row.0 > 0);
    }
}
