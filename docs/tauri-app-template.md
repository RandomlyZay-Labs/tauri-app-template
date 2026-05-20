# Roadmap

## ci/updater-plugin

- Set up Tauri updater plugin for AppImage and NSIS bundles
  - Test by making a change, pushing a new release, seeing if the app notifies me of an update, and having the app update
  - Test auto-update flow on AppImage and NSIS bundles
  - Research updating across multiple versions

## feat/github-pages

- Set up GitHub Pages
- Create basic landing page
  - OS-dependent download links
- Embed repo metadata in DEB and RPM releases
- Set up DEB and RPM repository metadata and point them to GitHub Releases
- Test auto-update flow on DEB and RPM bundles
  
## chore/release-prep

- Template Finalization
  - Update README template
  - Implement final tests
  - Update dependencies one last time
  - AI codebase audit
  - Create a release
