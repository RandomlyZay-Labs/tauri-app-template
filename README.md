# Tauri App Template

[![Build Status](https://github.com/RandomlyZay-Labs/tauri-app-template/actions/workflows/build.yml/badge.svg)](https://github.com/RandomlyZay-Labs/tauri-app-template/actions)
[![Release](https://img.shields.io/github/v/release/RandomlyZay-Labs/tauri-app-template)](https://github.com/RandomlyZay-Labs/tauri-app-template/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-24c8db.svg)](https://tauri.app/)

A production-ready boilerplate for building high-performance, cross-platform desktop applications using **Tauri v2**, **Svelte 5**, and **Rust**.

It handles the annoying boilerplate like database wiring, IPC type-safety, and CI/CD pipelines so you can actually focus on writing your app's features instead of fighting configuration files.

## 🛠 Tech Stack

**Frontend:**
- Svelte 5 
- TypeScript & Vite
- Tailwind CSS v4 + Shadcn-Svelte + Bits UI
- Lucide Icons

**Backend:**
- Tauri 2.0 (Rust)
- SQLite powered by SQLx (with automated migrations)
- Type-safe IPC via [Specta](https://github.com/oscartbeaumont/tauri-specta)

**Tooling & Testing:**
- Vitest for frontend unit/component tests (with full Tauri IPC mocking)
- Playwright for E2E testing
- Cargo test for Rust logic
- Biome for insanely fast formatting and linting
- GitHub Actions for building cross-platform artifacts

## 🚀 Getting Started

### 1. Prerequisites
You need the standard Tauri dev environment. Make sure you've got:
- **Rust**: The compiler and cargo.
- **Node.js**: v20+ 
- **pnpm**: `npm install -g pnpm`
- **SQLx CLI**: `cargo install sqlx-cli --no-default-features --features sqlite`

### 2. Setup
Clone this repository:

```bash
git clone [https://github.com/RandomlyZay-Labs/tauri-app-template.git](https://github.com/RandomlyZay-Labs/tauri-app-template.git) my-app
cd my-app
```

Install the dependencies and bootstrap the local database:

```bash
pnpm install
pnpm bootstrap
```
*Note: `pnpm bootstrap` handles setting up your `.env` file and running the initial SQLx migrations against the local `dev_data/` SQLite database.*

### 3. Development
Fire up the dev server with hot-reloading:

```bash
pnpm tauri dev
```

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

## 🧪 Testing

We don't skip testing here. 

- **Frontend Unit/Component (Vitest):** `pnpm test:frontend`
- **Backend (Cargo):** `pnpm test:backend`
- **E2E (Playwright):** `pnpm test:e2e`

*Pro-tip: The E2E tests use a mock IPC layer so you don't have to spin up the actual Rust backend every single time. It keeps things fast and deterministic.*

## 📦 Building for Production

When you're ready to ship, just run:

```bash
pnpm tauri build
```
Or let the GitHub Actions pipeline do the heavy lifting. Pushing a release will automatically compile and spit out bundles for Windows and Linux (macOS coming soon).

## 🐧 Linux AppImage Compatibility

If Linux AppImage users experience UI freezing, blank screens, or WebKitGTK rendering issues, they can run the AppImage with the `--compat` flag:

```bash
./your-app.AppImage --compat
```

This disables WebKitGTK's DMABUF renderer (`WEBKIT_DISABLE_DMABUF_RENDERER=1`) to bypass driver conflicts.

## 🤝 Contributing

Want to make this template even better? PRs are welcome. 
