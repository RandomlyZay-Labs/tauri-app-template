# Roadmap

## fix/production-issues
- Adding to PATH (AppImage) needs a popup message after clicking:

```
**Success! `tauri-app-template` has been added to your system's PATH for easier CLI usage.**

To use the command in your terminal right now, run:
`tauri-app-template`

**Note:** On some systems (like Ubuntu), you may need to log out and log back in for this change to take effect permanently.
```

- PostHog works in dev but not in prod release.
- The system theme is not working on Fedora, but it is working on Ubuntu. If the user's system theme is set to dark, the app should be dark. If the user's system theme is set to light, the app should be light.
- Fix CLI usage on Windows. There is currently no output.
- Test installer and uninstaller on Windows.

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