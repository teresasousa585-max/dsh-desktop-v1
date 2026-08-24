# DSH Desktop · Ethereal Edition

A Windows desktop host for DeepSeek Harness. It bundles Node.js and an offline-capable Harness fallback, then adds a native window, tray integration, backgrounds, updates, and desktop companion plugins.

Current desktop version: **1.1.0**

## Relationship with official Harness

This repository is an Electron host, not a copy of the DeepSeek Harness source tree:

- `dsh-desktop/` bundles the tested `@deepseek-ai/dsh 0.1.0-rc.6` release as an offline fallback.
- With user approval, the app installs the latest official Harness under the writable `agent/` data directory. That overlay takes precedence and can be rolled back.
- Companion client plugins follow the current frozen platform-module contract and no longer require the removed `@deepseek-ai/dsh-client-web-react` seed at runtime.
- Supported Harness releases are launched with `--no-open`, so the Web UI appears only in the desktop window unless the user explicitly opens it in a browser.

The two Harness layers provide rollback and offline startup. Generated dependencies, runtimes, builds, and user data are not committed.

## Highlights

- Frameless native window, system tray, close-to-tray, and crash recovery.
- Image background with a readable dark-blue glass palette; change or reset it from the title-bar menu.
- Separate official Harness and desktop-client update flows with rollback.
- File-change review and safe revert, detached conversation windows, and completion notifications.
- Vision, custom prompts, third-party reasoning controls, balance, and WSL settings.
- VS Code-like sidebar with files, terminal, Git, HTML, and local-port previews.
- OpenClaw/ClawBot WeChat bridge.

## Install

Download the installer from [GitHub Releases](https://github.com/teresasousa585-max/dsh-desktop-v1/releases/latest).

## Build from source

Requires Windows 10/11, Node.js 22.19+ or 24+, and npm.

```powershell
cd dsh-desktop
npm ci
npm run fetch-runtime
npm run pack
npm run dist
```

`node_modules/`, `vendor/`, and `dist/` are generated and can be safely recreated.

## Repository layout

| Path | Contents |
| --- | --- |
| `dsh-desktop/` | Electron host, build scripts, background assets, companion plugins |
| `openclaw-dsh-bridge/` | ClawBot/WeChat to DSH session bridge |
| `dsh-desktop/docs/` | Presets, licenses, WSL, and troubleshooting notes |

## License

MIT. See `dsh-desktop/docs/attributions.md` for bundled third-party components.
