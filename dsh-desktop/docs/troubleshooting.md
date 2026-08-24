# DSH Desktop 排障手册（v1.1.0）

## 首先收集日志

安装版日志通常位于 `%APPDATA%\DSH Desktop\logs\`：

- `desktop.log`：桌面宿主、更新、窗口与启动流程。
- `dsh-web.log`：Harness 插件树和 Web 服务输出。
- `apply-update.log`：客户端安装更新失败时使用。
- `run-state.json`：上次退出和渲染恢复状态。

## 常见问题

### `Failed to load plugins` / `dsh-client-web-react missed the module table`

官方新版不再把 `@deepseek-ai/dsh-client-web-react` 放入 Web 平台模块表。v1.1.0 已迁移全部内置插件；若错误来自用户自行安装的插件，需要升级该插件或把 `bindSnapshotSelector` 改为基于 React `useSyncExternalStore` 的本地实现。

### 启动时额外弹出浏览器

官方新版 `dsh web` 默认打开系统浏览器。v1.1.0 对支持的版本自动传入 `--no-open`。确认已经完全退出旧进程并重新启动新版桌面客户端。

### 背景过暗或需要更换

使用标题栏 `⋯` →“更换背景图片…”；支持 JPG、PNG、WebP、GIF 和 BMP，最大 25MB。“恢复默认背景”会重新使用内置图片。

### 更新后启动失败

桌面客户端保留内置 Harness 兜底。启动失败对话框中选择回退到内置版本，随后查看 `dsh-web.log`。不要直接删除 `~\.dsh`，其中包含会话、设置和凭据。

### 无法选择工作区

查看 `desktop.log` 是否包含 `koffi` 或 directory picker worker 错误。客户端会尝试退化到浏览器内目录选择器；仍失败时重新安装客户端并保留数据目录。

## 源码自检

```powershell
cd dsh-desktop
npm ci
node scripts/check-syntax.js
npm run pack
```
