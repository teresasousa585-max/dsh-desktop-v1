# DSH Desktop · Ethereal Edition

> A Windows-native workstation for DeepSeek Harness.
> Double-click to run. No Node install. No terminal required.

---

## What it is

DSH Desktop is a desktop shell for DeepSeek Harness (dsh), customized by **Ethereal**.
It turns the agent workbench — normally started from a terminal — into a real desktop app: native windows, system tray, self-updates.

**One-line difference from the official web version**: they give you a webpage; this gives you a program.

---

## Highlights

| Capability | Notes |
| --- | --- |
| Zero-dependency launch | Bundled Node runtime + full dsh stack, works offline |
| Native window | Frameless glass bar, tray icon, close-to-tray |
| Session management | Parallel sessions, file-change tracking, one-click revert |
| Vision | Text-only models can still read images (any OpenAI-compatible VLM) |
| Plugin ecosystem | Built-in plugin marketplace + runtime injector, no restarts |
| WeChat remote | Drive the agent from WeChat via the official ClawBot channel |
| Auto-update | Agent and client updates with automatic rollback |
| Minimal preset | Windows-friendly preset: PowerShell instead of bash |

---

## Install

Only the **installer build** (NSIS) is published:

| Channel | Download |
| --- | --- |
| GitHub Release | [DSH-Desktop-Setup-1.0.2-x64.exe](https://github.com/teresasousa585-max/dsh-desktop-v1/releases/latest/download/DSH-Desktop-Setup-1.0.2-x64.exe) |

- Data directory: `%APPDATA%\DSH Desktop\`
- Override config location: set `DSH_HOME` before launching

---

## Quick start

1. Install and launch, wait for the Web UI.
2. Add a DeepSeek API Key in settings (or reuse `~/.dsh/.credentials.yaml`).
3. New sessions use the "minimal grayscale" preset: PowerShell, slim tools, sidebar collapsed.
4. For image understanding: Settings → Vision, fill baseURL / key / model (default free `glm-4.6v-flash`).
5. For WeChat control: Settings → ClawBot, scan to bind, then send tasks from WeChat.

---

## Build from source

```powershell
cd dsh-desktop
npm install
npm run fetch-runtime   # download bundled node + npm
npm run dist            # produces dist\DSH-Desktop-Setup-<version>-x64.exe
```

> Installer-only by default; tweak `electron-builder.yml` for a portable build.

---

## Repository layout

| Path | Contents |
| --- | --- |
| `dsh-desktop/` | Electron shell, build scripts, bundled companion plugins |
| `openclaw-dsh-bridge/` | WeChat ClawBot → DSH bridge plugin |

---

## License

- MIT License
- Maintainer: Ethereal
- Bundled third-party plugins are MIT; details in `dsh-desktop/docs/attributions.md`
