use crate::error::{CResult, Error};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

pub fn get_binary_details(version: &str) -> CResult<(String, String)> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let (os_name, arch_name, ext) = match (os, arch) {
        ("windows", "x86_64") => ("windows", "x64", ".exe"),
        ("windows", "aarch64") => ("windows", "arm64", ".exe"),
        ("linux", "x86_64") => ("linux", "amd64", ""),
        ("linux", "aarch64") => ("linux", "arm64", ""),
        _ => {
            return Err(Error::Unknown(format!(
                "Unsupported platform: {}-{}",
                os, arch
            )));
        }
    };

    let binary_name = format!("tauri-app-template-cli-{}-{}{}", os_name, arch_name, ext);
    let url = format!(
        "https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v{}/{}",
        version, binary_name
    );

    Ok((binary_name, url))
}

pub async fn get_expected_sha(
    client: &reqwest::Client,
    version: &str,
    binary_name: &str,
) -> CResult<String> {
    get_expected_sha_from_base(client, "https://api.github.com", version, binary_name).await
}

async fn get_expected_sha_from_base(
    client: &reqwest::Client,
    base_url: &str,
    version: &str,
    binary_name: &str,
) -> CResult<String> {
    let api_url = format!(
        "{}/repos/RandomlyZay-Labs/tauri-app-template/releases/tags/v{}",
        base_url, version
    );

    let res = client.get(&api_url).send().await?;
    if !res.status().is_success() {
        return Err(Error::Network(format!(
            "Failed to fetch release metadata. Status: {}",
            res.status()
        )));
    }

    let release_info: serde_json::Value = res.json().await?;
    let assets = release_info
        .get("assets")
        .and_then(|a| a.as_array())
        .ok_or_else(|| Error::Unknown("Release JSON missing assets array".into()))?;

    let mut sha_opt = None;
    for asset in assets {
        let name = asset.get("name").and_then(|n| n.as_str());
        let digest = asset.get("digest").and_then(|d| d.as_str());
        let sha_val = digest.and_then(|d| d.strip_prefix("sha256:"));
        if name == Some(binary_name) && sha_val.is_some() {
            sha_opt = sha_val.map(|sha| sha.to_lowercase());
            break;
        }
    }

    sha_opt.ok_or_else(|| {
        Error::Unknown(format!(
            "Could not find SHA-256 digest for asset {} in release assets metadata",
            binary_name
        ))
    })
}

pub fn verify_checksum(file_path: &Path, expected_sha: &str) -> CResult<()> {
    let mut file = File::open(file_path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    let hash_result = hasher.finalize();
    let computed_sha = hash_result
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();

    if computed_sha != expected_sha {
        return Err(Error::Unknown(format!(
            "Integrity check failed: checksum mismatch. Expected: {}, Computed: {}",
            expected_sha, computed_sha
        )));
    }

    Ok(())
}

pub fn install_binary_file(tmp_path: &Path, target_path: &Path) -> CResult<()> {
    if let Err(e) = std::fs::rename(tmp_path, target_path) {
        let is_already_exists = e.kind() == std::io::ErrorKind::AlreadyExists;
        let mut retry_success = false;
        let mut secondary_error = None;

        if is_already_exists {
            if let Err(rm_err) = std::fs::remove_file(target_path) {
                secondary_error =
                    Some(format!("Failed to remove existing target file: {}", rm_err));
            } else if let Err(rename_err) = std::fs::rename(tmp_path, target_path) {
                secondary_error = Some(format!("Failed to rename binary on retry: {}", rename_err));
            } else {
                retry_success = true;
            }
        }

        if !retry_success {
            let msg = if let Some(sec_err) = secondary_error {
                format!(
                    "Failed to rename binary: {}. Secondary error: {}",
                    e, sec_err
                )
            } else {
                format!("Failed to rename binary: {}", e)
            };
            return Err(Error::Io(msg));
        }
    }

    // Set executable permissions on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(target_path)?;
        let mut perms = metadata.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(target_path, perms)?;
    }

    Ok(())
}

pub async fn update_cli_standalone(target_version: &str, target_path: &Path) -> CResult<()> {
    let (binary_name, url) = get_binary_details(target_version)?;
    let target_dir = target_path
        .parent()
        .ok_or_else(|| Error::Unknown("Invalid CLI path".into()))?;
    std::fs::create_dir_all(target_dir)?;

    let client = reqwest::Client::builder()
        .user_agent("tauri-app-template")
        .build()?;

    println!("Checking for CLI update for version v{}...", target_version);
    let expected_sha = get_expected_sha(&client, target_version, &binary_name).await?;

    println!("Downloading CLI binary...");
    let response = client.get(&url).send().await?;
    if !response.status().is_success() {
        return Err(Error::Network(format!(
            "Failed to download CLI binary. Status: {}",
            response.status()
        )));
    }

    let total_size = response.content_length();
    let mut file = File::create(target_dir.join(format!("{}.download", binary_name)))?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(item) = stream.next().await {
        let chunk = item?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;

        if let Some(total) = total_size {
            let percent = (downloaded as f64 / total as f64) * 100.0;
            print!(
                "\rDownloading: {:.1}% ({}/{})",
                percent,
                crate::util::format_bytes(downloaded),
                crate::util::format_bytes(total)
            );
        } else {
            print!("\rDownloading: {}", crate::util::format_bytes(downloaded));
        }
        std::io::stdout().flush().ok();
    }
    println!("\nDownload completed. Verifying checksum...");

    let tmp_path = target_dir.join(format!("{}.download", binary_name));
    if let Err(e) = verify_checksum(&tmp_path, &expected_sha) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(e);
    }

    println!("Installing CLI binary...");
    if let Err(e) = install_binary_file(&tmp_path, target_path) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(e);
    }

    println!("CLI updated successfully to version v{}", target_version);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_binary_details() {
        let details = get_binary_details("1.0.0");
        assert!(details.is_ok());
        if let Ok((name, url)) = details {
            assert!(name.contains("tauri-app-template-cli"));
            assert!(url.contains("releases/download/v1.0.0"));
        }
    }

    #[test]
    fn test_verify_checksum_success() -> Result<(), Box<dyn std::error::Error>> {
        use std::io::Write;
        let mut temp_file = tempfile::NamedTempFile::new()?;
        let content = b"hello world";
        temp_file.write_all(content)?;

        let expected_sha = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
        let result = verify_checksum(temp_file.path(), expected_sha);
        assert!(result.is_ok());
        Ok(())
    }

    #[test]
    fn test_verify_checksum_failure() -> Result<(), Box<dyn std::error::Error>> {
        use std::io::Write;
        let mut temp_file = tempfile::NamedTempFile::new()?;
        let content = b"hello world";
        temp_file.write_all(content)?;

        let expected_sha = "wrong_sha";
        let result = verify_checksum(temp_file.path(), expected_sha);
        assert!(result.is_err());
        Ok(())
    }

    #[tokio::test]
    async fn test_get_expected_sha() -> Result<(), Box<dyn std::error::Error>> {
        let mut server = mockito::Server::new_async().await;
        let url = server.url();

        let body = serde_json::json!({
            "assets": [
                {
                    "name": "tauri-app-template-cli-linux-amd64",
                    "digest": "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
                }
            ]
        });

        let _mock = server
            .mock(
                "GET",
                "/repos/RandomlyZay-Labs/tauri-app-template/releases/tags/v1.0.0",
            )
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(serde_json::to_string(&body)?)
            .create_async()
            .await;

        let client = reqwest::Client::builder()
            .user_agent("tauri-app-template")
            .build()?;

        let res = get_expected_sha_from_base(
            &client,
            &url,
            "1.0.0",
            "tauri-app-template-cli-linux-amd64",
        )
        .await?;
        assert_eq!(
            res,
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );
        Ok(())
    }

    #[test]
    fn test_install_binary_file() -> Result<(), Box<dyn std::error::Error>> {
        use std::io::Write;
        let dir = tempfile::tempdir()?;
        let tmp_path = dir.path().join("tmp_binary.download");
        let target_path = dir.path().join("installed_binary");

        // Create a temp file to simulate the download
        {
            let mut file = File::create(&tmp_path)?;
            file.write_all(b"binary_content")?;
        }

        // Install it
        let install_res = install_binary_file(&tmp_path, &target_path);
        assert!(install_res.is_ok());

        // Assert target file exists
        assert!(target_path.exists());
        assert_eq!(
            target_path.file_name().ok_or("No file name")?,
            "installed_binary"
        );

        // Assert is executable on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = std::fs::metadata(&target_path)?;
            let mode = metadata.permissions().mode();
            assert_eq!(mode & 0o111, 0o111); // Assert executable permissions
        }
        Ok(())
    }
}
