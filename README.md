# DSH Desktop · Ethereal Edition

DeepSeek Harness 的 Windows 桌面客户端。内置 Node.js 与可离线启动的 Harness，提供原生窗口、托盘、背景主题、自动更新和一组桌面增强插件。

当前桌面版：**1.1.0**

## 与官方 Harness 的关系

本仓库不是 DeepSeek Harness 源码的副本，而是一个 Electron 桌面宿主：

- `dsh-desktop/` 内置经过验证的 `@deepseek-ai/dsh 0.1.0-rc.6` 作为离线兜底。
- 应用启动后可在用户确认下把官方最新版安装到数据目录 `agent/`；运行时优先使用该更新层，失败可回退到内置版。
- 新版官方 Harness 采用冻结的客户端平台模块表。内置客户端插件不再运行时依赖已移除的 `@deepseek-ai/dsh-client-web-react`。
- 桌面宿主启动 `dsh web` 时会在支持的版本上传入 `--no-open`，避免额外弹出系统浏览器。

这种两层结构是离线兜底与官方更新机制，不是重复安装目录。仓库不提交 `node_modules/`、`vendor/`、`dist/` 或运行数据。

## 主要功能

- 无边框原生窗口、系统托盘、关闭到托盘与异常恢复。
- 默认图片背景、深蓝半透明配色，并可从标题栏菜单更换或恢复背景。
- 官方 Harness 与桌面客户端分别检查更新，失败保持旧版。
- 文件变化查看与安全回退、会话浮窗、完成通知。
- 识图、自定义提示词、第三方模型思考强度、余额与 WSL 设置。
- VS Code 风格侧边栏、终端、文件树、Git、HTML 与端口预览。
- OpenClaw/ClawBot 微信桥接插件。

## 安装

安装包从 [GitHub Releases](https://github.com/teresasousa585-max/dsh-desktop-v1/releases/latest) 下载。

- 安装版数据目录：`%APPDATA%\DSH Desktop\`
- Harness 配置默认复用 `~\.dsh`
- 可通过 `DSH_HOME` 指定其他 Harness 配置目录

## 从源码构建

要求 Windows 10/11、Node.js 22.19+ 或 24+、npm。

```powershell
cd dsh-desktop
npm ci
npm run fetch-runtime
npm run pack     # 生成未安装目录，用于验证
npm run dist     # 生成 NSIS 安装包
```

生成目录均可安全删除并重新创建：

- `dsh-desktop/node_modules/`
- `dsh-desktop/vendor/`
- `dsh-desktop/dist/`

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `dsh-desktop/` | Electron 宿主、构建脚本、背景资源和内置插件 |
| `openclaw-dsh-bridge/` | ClawBot/微信到 DSH 会话的桥接插件 |
| `dsh-desktop/docs/` | 预设、许可、WSL 与排障说明 |

## 许可

本项目使用 MIT License。DeepSeek Harness 与内置第三方组件的来源和许可见 `dsh-desktop/docs/attributions.md`。
