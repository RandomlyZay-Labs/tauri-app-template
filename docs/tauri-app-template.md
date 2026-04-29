# Roadmap

## ci/linux-build
- Test DEB/RPM builds

## ci/appimage-build
- Test AppImage build

## ci/windows-build
- Test Windows build
  - Narrow down path in build.yml
  - Test installer and uninstaller

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
  - Update dependencies one last time
  - Implement final tests
  - Gemini codebase audit