# Tauri App Template

[![Build Status](https://github.com/RandomlyZay-Labs/tauri-app-template/actions/workflows/build.yml/badge.svg)](https://github.com/RandomlyZay-Labs/tauri-app-template/actions)
[![Release](https://img.shields.io/github/v/release/RandomlyZay-Labs/tauri-app-template)](https://github.com/RandomlyZay-Labs/tauri-app-template/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-24c8db.svg)](https://tauri.app/)

A production-ready boilerplate for building high-performance, cross-platform desktop applications using **Tauri v2**, **Svelte 5**, and **Rust**.

It handles the annoying boilerplate like database wiring, IPC type-safety, and CI/CD pipelines so you can focus on writing your app's features instead of fighting configuration files.

## 🛠 Tech Stack

**Frontend:**
- Svelte 5 
- TypeScript & Vite
- Tailwind CSS v4 + Shadcn-Svelte + Bits UI
- Lucide Icons

**Backend:**
- Tauri 2.0 (Rust)
- SQLite powered by SQLx
- Type-safe IPC via [Specta](https://github.com/oscartbeaumont/tauri-specta)

**Tooling & Testing:**
- Vitest for frontend unit/component tests (with full Tauri IPC mocking)
- Playwright for E2E testing
- Cargo test for Rust logic
- Biome for insanely fast formatting and linting
- GitHub Actions for building cross-platform artifacts

---

## 🚀 Getting Started

### 1. Prerequisites

You need the standard Tauri dev environment. Make sure you have:
- **Tauri**: Follow the official Tauri setup guide for your platform: https://v2.tauri.app/start/prerequisites/
- **pnpm**: Follow the installation guide: https://pnpm.io/installation
- **SQLx CLI**: `cargo install sqlx-cli`

### 2. Setup Options

Choose one of the setup paths below to initialize your application.

#### Option A: Interactive Setup (Recommended)

This repository includes a cross-platform interactive setup script to automate configuration (GPG/Tauri key generation, GitHub Secrets setup, Fedora COPR creation, codebase renaming, and installing dependencies).

Clone this repository and run the automated script:

```bash
git clone https://github.com/RandomlyZay-Labs/tauri-app-template.git
cd tauri-app-template
node setup.js
```

*Note: You can also use `pnpm setup` after installing dependencies.*

#### Option B: Manual Setup

If you prefer to set up the repository step-by-step, perform the following:

1. **Clone & Install:**
   ```bash
   git clone https://github.com/RandomlyZay-Labs/tauri-app-template.git
   cd tauri-app-template
   pnpm install
   pnpm bootstrap
   ```
2. **Rename References:**
   Replace all instances of `tauri-app-template`, `Tauri App Template`, `tauri_app_template`, `TAURI_APP_TEMPLATE`, and `RandomlyZay-Labs` in the codebase with your app name casings and GitHub owner.

3. **Initialize Git:**
   ```bash
   git init
   git checkout -b dev
   git remote add origin https://github.com/<owner>/<repo>.git
   git add .
   git commit -m "feat: initial commit [skip ci]"
   git branch main
   ```
4. **Configure GitHub Repo Settings:**
   Use the `gh` CLI or GitHub Web UI to set the default branch to `dev`, enable auto-merge, disable rebase-merge, and set the homepage to your GitHub Pages URL: `https://<owner>.github.io/<repo>/`.

5. **Configure Branch Rulesets:**
   Set up status check protections for `dev` (requiring `Lint & Test` and `Validate PR title`) and `main` (requiring builds to pass and CodeQL checks).

6. **Set up Keys & secrets:** Refer to the [CI/CD & Tauri Updater Configuration](#-cicd--tauri-updater-configuration) section to manually configure GPG, Tauri signing keys, and repository secrets.

### 3. Development

Fire up the dev server:

```bash
pnpm tauri:dev
```

---

## 🧠 Architecture Overview

- `src/`: Where your Svelte frontend lives.
  - `features/`: The meat of your app, organized by domain (e.g., settings, home).
  - `components/ui/`: Shared Shadcn components. Do not manually edit these.
  - `stores/`: Global Svelte 5 Rune stores.
  - `bindings.ts`: **Auto-generated** by Specta. Never touch this file manually.
- `src-tauri/`: Your Rust backend.
  - `src/services/`: Core business logic. Keep it separate from the Tauri command wrappers.
  - `src/api.rs`: Where all Tauri commands are collected for Specta.
  - `migrations/`: SQLx migration files.

---

## 🧹 Linting & Testing

We do not skip testing here. 

- **Frontend Unit/Component (Vitest):** `pnpm test:frontend`
- **Backend (Cargo):** `pnpm test:backend`
- **E2E (Playwright):** `pnpm test:e2e`

*Pro-tip: The E2E tests use a mock IPC layer so you don't have to spin up the actual Rust backend every single time. It keeps things fast and deterministic.*

---

## 📦 Building for Production

When you are ready to ship, run:

```bash
pnpm tauri build
```

Or let the GitHub Actions pipeline compile and package your app. Pushing a release will automatically compile and output bundles for Windows and Linux.

---

## 🛠️ CI/CD & Tauri Updater Configuration

> [!WARNING]
> **Do not push directly to the `main` branch unless you want to trigger a production release.** The automated Semantic Release workflow triggers on every push to `main`. Always develop on separate branches and merge to `dev` first.

The CI/CD pipeline builds, signs, and packages the app for Windows (x64, ARM64) and Linux (amd64, arm64). It also publishes updates to GitHub Pages, deploys Debian/APT repository metadata, and triggers builds on Fedora COPR.

### 1. Tauri Updater Overview

Tauri's updater requires built artifacts to be signed with a private key.
- The CI pipeline compiles the app, signs the installer/AppImage, and generates a `latest.json` file.
- The app checks `latest.json` (hosted on GitHub Pages) to see if a newer version is available.
- If a newer version is found, it downloads the signed artifact and verifies it using the public key defined in `src-tauri/tauri.conf.json`.

To generate a new signing key pair, run:

```bash
pnpm tauri signer generate
```

1. Paste the generated public key into the `pubkey` field in `src-tauri/tauri.conf.json` under `plugins.updater`.
2. Save the private key. You will add this as a GitHub Secret.

### 2. GitHub Repository Secrets

Configure the following secrets in your GitHub Repository under **Settings > Secrets and variables > Actions**:

| Secret Name | Description | How to Generate / Obtain |
| --- | --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Private key used to sign Tauri update bundles. | Output of `pnpm tauri signer generate`. (Include the entire multiline string starting with `untrusted comment: ...`). |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Optional password for the Tauri private key. | Decryption passphrase for the private key if one was set during generation. |
| `RELEASE_TOKEN` | GitHub Personal Access Token (PAT) with `repo` scope. | Generate a classic PAT under your GitHub settings. Required for the release job to push tags, create releases, update/merge back branches, and deploy to GitHub Pages. If not specified, it falls back to `GITHUB_TOKEN` (which may lack permissions to trigger other workflows or bypass branch protection). |
| `POSTHOG_API_KEY` | Optional PostHog API Key for telemetry. | From https://app.posthog.com (Settings → Project API Key). If not set, PostHog telemetry is skipped/disabled at build time. |
| `GPG_PRIVATE_KEY` | GPG private key used to sign Debian `Release` metadata and RPM packages. | Generate a GPG key locally: `gpg --generate-key` (Use your app name, e.g. `<product_name>`). Export the private key: `gpg --armor --export-secret-keys "<product_name>"`. Paste the ASCII-armored block into the secret. |
| `COPR_WEBHOOK_URL` | Webhook URL to trigger a package build on Fedora COPR. | Copied from the Fedora COPR package settings under **Integrations > Rebuild Webhook**. |

### 3. Fedora COPR Setup

Fedora COPR (Community Projects Repository) allows you to distribute your app to Fedora, CentOS, RHEL, and other RPM-based distributions.

To set up your Fedora COPR repository:
1. Log in to [Fedora COPR](https://copr.fedorainfracloud.org/).

2. Click **New Project**.
   - **Project Name**: `<app_name>` (your app name).
   - Enable the chroots you want to build for (e.g., `fedora-rawhide-x86_64`, `fedora-44-x86_64`, `fedora-44-aarch64`).
   - Click **Save**.

3. Add a Package to the project:
   - Click **New Package**.
   - **Package Name**: `<app_name>`.
   - **Source Type**: Select **Scm** (Git).
   - **Clone URL**: `https://github.com/YourUsername/your-repo.git`
   - **Spec file path**: `src-tauri/resources/<app_name>.spec`
   - Click **Save**.

4. Configure the Webhook:
   - In COPR, go to the project's **Integrations** tab.
   - Copy the URL under **Custom Webhook**.
   - Add this URL to your GitHub Repository secrets as `COPR_WEBHOOK_URL`.

5. Update repository configs in the codebase:
   - Update `src-tauri/resources/<app_name>.repo` to point to your COPR project URL.
   - Update `src-tauri/tauri.conf.json` lines that reference the `.repo` filename to match your project name.

### 4. Debian APT Repository Setup

Debian APT repository generation is built directly into the release workflow:

1. The release job copies Debian `.deb` packages to a `debian/` directory on GitHub Pages.

2. It runs `dpkg-scanpackages` to generate the `Packages` list and `Packages.gz` archive.

3. It signs the repository metadata (`Release`, `InRelease`, `Release.gpg`) with your GPG key.

4. Users can install your app by importing your public GPG key and adding your GitHub Pages URL to their sources list:

   ```bash
   # Add public keyring
   sudo curl -fsSL https://<your-username>.github.io/<your-repo>/debian/<app_name>.gpg -o /etc/apt/keyrings/<app_name>.gpg

   # Add sources list
   sudo curl -fsSL https://<your-username>.github.io/<your-repo>/debian/<app_name>.list -o /etc/apt/sources.list.d/<app_name>.list

   # Install app
   sudo apt update && sudo apt install <app_name>
   ```

---

## 🐧 Linux AppImage Compatibility

If Linux AppImage users experience UI freezing, blank screens, or WebKitGTK rendering issues, they can run the AppImage with the `--compat` flag:

```bash
./your-app.AppImage --compat
```

This disables WebKitGTK's DMABUF renderer (`WEBKIT_DISABLE_DMABUF_RENDERER=1`) to bypass driver conflicts.

## 🤝 Contributing

Want to make this template even better? PRs are welcome.
