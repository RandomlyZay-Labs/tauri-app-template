# Roadmap

## feat/ui-polish
- Use button groups for browse file and folder buttons and in settings
- Replace custom badges with ShadCN badges
- Use ShadCN's kbd component for the home page
- Replace custom progress bar with ShadCN's progress component
- Replace custom spinner with ShadCN's spinner component

- Move minimize to tray setting to general settings right at the top. Move Storage and Log settings to debug settings, under debug mode.
- Allow "Notify when minimized" setting tooltip to be visible, even if it's parent setting is disabled
- Change backup dropdowns to sliders
- Remove process control setting.

- Use ShadCN sonner instead of svelte-sonner directly.
- Add a setting to control where the sonner will be (e.g. top-right, bottom-left, etc.); default to top-right.
- Only allow some notifications to go to the notification center

- Remove "The quick brown fox jumps over the lazy dog" placeholder text
- Remove spinning star from about page.
- Add cool animated and interactive effects to the about page.
- Find something to do with the heart at the top of the page.

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
