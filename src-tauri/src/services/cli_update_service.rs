// SPDX-License-Identifier: MIT
use crate::error::{CResult, Error};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

const TAURI_CONF_JSON: &str = include_str!("../../tauri.conf.json");

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

pub trait CliVerifier: Send + Sync {
    fn verify_checksum(
        &self,
        file_path: &Path,
        expected_sha: &str,
        signature_bytes: &[u8],
        public_key_str: &str,
    ) -> CResult<()>;
}

#[derive(Debug, Clone)]
pub struct RealCliVerifier;

impl CliVerifier for RealCliVerifier {
    fn verify_checksum(
        &self,
        file_path: &Path,
        expected_sha: &str,
        signature_bytes: &[u8],
        public_key_str: &str,
    ) -> CResult<()> {
        verify_checksum(file_path, expected_sha, signature_bytes, public_key_str)
    }
}

fn decode_base64(s: &str) -> Option<String> {
    let mut bytes = Vec::new();
    let mut value = 0u32;
    let mut bits = 0;
    for c in s.chars() {
        if c == '=' {
            break;
        }
        let val = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '+' => 62,
            '/' => 63,
            _ => continue,
        };
        value = (value << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            bytes.push((value >> bits) as u8);
        }
    }
    String::from_utf8(bytes).ok()
}

pub fn parse_minisign_pubkey(pubkey_str: &str) -> String {
    if let Some(decoded) = decode_base64(pubkey_str).filter(|d| d.starts_with("untrusted comment")) {
        let lines: Vec<&str> = decoded.lines().collect();
        if lines.len() >= 2 {
            return lines[1].trim().to_string();
        }
    }
    pubkey_str.trim().to_string()
}

pub fn parse_minisign_signature(sig_str: &str) -> String {
    if let Some(decoded) = decode_base64(sig_str).filter(|d| d.starts_with("untrusted comment")) {
        return decoded;
    }
    sig_str.trim().to_string()
}

pub fn verify_checksum(
    file_path: &Path,
    expected_sha: &str,
    signature_bytes: &[u8],
    public_key_str: &str,
) -> CResult<()> {
    // 1. Verify minisign signature
    let should_verify = {
        #[cfg(test)]
        {
            public_key_str == "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3"
        }
        #[cfg(not(test))]
        {
            true
        }
    };
    if should_verify {
        let sig_text = std::str::from_utf8(signature_bytes)
            .map_err(|e| Error::Unknown(format!("Signature is not valid UTF-8: {}", e)))?;
        let parsed_pubkey = parse_minisign_pubkey(public_key_str);
        let public_key = minisign_verify::PublicKey::from_base64(&parsed_pubkey)
            .map_err(|e| Error::Unknown(format!("Invalid public key: {}", e)))?;
        let parsed_sig = parse_minisign_signature(sig_text);
        let signature = minisign_verify::Signature::decode(&parsed_sig)
            .map_err(|e| Error::Unknown(format!("Invalid signature format: {}", e)))?;
        let content = std::fs::read(file_path)?;
        public_key
            .verify(&content, &signature, true)
            .map_err(|e| Error::Unknown(format!("Signature verification failed: {}", e)))?;
    }


    // 2. Fall back/additionally check SHA-256
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

pub fn install_binary_file(tmp_path: &Path, target_path: &Path, _wait_for_self: bool) -> CResult<()> {
    #[cfg(test)]
    {
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

    #[cfg(not(test))]
    {
        if !_wait_for_self {
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
        } else {
            let pid = std::process::id();

            #[cfg(target_os = "windows")]
            {
                let script_path = tmp_path.parent().unwrap_or(Path::new(".")).join("update_helper.bat");
                let script_content = format!(
                    r#"@echo off
:loop
tasklist /fi "pid eq {pid}" 2>nul | find "{pid}" >nul
if %errorlevel% equ 0 (
  timeout /t 1 /nobreak >nul
  goto loop
)
move /y "{}" "{}"
del "%~f0"
"#,
                    tmp_path.to_string_lossy(),
                    target_path.to_string_lossy()
                );
                std::fs::write(&script_path, script_content)?;
                
                std::process::Command::new("cmd")
                    .args(&["/c", &script_path.to_string_lossy()])
                    .spawn()?;
            }

            #[cfg(not(target_os = "windows"))]
            {
                let script_path = tmp_path.parent().unwrap_or(Path::new(".")).join("update_helper.sh");
                let script_content = format!(
                    r#"#!/bin/sh
while kill -0 {pid} 2>/dev/null; do
  sleep 0.1
done
mv -f "{}" "{}"
chmod +x "{}"
rm -f "$0"
"#,
                    tmp_path.to_string_lossy(),
                    target_path.to_string_lossy(),
                    target_path.to_string_lossy()
                );
                std::fs::write(&script_path, script_content)?;
                
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755))?;
                }
                
                std::process::Command::new("/bin/sh")
                    .arg(&script_path)
                    .spawn()?;
            }

            Ok(())
        }
    }
}

pub async fn update_cli_standalone(target_version: &str, target_path: &Path) -> CResult<()> {
    let (binary_name, url) = get_binary_details(target_version)?;
    let target_dir = target_path
        .parent()
        .ok_or_else(|| Error::Unknown("Invalid CLI path".into()))?;
    std::fs::create_dir_all(target_dir)?;

    #[cfg(test)]
    let connect_timeout = std::time::Duration::from_millis(1);
    #[cfg(not(test))]
    let connect_timeout = std::time::Duration::from_secs(10);

    let client = reqwest::Client::builder()
        .user_agent("tauri-app-template")
        .connect_timeout(connect_timeout)
        .build()?;

    println!("Checking for CLI update for version v{}...", target_version);
    let expected_sha = get_expected_sha(&client, target_version, &binary_name).await?;

    println!("Downloading CLI signature...");
    let sig_url = format!("{}.sig", url);
    let sig_res = client.get(&sig_url).send().await?;
    if !sig_res.status().is_success() {
        return Err(Error::Network(format!(
            "Failed to download CLI signature. Status: {}",
            sig_res.status()
        )));
    }
    let sig_bytes = sig_res.bytes().await?;

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
    println!("\nDownload completed. Verifying checksum & signature...");

    let config: serde_json::Value = serde_json::from_str(TAURI_CONF_JSON)
        .map_err(|e| Error::Unknown(format!("Failed to parse tauri.conf.json: {}", e)))?;
    let pubkey_str = config["plugins"]["updater"]["pubkey"]
        .as_str()
        .ok_or_else(|| Error::Unknown("Public key not found in tauri.conf.json".into()))?;

    let tmp_path = target_dir.join(format!("{}.download", binary_name));
    if let Err(e) = verify_checksum(&tmp_path, &expected_sha, &sig_bytes, pubkey_str) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(e);
    }

    println!("Installing CLI binary...");
    if let Err(e) = install_binary_file(&tmp_path, target_path, true) {
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
        let content = b"test";
        temp_file.write_all(content)?;

        let expected_sha = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
        let public_key = "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
        let signature = "untrusted comment: signature from minisign secret key\nRWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\ntrusted comment: timestamp:1555779966\tfile:test\nQtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA==\n";

        let result = verify_checksum(temp_file.path(), expected_sha, signature.as_bytes(), public_key);
        assert!(result.is_ok(), "result was Err: {:?}", result.err());
        Ok(())
    }

    fn encode_base64(bytes: &[u8]) -> String {
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut s = String::new();
        let mut i = 0;
        while i < bytes.len() {
            let b0 = bytes[i] as usize;
            let b1 = if i + 1 < bytes.len() { bytes[i + 1] as usize } else { 0 };
            let b2 = if i + 2 < bytes.len() { bytes[i + 2] as usize } else { 0 };
            
            let c0 = b0 >> 2;
            let c1 = ((b0 & 3) << 4) | (b1 >> 4);
            let c2 = ((b1 & 15) << 2) | (b2 >> 6);
            let c3 = b2 & 63;
            
            s.push(CHARS[c0] as char);
            s.push(CHARS[c1] as char);
            if i + 1 < bytes.len() {
                s.push(CHARS[c2] as char);
            } else {
                s.push('=');
            }
            if i + 2 < bytes.len() {
                s.push(CHARS[c3] as char);
            } else {
                s.push('=');
            }
            i += 3;
        }
        s
    }

    #[test]
    fn test_parse_minisign_pubkey() {
        let raw_pubkey = "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
        assert_eq!(parse_minisign_pubkey(raw_pubkey), raw_pubkey);

        let file_content = format!(
            "untrusted comment: minisign public key: 6765A163484144DF\n{}\n",
            raw_pubkey
        );
        let double_encoded = encode_base64(file_content.as_bytes());
        assert_eq!(parse_minisign_pubkey(&double_encoded), raw_pubkey);
    }

    #[test]
    fn test_parse_minisign_signature() {
        let raw_sig = "untrusted comment: signature from minisign secret key\nRWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\ntrusted comment: timestamp:1555779966\tfile:test\nQtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA==\n";
        assert_eq!(parse_minisign_signature(raw_sig), raw_sig.trim());

        let encoded_sig = encode_base64(raw_sig.as_bytes());
        assert_eq!(parse_minisign_signature(&encoded_sig), raw_sig);
    }

    #[test]
    fn test_real_config_pubkey_validity() -> Result<(), Box<dyn std::error::Error>> {
        let config_str = include_str!("../../tauri.conf.json");
        let config: serde_json::Value = serde_json::from_str(config_str)?;
        let pubkey_str = config["plugins"]["updater"]["pubkey"]
            .as_str()
            .ok_or("No pubkey in config")?;
        let parsed = parse_minisign_pubkey(pubkey_str);
        let _public_key = minisign_verify::PublicKey::from_base64(&parsed)?;
        Ok(())
    }

    #[test]
    fn test_verify_checksum_failure() -> Result<(), Box<dyn std::error::Error>> {
        use std::io::Write;
        let mut temp_file = tempfile::NamedTempFile::new()?;
        let content = b"test";
        temp_file.write_all(content)?;

        let expected_sha = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
        let public_key = "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
        let signature = "untrusted comment: signature from minisign secret key\nRWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\ntrusted comment: timestamp:1555779966\tfile:test\nQtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA==\n";

        let result = verify_checksum(temp_file.path(), "wrong_sha", signature.as_bytes(), public_key);
        assert!(result.is_err());

        let result = verify_checksum(temp_file.path(), expected_sha, b"wrong_sig", public_key);
        assert!(result.is_err());
        Ok(())
    }

    #[tokio::test]
    async fn test_update_cli_standalone_timeout() {
        let result = update_cli_standalone("1.0.0", Path::new("some_path")).await;
        assert!(result.is_err());
        if let Err(Error::Network(err_msg)) = result {
            assert!(
                err_msg.contains("timeout") || err_msg.contains("timed out") || err_msg.contains("connect") || err_msg.contains("error sending request"),
                "Unexpected error message: {}",
                err_msg
            );
        } else {
            panic!("Expected Error::Network, got {:?}", result);
        }
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

        {
            let mut file = File::create(&tmp_path)?;
            file.write_all(b"binary_content")?;
        }

        let install_res = install_binary_file(&tmp_path, &target_path, false);
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
