# Changelog — DSH Desktop

## [1.1.1] — 2026-08-24

### Vision routing

- Recognize `deepseek-v4-flash-vision-exp` as a native image-input model even when an older Harness adapter still reports text-only metadata.
- Hide the external `view_image` tool and its text-only prompt from native vision routes, while retaining it for text-only and unknown models.
- Guard tool execution as a second line of defense so native vision requests never spend the configured third-party vision API quota.

### Reliability

- Added regression tests for model selection, capability metadata, stale-adapter fallback, and text-only routing.
- Added a non-REST GitHub latest-release fallback so unauthenticated API rate limiting no longer disables desktop update checks.
- Made both package targets populate the bundled Node.js and npm runtime before electron-builder runs, preventing a successful-looking but unbootable build after cleaning generated files.

## [1.1.0] — 2026-08-24

### Compatibility

- Migrated all bundled client plugins away from the removed `@deepseek-ai/dsh-client-web-react` platform seed.
- Patched the installed OpenClaw bridge with the same React external-store adapter.
- Added version-aware `--no-open` startup for local and WSL modes, preventing new Harness releases from opening a second browser window while keeping rc.6 fallback compatibility.

### Appearance

- Added `assets/backgrounds/4.jpg` as the default background.
- Added persistent background selection and reset commands to the title-bar menu.
- Reworked the interface into one dark-blue translucent theme with a lighter image overlay and readable content panels.
- Removed the duplicated Material Design 3 theme files, installer scripts, settings observer, and inline theme branch.

### Maintenance

- Unified the desktop version to 1.1.0 in `package.json` and `package-lock.json`.
- Consolidated project documentation and removed obsolete 0.3.x audit/release notes.
- Kept the tested Harness rc.6 package set as the explicit offline fallback; official releases continue to arrive through the user-approved overlay updater.

## [1.0.2] — 2026-08-16

- Removed the desktop-pet bundle.
- Made the better-sidebar workspace collapsed by default.
- Published installer-only NSIS builds.

## [1.0.1] — 2026-08-16

- Removed donation UI and sponsor assets.
- Consolidated desktop update metadata on the current GitHub repository.

## [1.0.0] — 2026-08-16

- Established the Ethereal desktop release line and independent update source.
