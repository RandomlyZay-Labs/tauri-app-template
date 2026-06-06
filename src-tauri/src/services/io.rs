use async_trait::async_trait;
use std::path::Path;
use tokio::io::AsyncWrite;

#[async_trait]
pub trait FileSystem: Send + Sync {
    async fn create_dir_all(&self, path: &Path) -> std::io::Result<()>;
    async fn exists(&self, path: &Path) -> bool;
    async fn metadata_len(&self, path: &Path) -> std::io::Result<u64>;
    async fn remove_file(&self, path: &Path) -> std::io::Result<()>;
    async fn copy(&self, from: &Path, to: &Path) -> std::io::Result<u64>;
    async fn create(&self, path: &Path) -> std::io::Result<Box<dyn AsyncWrite + Unpin + Send>>;
    async fn open_append(&self, path: &Path)
    -> std::io::Result<Box<dyn AsyncWrite + Unpin + Send>>;
}

pub struct RealFileSystem;

#[async_trait]
impl FileSystem for RealFileSystem {
    async fn create_dir_all(&self, path: &Path) -> std::io::Result<()> {
        tokio::fs::create_dir_all(path).await
    }

    async fn exists(&self, path: &Path) -> bool {
        tokio::fs::try_exists(path).await.unwrap_or(false)
    }

    async fn metadata_len(&self, path: &Path) -> std::io::Result<u64> {
        let meta = tokio::fs::metadata(path).await?;
        Ok(meta.len())
    }

    async fn remove_file(&self, path: &Path) -> std::io::Result<()> {
        tokio::fs::remove_file(path).await
    }

    async fn copy(&self, from: &Path, to: &Path) -> std::io::Result<u64> {
        tokio::fs::copy(from, to).await
    }

    async fn create(&self, path: &Path) -> std::io::Result<Box<dyn AsyncWrite + Unpin + Send>> {
        let file = tokio::fs::File::create(path).await?;
        Ok(Box::new(file))
    }

    async fn open_append(
        &self,
        path: &Path,
    ) -> std::io::Result<Box<dyn AsyncWrite + Unpin + Send>> {
        let file = tokio::fs::OpenOptions::new()
            .append(true)
            .open(path)
            .await?;
        Ok(Box::new(file))
    }
}
