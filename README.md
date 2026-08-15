# DSH Desktop · Ethereal Edition

> 把 DeepSeek Harness 塞进 Windows 桌面的一台「独立工作站」。
> 双击即用，自带运行时；不装 Node、不敲命令，agent 照样干活。

---

## 它是什么

DSH Desktop 是 DeepSeek Harness（dsh）的桌面外壳，也是我（Ethereal）的定制版。
它把原本要在终端里敲命令才能拉起来的 agent 工作台，变成一个**有窗口、有托盘、会自更新**的原生应用。

**一句话对比官方 Web 版**：官方给你一个网页，这里给你一个「程序」。

---

## 能干什么

| 能力 | 说明 |
| --- | --- |
| 零依赖启动 | 内置 Node 运行时 + dsh 全家桶，双击即用，离线可用 |
| 原生窗口 | 无边框玻璃栏、系统托盘、关闭最小化到托盘 |
| 会话管理 | 多会话并行、文件改动追踪、一键还原 |
| 识图 | 纯文本模型也能看图（任意 OpenAI 兼容 VLM） |
| 插件生态 | 内置插件市场 + 运行时注入器，装插件不重启 |
| 微信遥控 | 走官方 ClawBot 通道，在微信里指挥 agent |
| 自动更新 | agent 与客户端都能自动更新，失败自动回退 |
| 极简预设 | 面向 Windows 的 minimal 预设：PowerShell 替代 bash |

---

## 安装

只发布**安装版**（NSIS 安装器）：

| 渠道 | 下载 |
| --- | --- |
| GitHub Release | [DSH-Desktop-Setup-1.0.2-x64.exe](https://github.com/teresasousa585-max/dsh-desktop-v1/releases/latest/download/DSH-Desktop-Setup-1.0.2-x64.exe) |

- 安装后数据目录：`%APPDATA%\DSH Desktop\`
- 想换配置位置：启动前设置环境变量 `DSH_HOME`

---

## 快速上手

1. 安装并启动，等它进入 Web UI。
2. 首次使用在设置里填 DeepSeek API Key（或直接沿用 `~/.dsh/.credentials.yaml`）。
3. 新会话默认「极简灰度」预设：PowerShell 环境、工具精简、侧边栏默认收起。
4. 想看图：设置 → 识图插件，填 baseURL / key / model（默认智谱免费 `glm-4.6v-flash`）。
5. 想用微信遥控：设置 → ClawBot，扫码绑定后就能在微信里发任务。

---

## 从源码构建

```powershell
cd dsh-desktop
npm install
npm run fetch-runtime   # 下载内置 node + npm
npm run dist            # 产出 dist\DSH-Desktop-Setup-<版本>-x64.exe
```

> 默认只出安装版；需要便携版可自行改 `electron-builder.yml`。

---

## 仓库构成

| 目录 | 内容 |
| --- | --- |
| `dsh-desktop/` | Electron 桌面壳、构建脚本、内置配套插件 |
| `openclaw-dsh-bridge/` | 微信 ClawBot → DSH 的桥接插件 |

---

## 许可

- MIT License
- 维护者：Ethereal
- 内置第三方插件均为 MIT，明细见 `dsh-desktop/docs/attributions.md`
