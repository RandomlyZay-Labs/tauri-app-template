# Roadmap

## feat/cli-integration

- Push first release
- Add an in-app "Install CLI" button in Settings which downloads the correct CLI binary and installs it to the user's PATH automatically, replacing the existing entire "Integrate AppImage" feature
- Add CLI update manager to the app

## ci/updater-plugin

- Set up Tauri updater plugin
  - Test by making a change, pushing a new release, seeing if the app notifies me of an update, and having the app update
  - Test auto-update flow on all systems
  - Research updating across multiple versions

## chore/release-prep

- Template Finalization
  - Update README template
  - Uncomment `save-if` lines in build.yml
  - Bump up runner cores
  - Implement final tests
  - Update dependencies one last time
  - AI codebase audit
  - Create a release
