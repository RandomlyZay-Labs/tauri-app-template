use crate::error::CResult;
use async_trait::async_trait;
use bytes::Bytes;
use futures_util::StreamExt;

pub struct NetworkResponse {
    pub status: reqwest::StatusCode,
    pub content_length: Option<u64>,
    pub bytes_stream: futures_util::stream::BoxStream<'static, CResult<Bytes>>,
}

#[async_trait]
pub trait NetworkClient: Send + Sync {
    async fn send_request(&self, url: &str, range: Option<String>) -> CResult<NetworkResponse>;
}

pub struct RealNetworkClient {
    client: reqwest::Client,
}

impl RealNetworkClient {
    pub fn new(client: reqwest::Client) -> Self {
        Self { client }
    }
}

#[async_trait]
impl NetworkClient for RealNetworkClient {
    async fn send_request(&self, url: &str, range: Option<String>) -> CResult<NetworkResponse> {
        let mut builder = self.client.get(url);
        if let Some(r) = range {
            builder = builder.header("Range", r);
        }
        let response = builder.send().await?.error_for_status()?;

        Ok(NetworkResponse {
            status: response.status(),
            content_length: response.content_length(),
            bytes_stream: Box::pin(
                response
                    .bytes_stream()
                    .map(|r| r.map_err(|e| crate::error::Error::Network(e.to_string()))),
            ),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::StreamExt;

    #[tokio::test]
    async fn test_real_network_client_success() -> Result<(), Box<dyn std::error::Error>> {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/test")
            .with_status(200)
            .with_header("content-length", "4")
            .with_body("data")
            .create_async()
            .await;

        let client = RealNetworkClient::new(reqwest::Client::new());
        let response = client
            .send_request(&format!("{}/test", server.url()), None)
            .await?;

        assert_eq!(response.status, reqwest::StatusCode::OK);
        assert_eq!(response.content_length, Some(4));

        let body = response.bytes_stream.collect::<Vec<_>>().await;
        assert_eq!(body.len(), 1);
        let first_chunk = body[0].as_ref().map_err(|e| e.to_string())?;
        assert_eq!(first_chunk, &Bytes::from("data"));

        Ok(())
    }

    #[tokio::test]
    async fn test_real_network_client_range_header() -> Result<(), Box<dyn std::error::Error>> {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/test")
            .match_header("Range", "bytes=0-10")
            .with_status(206)
            .create_async()
            .await;

        let client = RealNetworkClient::new(reqwest::Client::new());
        let response = client
            .send_request(
                &format!("{}/test", server.url()),
                Some("bytes=0-10".to_string()),
            )
            .await?;

        assert_eq!(response.status, reqwest::StatusCode::PARTIAL_CONTENT);
        Ok(())
    }

    #[tokio::test]
    async fn test_real_network_client_error() -> Result<(), Box<dyn std::error::Error>> {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/error")
            .with_status(404)
            .create_async()
            .await;

        let client = RealNetworkClient::new(reqwest::Client::new());
        let result = client
            .send_request(&format!("{}/error", server.url()), None)
            .await;

        assert!(result.is_err());
        Ok(())
    }
}
