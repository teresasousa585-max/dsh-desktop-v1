'use strict';

// DSH Desktop — frameless window chrome + IPC bridge (sandbox-safe preload).
//
// 职责：
//   1. 向页面注入自绘窗口栏（36px 玻璃条）：拖拽区、圆角应用图标、
//      标题/版本、菜单按钮（⋯）、最小化/最大化/关闭按钮，替代被移除的
//      原生标题栏与 文件/视图/帮助 菜单栏。
//   2. 通过 contextBridge 暴露 window.dshDesktop（窗口控制 / 菜单动作 /
//      余额刷新），并把主进程推送的余额数据转发成 window 上的
//      "dsh-balance-changed" 事件，供 dsh-balance 插件消费。
//   3. 把 Web UI 内容下移 36px（body padding-top），保证自绘栏不遮挡界面。

const { contextBridge, ipcRenderer } = require('electron');

const BAR_ID = '__dsh_desktop_chrome__';
const BAR_HEIGHT = 40;
const FLOAT_BAR_ID = '__dsh_desktop_floatbar__';
const FLOAT_BAR_HEIGHT = 24;
const BG_ID = '__dsh_desktop_bg__';

// ---------------------------------------------------------------------------
// Bridge (always exposed; the balance plugin reads it, the web UI keeps the
// legacy dshDesktop.appVersion field working).
// ---------------------------------------------------------------------------

const dshDesktop = {
  appVersion: '', // 由 chrome:init 回填；旧字段保持存在
  appearance: {
    getBackground: () => ipcRenderer.invoke('dsh:background-get'),
    chooseBackground: () => ipcRenderer.invoke('dsh:background-choose'),
    resetBackground: () => ipcRenderer.invoke('dsh:background-reset'),
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke('chrome:window', { action: 'minimize' }),
    toggleMaximize: () => ipcRenderer.invoke('chrome:window', { action: 'toggle-maximize' }),
    close: () => ipcRenderer.invoke('chrome:window', { action: 'close' }),
    isMaximized: () => ipcRenderer.invoke('chrome:window', { action: 'is-maximized' }),
    setPosition: (x, y) => ipcRenderer.invoke('chrome:window', { action: 'set-position', x, y }),
    getPosition: () => ipcRenderer.invoke('chrome:window', { action: 'get-position' }),
    onMaximizeChange: (cb) => {
      const listener = (_e, isMax) => { try { cb(isMax); } catch {} };
      ipcRenderer.on('chrome:maximized', listener);
      return () => ipcRenderer.removeListener('chrome:maximized', listener);
    },
  },
  menu: {
    action: (action, payload) => ipcRenderer.invoke('chrome:menu', { action, ...payload }),
  },
  getInfo: () => ipcRenderer.invoke('chrome:init'),
  refreshBalance: () => ipcRenderer.invoke('dsh:balance-refresh'),
  // WSL 后端配置（设置页 dsh-wsl-settings 插件消费）。
  wsl: {
    getConfig: () => ipcRenderer.invoke('dsh:wsl-config'),
    saveConfig: (cfg) => ipcRenderer.invoke('dsh:wsl-config-save', { cfg }),
    recheck: () => ipcRenderer.invoke('dsh:wsl-recheck'),
  },
  // 插件市场：请求主进程原地重启 dsh web 服务（安装/卸载插件后生效）。
  restartService: () => ipcRenderer.invoke('chrome:restart-service', { intent: 'restart-service' }),
  // 「文件」视图的还原请求：changes = [{path, op, oldText, newText}]（逆序）。
  revertFiles: (changes) => ipcRenderer.invoke('dsh:file-revert', { changes }),
  // 「全部文件」视图：用系统默认程序打开项目文件。
  openPath: (path) => ipcRenderer.invoke('dsh:file-open', { path }),
  // 预览面板：用系统浏览器打开 URL（端口预览等）。
  openExternal: (url) => ipcRenderer.invoke('dsh:open-external', { url }),
  // 复制文本到剪贴板（更新源地址等）。
  copyText: (text) => ipcRenderer.invoke('dsh:copy-text', { text }),
  // 会话浮窗（分屏）：主窗请求把某个会话弹出到独立窗口；浮窗关闭自身。
  floatWindow: {
    open: (sessionId) => ipcRenderer.invoke('chrome:float-window', { action: 'open', sessionId }),
    close: () => ipcRenderer.send('float:close'),
  },
  // 恢复页面（assets/recovery.html）使用的动作与状态读取。
  recovery: {
    getState: () => ipcRenderer.invoke('chrome:recovery-state'),
    reload: () => ipcRenderer.invoke('chrome:recovery-reload'),
    restart: () => ipcRenderer.invoke('chrome:recovery-restart'),
    openLogs: () => ipcRenderer.invoke('chrome:recovery-open-logs'),
  },
};

contextBridge.exposeInMainWorld('dshDesktop', dshDesktop);

// ---------------------------------------------------------------------------
// Renderer 心跳：每 5s 向主进程上报一次。主进程用它兜底判定「挂起但
// Chromium 未发出 unresponsive 事件」的场景（窗口不可见时页面定时器会被
// 节流，主进程只对可见窗口做判定；重新可见时立即补报一次心跳）。
// ---------------------------------------------------------------------------
{
  const beat = () => {
    try { ipcRenderer.send('dsh:renderer-heartbeat'); } catch {}
  };
  beat();
  setInterval(beat, 5000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) beat();
  });
}

// 浮窗模式检测：preload 的 process.argv 由 webPreferences.additionalArguments 注入。
// 浮窗内注入 window.__DSH_FLOAT__ = { sessionId }，供 dsh-float-window 插件识别；
// 并注入一条更细的纯拖拽条（含关闭按钮），跳过完整自绘标题栏。
const FLOAT_ARG = process.argv.find((a) => a.startsWith('--dsh-float='));
const FLOAT_MODE = FLOAT_ARG ? { sessionId: FLOAT_ARG.slice('--dsh-float='.length) } : null;
if (FLOAT_MODE) {
  contextBridge.exposeInMainWorld('__DSH_FLOAT__', FLOAT_MODE);
  // 预置目标会话到 sessions 持久化，让 Web UI 一启动就选中目标会话。
  // 这是比「启动后再 sessions.open()」更可靠的做法：会话服务在 boot 早期
  // 尚未就绪时，open() 会抛 unknown session 导致浮窗空内容/假按键，
  // 而预置持久化让应用默认就带着目标会话首屏渲染。
  try {
    const key = 'dsh.sessions.current';
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object') {
      parsed.sessionId = String(FLOAT_MODE.sessionId);
      delete parsed.subagentAddress;
      localStorage.setItem(key, JSON.stringify(parsed));
    }
  } catch (_e) { /* 忽略持久化失败 */ }
}

// 页面异常 → 主进程日志（desktop.log），便于排查插件空白视图。
window.addEventListener('error', (e) => {
  try { ipcRenderer.send('dsh:page-error', 'window.onerror: ' + ((e && (e.message || e.error)) || 'unknown')); } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  try { ipcRenderer.send('dsh:page-error', 'unhandledrejection: ' + String((e && e.reason && (e.reason.message || e.reason)) || e)); } catch {}
});

// 余额推送 → window 事件（dsh-balance 插件订阅）。
ipcRenderer.on('dsh:balance', (_e, data) => {
  try { window.dispatchEvent(new CustomEvent('dsh-balance-changed', { detail: data })); } catch {}
});

// 上报「当前观看的会话」ID → 主进程（仅用于完成通知的调试日志）。
// 轮询读取 localStorage['dsh.sessions.current'].sessionId，仅在变化时发送。
{
  let lastReported = '';
  const reportCurrentSession = () => {
    try {
      const raw = localStorage.getItem('dsh.sessions.current');
      const parsed = raw ? JSON.parse(raw) : null;
      const id = parsed && typeof parsed === 'object' ? String(parsed.sessionId || '') : '';
      if (id && id !== lastReported) {
        lastReported = id;
        ipcRenderer.send('dsh:current-session', id);
      }
    } catch (_e) { /* 忽略；会话尚未就绪时无值，下次轮询再试 */ }
  };
  reportCurrentSession();
  setInterval(reportCurrentSession, 3000);
}

// ---------------------------------------------------------------------------
// Chrome DOM
// ---------------------------------------------------------------------------

const CHROME_CSS = `
#${BG_ID}{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;
  background-color:#060e20;background-position:center;background-size:cover;background-repeat:no-repeat}
#${BG_ID}::before{content:"";position:absolute;inset:0;
  background:linear-gradient(rgba(6,14,32,.22),rgba(6,14,32,.38)),
    radial-gradient(ellipse at center,transparent 56%,rgba(2,7,18,.16) 100%)}
html{background:transparent!important}
body{background:transparent!important}
html:root{
  color-scheme:dark;
  --dsw-alias-bg-base:rgba(9,15,32,.46)!important;
  --dsw-alias-bg-layer-1:rgba(15,24,54,.48)!important;
  --dsw-alias-bg-layer-2:rgba(22,34,72,.58)!important;
  --dsw-alias-bg-layer-3:rgba(17,29,62,.68)!important;
  --dsw-alias-bg-module-platform:rgba(13,23,52,.60)!important;
  --dsw-alias-border-l1:rgba(168,196,255,.22)!important;
  --dsw-alias-border-l2:rgba(120,156,255,.28)!important;
  --dsw-alias-state-business-primary:#789cff!important;
  --dsw-alias-brand-primary:#a8c4ff!important;
  --dsw-alias-interactive-bg-hover:rgba(120,156,255,.16)!important;
  --dsw-alias-label-primary:rgba(248,250,255,.96)!important;
  --dsw-alias-label-secondary:rgba(220,230,255,.82)!important;
  --dsw-alias-label-tertiary:rgba(182,198,232,.68)!important;
  --dsw-alias-label-caption:rgba(150,170,210,.56)!important}
#root{background:transparent!important;position:relative;z-index:1}
#${BAR_ID}{position:fixed;top:0;left:0;right:0;height:${BAR_HEIGHT}px;z-index:2147483000;
  display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 14px;
  -webkit-app-region:drag;user-select:none;box-sizing:border-box;
  font-family:var(--dsw-font-family,"Segoe UI","Microsoft YaHei",system-ui,sans-serif);
  background:linear-gradient(180deg,rgba(15,24,54,.74),rgba(9,15,32,.62));
  backdrop-filter:blur(24px) saturate(1.35);-webkit-backdrop-filter:blur(24px) saturate(1.35);
  border-bottom:1px solid rgba(168,196,255,.18);
  box-shadow:0 8px 32px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.06)}
#${BAR_ID}.dch-dragging{cursor:grabbing}
#${BAR_ID} .dch-left{display:flex;align-items:center;gap:12px;min-width:0}
#${BAR_ID} .dch-icon{width:20px;height:20px;border-radius:6px;display:block;flex:none;
  background:#f6f8fc;box-shadow:0 1px 4px rgba(0,0,0,.4)}
#${BAR_ID} .dch-title{font-size:12.5px;font-weight:600;letter-spacing:.2px;line-height:16px;
  color:var(--dsw-alias-label-primary,#eef2ff);white-space:nowrap}
#${BAR_ID} .dch-traffic{display:flex;align-items:center;gap:8px;-webkit-app-region:no-drag}
#${BAR_ID} .dch-tl{width:13px;height:13px;border-radius:50%;border:none;padding:0;position:relative;
  -webkit-app-region:no-drag;cursor:pointer;display:grid;place-items:center;outline:none;
  box-shadow:0 0 0 .5px rgba(0,0,0,.28),0 1px 2px rgba(0,0,0,.3);
  transition:filter .15s,box-shadow .15s,transform .15s}
#${BAR_ID} .dch-tl:hover{filter:brightness(1.08);transform:scale(1.06)}
#${BAR_ID} .dch-tl:active{filter:brightness(.92);transform:scale(.95)}
#${BAR_ID} .dch-tl-close{background:#ff5f57}
#${BAR_ID} .dch-tl-min{background:#febc2e}
#${BAR_ID} .dch-tl-max{background:#28c840}
#${BAR_ID} .dch-tl svg{opacity:0;transition:opacity .14s;color:rgba(0,0,0,.55)}
#${BAR_ID} .dch-traffic:hover .dch-tl svg{opacity:1}
#${BAR_ID} .dch-right{display:flex;align-items:center;gap:2px;-webkit-app-region:no-drag}
#${BAR_ID} .dch-btn{width:30px;height:28px;display:grid;place-items:center;border:none;border-radius:8px;
  background:transparent;color:var(--dsw-alias-label-secondary,#b8c5ea);cursor:pointer;padding:0;
  -webkit-app-region:no-drag;outline:none;transition:background .12s,color .12s}
#${BAR_ID} .dch-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09));
  color:var(--dsw-alias-label-primary,#eef2ff)}
#${BAR_ID} .dch-btn:active{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(255,255,255,.14))}
#${BAR_ID} .dch-close:hover{background:#e81123;color:#fff}
#${BAR_ID} .dch-menu{position:fixed;top:${BAR_HEIGHT + 8}px;right:8px;width:272px;z-index:2147483001;
  -webkit-app-region:no-drag;box-sizing:border-box;padding:6px;
  background:rgba(20,25,42,.78);
  border:1px solid rgba(255,255,255,.1);border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,.55),0 4px 16px rgba(0,0,0,.4);
  backdrop-filter:blur(28px) saturate(1.7);-webkit-backdrop-filter:blur(28px) saturate(1.7);
  color:#eef3ff;font-family:var(--dsw-font-family,"Segoe UI","Microsoft YaHei",system-ui,sans-serif)}
#${BAR_ID} .dch-mh{padding:8px 10px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));
  margin-bottom:6px}
#${BAR_ID} .dch-mh-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
#${BAR_ID} .dch-mh-sub{font-size:11px;color:#aab9dc;margin-top:3px;
  line-height:16px;display:flex;gap:8px;flex-wrap:wrap}
#${BAR_ID} .dch-item{display:flex;align-items:center;gap:8px;width:100%;min-height:30px;padding:5px 10px;
  border:none;border-radius:8px;background:transparent;color:#e4ebff;
  font:inherit;font-size:12.5px;line-height:18px;text-align:left;cursor:pointer;-webkit-app-region:no-drag}
#${BAR_ID} .dch-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
#${BAR_ID} .dch-item .dch-kbd{margin-left:auto;font-size:10.5px;color:var(--dsw-alias-label-caption,#5f6f9c);
  font-family:var(--ds-font-family-code,Consolas,monospace)}
#${BAR_ID} .dch-item .dch-check{margin-left:auto;color:var(--dsw-alias-state-success-primary,#3ddc84);font-size:12px}
#${BAR_ID} .dch-item[data-danger="1"]{color:var(--dsw-alias-state-error-primary,#ff7a85)}
#${BAR_ID} .dch-sep{height:1px;background:var(--dsw-alias-border-l2,rgba(255,255,255,.08));margin:5px 6px}
#${BAR_ID} .dch-repos{padding:6px 10px 10px;margin:2px 0 4px;border:1px solid rgba(168,196,255,.18);
  border-radius:10px;background:rgba(9,15,32,.94)}
#${BAR_ID} .dch-repos-title{font-size:11px;color:#9fb1d8;margin-bottom:4px}
#${BAR_ID} .dch-repo-row{display:flex;align-items:center;gap:6px;min-height:24px}
#${BAR_ID} .dch-repo-url{flex:1;min-width:0;font-size:11px;color:#bdc9e8;
  font-family:var(--ds-font-family-code,Consolas,monospace);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;user-select:text;cursor:text}
#${BAR_ID} .dch-copy{flex:none;appearance:none;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));
  background:transparent;color:#bdc9e8;border-radius:6px;padding:1px 8px;
  font-size:10.5px;cursor:pointer;font-family:inherit;line-height:16px}
#${BAR_ID} .dch-copy:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));
  color:var(--dsw-alias-label-primary,#e6ecff)}
/* ===== 对话 UI 毛玻璃（覆盖 dsh web 内层硬编码深色背景）
   关键：大面板不要 backdrop-filter，避免把底图磨成糊；只保留输入卡片的轻微磨砂。 ===== */
[class*="_frame"]{background-color:rgba(9,15,32,.36)!important}
[class*="_root"]{background-color:rgba(9,15,32,.30)!important}
[class*="_sidebarCol"]{background-color:rgba(13,23,52,.56)!important}
[class*="_composerSeat"]{background-image:none!important;background-color:rgba(9,15,32,.34)!important}
[class*="_card"]{background-color:rgba(22,34,72,.56)!important;
  backdrop-filter:blur(8px) saturate(1.2);-webkit-backdrop-filter:blur(8px) saturate(1.2)}
[class*="_bubble"]{background-color:rgba(22,34,72,.52)!important}
[class*="_output"]{background-color:rgba(13,23,52,.50)!important}
[class*="_fade"]{background-image:linear-gradient(rgba(6,14,32,0),rgba(6,14,32,.58))!important}
pre,code{background-color:rgba(8,14,31,.88)!important}
section[class*="_root"]{background-color:rgba(15,24,54,.58)!important}
button[class*="_newSession"]{background-color:rgba(22,34,72,.68)!important}

/* ===== 高级感润色 ===== */
/* 统一圆角 + 内高光边框 */
[class*="_frame"]{border-radius:12px!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),inset 0 0 60px rgba(0,0,0,.10)!important}
[class*="_root"]{border-radius:10px!important}
[class*="_sidebarCol"]{border-radius:10px!important;
  box-shadow:inset -1px 0 0 rgba(255,255,255,.05)!important}
/* 字体排版 */
body{font-family:"HarmonyOS Sans SC","Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif!important;line-height:1.55!important}
#${BAR_ID}{font-family:"Segoe UI Variable Display","Segoe UI Variable",Inter,"Segoe UI",sans-serif!important;letter-spacing:.3px!important}
pre,code{font-family:"JetBrainsMono Nerd Font",Consolas,"Cascadia Code",monospace!important}
/* 细滚动条 */
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:99px}
*::-webkit-scrollbar-thumb:hover{background:rgba(120,156,255,.62)}
/* Mac 按钮精致化：悬停发光+放大，按下凹陷 */
#${BAR_ID} .dch-tl{transition:filter .15s,box-shadow .15s,transform .15s!important}
#${BAR_ID} .dch-tl:hover{filter:brightness(1.08);transform:scale(1.12);
  box-shadow:0 0 0 1px rgba(255,255,255,.22),0 0 12px rgba(255,255,255,.18)!important}
#${BAR_ID} .dch-tl:active{transform:scale(.92)!important}
/* 侧栏 hover：渐变不是硬切 */
[class*="sessionRow"]{transition:background .2s ease,transform .2s ease!important}
[class*="sessionRow"]:hover{background:linear-gradient(90deg,rgba(120,156,255,.2),rgba(168,196,255,.1))!important;transform:translateX(2px)!important}
/* 消息入场：淡入 + 上移 */
[class*="_bubble"]{animation:dshFadeUp .25s ease both}
@keyframes dshFadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
/* 菜单弹出：fade + scale + 弹性 */
#${BAR_ID} .dch-menu{animation:dshMenuPop .18s cubic-bezier(.2,1.4,.4,1) both}
@keyframes dshMenuPop{from{opacity:0;transform:scale(.96) translateY(-4px)}to{opacity:1;transform:none}}
/* 侧栏宽度过渡 */
[class*="_sidebarCol"]{transition:width .18s ease!important}
/* 卡片 hover：微缩放 + 阴影 */
[class*="_card"]{transition:transform .18s ease,box-shadow .18s ease!important}
[class*="_card"]:hover{transform:scale(1.01);box-shadow:0 8px 30px rgba(0,0,0,.25),inset 0 0 0 1px rgba(255,255,255,.08)!important}
/* 输入框聚焦：accent 边框 + 外发光 + 光标色 */
textarea,input,[contenteditable="true"]{caret-color:#789CFF!important}
[class*="_card"]:focus-within{border-color:rgba(120,156,255,.62)!important;
  box-shadow:0 0 0 3px rgba(120,156,255,.2),0 8px 30px rgba(0,0,0,.28)!important}
/* 自定义玻璃通知卡片 */
#__dsh_toast_root__{position:fixed;top:48px;right:16px;z-index:2147483002;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.dsh-toast{pointer-events:auto;width:320px;border-radius:14px;padding:12px 14px;color:#e6dce8;
  background:rgba(34,28,40,.72);border:1px solid rgba(255,255,255,.12);
  box-shadow:0 16px 48px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
  backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);
  animation:dshToastIn .28s cubic-bezier(.2,1.4,.4,1) both}
.dsh-toast-title{font-size:13px;font-weight:600;color:#fff;margin-bottom:3px}
.dsh-toast-body{font-size:12px;color:rgba(230,220,232,.85);line-height:1.5}
.dsh-toast.out{animation:dshToastOut .22s ease both}
@keyframes dshToastIn{from{opacity:0;transform:translateX(16px) scale(.96)}to{opacity:1;transform:none}}
@keyframes dshToastOut{to{opacity:0;transform:translateX(16px) scale(.96)}}
`;

const GLYPHS = {
  menu: '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="2.4" cy="6" r="1.15"/><circle cx="6" cy="6" r="1.15"/><circle cx="9.6" cy="6" r="1.15"/></svg>',
  min: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"><path d="M2.5 6h7"/></svg>',
  max: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="2.6" y="2.6" width="6.8" height="6.8" rx="1.4"/></svg>',
  restore: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M4.2 4.2V2.6h5.2v5.2H7.8"/><rect x="2.6" y="4.2" width="5.2" height="5.2" rx="1.2"/></svg>',
  close: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M2.6 2.6l6.8 6.8M9.4 2.6l-6.8 6.8"/></svg>',
  macClose: '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 2l4 4M6 2L2 6"/></svg>',
  macMin: '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M1.5 4h5"/></svg>',
  macMax: '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4 1.5v5M1.5 4h5"/></svg>',
};

let menuOpen = false;
let menuEl = null;
let maxBtn = null;
let state = { appVersion: '', agentVersion: '', agentSource: '', notifyOnTurnEnd: true, closeToTray: true, showBalanceDock: true };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderMenu() {
  if (!menuEl) return;
  menuEl.innerHTML = `
    <div class="dch-mh">
      <div class="dch-mh-title">DSH Desktop</div>
      <div class="dch-mh-sub"><span>agent v${esc(state.agentVersion)}</span><span>${esc(state.agentSource)}</span></div>
    </div>
    <button class="dch-item" data-act="check-agent-update">检查 dsh 更新…</button>
    <button class="dch-item" data-act="check-client-update">检查客户端更新…</button>
    <div class="dch-repos">
      <div class="dch-repos-title">更新源（点击复制）</div>
      <div class="dch-repo-row">
        <span class="dch-repo-url" title="${esc(state.repoUrls ? state.repoUrls.github : '')}">${esc(state.repoUrls ? state.repoUrls.github : '')}</span>
        <button class="dch-copy" data-copy="github" title="复制地址">复制</button>
      </div>
    </div>
    <button class="dch-item" data-act="toggle-notify"><span>会话完成通知</span>${state.notifyOnTurnEnd ? '<span class="dch-check">✓</span>' : ''}</button>
    <button class="dch-item" data-act="toggle-close-to-tray"><span>关闭时最小化到托盘</span>${state.closeToTray ? '<span class="dch-check">✓</span>' : ''}</button>
    <button class="dch-item" data-act="toggle-balance"><span>显示余额/本轮费用</span>${state.showBalanceDock ? '<span class="dch-check">✓</span>' : ''}</button>
    <div class="dch-sep"></div>
    <button class="dch-item" data-act="choose-background"><span>更换背景图片…</span></button>
    <button class="dch-item" data-act="reset-background"><span>恢复默认背景</span></button>
    <div class="dch-sep"></div>
    <button class="dch-item" data-act="reload"><span>重新加载</span><span class="dch-kbd">Ctrl+R</span></button>
    <button class="dch-item" data-act="devtools"><span>开发者工具</span><span class="dch-kbd">F12</span></button>
    <button class="dch-item" data-act="fullscreen"><span>全屏</span><span class="dch-kbd">F11</span></button>
    <div class="dch-sep"></div>
    <button class="dch-item" data-act="open-browser">在浏览器中打开</button>
    <button class="dch-item" data-act="open-logs">打开日志目录</button>
    <div class="dch-sep"></div>
    <button class="dch-item" data-act="about">关于 DSH Desktop</button>
    <button class="dch-item" data-danger="1" data-act="quit">退出</button>`;
  menuEl.querySelectorAll('.dch-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const act = item.dataset.act;
      if (act === 'toggle-notify' || act === 'toggle-close-to-tray' || act === 'toggle-balance') {
        const next = await dshDesktop.menu.action(act);
        if (next) state = { ...state, ...next };
        renderMenu();
        return;
      }
      if (act === 'choose-background' || act === 'reset-background') {
        closeMenu();
        const result = act === 'choose-background'
          ? await dshDesktop.appearance.chooseBackground()
          : await dshDesktop.appearance.resetBackground();
        if (result && result.ok) {
          applyBackground(result);
          showGlassToast('背景已更新', result.name || '已应用新的背景图片');
        } else if (result && !result.canceled) {
          showGlassToast('背景更新失败', result.error || '无法读取所选图片');
        }
        return;
      }
      closeMenu();
      dshDesktop.menu.action(act);
    });
  });
  // 更新源复制按钮
  menuEl.querySelectorAll('.dch-copy').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const kind = btn.dataset.copy;
      const url = state.repoUrls && kind === 'github' ? state.repoUrls.github : '';
      if (!url) return;
      const r = await dshDesktop.copyText(url);
      if (r && r.ok) {
        const prev = btn.textContent;
        btn.textContent = '已复制 ✓';
        setTimeout(() => { btn.textContent = prev; }, 1200);
      }
    });
  });
}

function closeMenu() {
  menuOpen = false;
  if (menuEl) menuEl.hidden = true;
}

function openMenu() {
  if (!menuEl) return;
  dshDesktop.getInfo().then((info) => {
    if (info) state = { ...state, ...info };
    renderMenu();
    menuOpen = true;
    menuEl.hidden = false;
  }).catch(() => {
    renderMenu();
    menuOpen = true;
    menuEl.hidden = false;
  });
}

function setMaximized(isMax) {
  if (!maxBtn) return;
  maxBtn.innerHTML = isMax ? GLYPHS.restore : GLYPHS.max;
  maxBtn.title = isMax ? '还原' : '最大化';
  maxBtn.setAttribute('aria-label', maxBtn.title);
}

function applyBackground(result) {
  const bg = document.getElementById(BG_ID);
  if (!bg || !result || !result.ok || !result.dataUrl) return;
  bg.style.backgroundImage = `url("${result.dataUrl}")`;
  bg.dataset.backgroundName = result.name || '';
}

function injectFloatBar() {
  if (document.getElementById(FLOAT_BAR_ID)) return;
  const style = document.createElement('style');
  style.textContent = `
  #${FLOAT_BAR_ID}{position:fixed;top:0;left:0;right:0;height:${FLOAT_BAR_HEIGHT}px;z-index:2147483000;
    display:flex;align-items:center;justify-content:flex-end;gap:2px;padding:0 6px 0 10px;
    -webkit-app-region:drag;user-select:none;box-sizing:border-box;
    background:color-mix(in srgb,var(--dsw-alias-bg-base,#0b1220) 70%,transparent);
    border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,rgba(255,255,255,.09)) 50%,transparent)}
  #${FLOAT_BAR_ID} button{width:26px;height:22px;display:grid;place-items:center;border:none;border-radius:7px;
    background:transparent;color:var(--dsw-alias-label-secondary,#b8c5ea);cursor:pointer;padding:0;
    -webkit-app-region:no-drag;outline:none;transition:background .12s,color .12s}
  #${FLOAT_BAR_ID} button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09));
    color:var(--dsw-alias-label-primary,#eef2ff)}
  #${FLOAT_BAR_ID} button.df-close:hover{background:#e81123;color:#fff}`;
  document.head.appendChild(style);
  const layout = document.createElement('style');
  layout.textContent = `body{box-sizing:border-box!important;padding-top:${FLOAT_BAR_HEIGHT}px!important}`;
  document.head.appendChild(layout);
  // 向页面声明浮窗拖拽条高度，供 fixed 定位的侧边栏使用。
  // 读取该属性自动下移顶部标签条，body padding 只对普通流内容生效。
  document.documentElement.setAttribute('data-dsh-title-bar-height', String(FLOAT_BAR_HEIGHT));
  const bar = document.createElement('div');
  bar.id = FLOAT_BAR_ID;
  bar.innerHTML = `<button class="df-close" title="关闭" aria-label="关闭">${GLYPHS.close}</button>`;
  document.body.appendChild(bar);
  bar.querySelector('.df-close').addEventListener('click', () => dshDesktop.floatWindow.close());
}

function injectChrome() {
  if (FLOAT_MODE) { injectFloatBar(); return; }
  if (document.getElementById(BAR_ID)) return;
  const style = document.createElement('style');
  style.textContent = CHROME_CSS;
  document.head.appendChild(style);

  // 内容区整体下移，避免遮挡 Web UI 顶部。
  const layout = document.createElement('style');
  layout.textContent = `body{box-sizing:border-box!important;padding-top:${BAR_HEIGHT}px!important}`;
  document.head.appendChild(layout);
  // 向页面声明自绘标题栏高度，供 fixed 定位的侧边栏使用。
  // 读取该属性自动下移顶部标签条，body padding 只对普通流内容生效。
  document.documentElement.setAttribute('data-dsh-title-bar-height', String(BAR_HEIGHT));

  const bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.innerHTML = `
    <div class="dch-left">
      <div class="dch-traffic" title="窗口控制">
        <button class="dch-tl dch-tl-close" data-act="close" title="关闭" aria-label="关闭">${GLYPHS.macClose}</button>
        <button class="dch-tl dch-tl-min" data-act="min" title="最小化" aria-label="最小化">${GLYPHS.macMin}</button>
        <button class="dch-tl dch-tl-max" data-act="max" title="最大化" aria-label="最大化">${GLYPHS.macMax}</button>
      </div>
      <img class="dch-icon" alt="" draggable="false" />
      <span class="dch-title">DSH Desktop</span>
    </div>
    <div class="dch-right">
      <button class="dch-btn" data-act="menu" title="菜单" aria-label="菜单">${GLYPHS.menu}</button>
    </div>
    <div class="dch-menu" hidden></div>`;
  document.body.appendChild(bar);

  // 内嵌背景图层（毛玻璃底图）。置于 body 末尾、z-index:-1，
  // 透过透明化的 html/body/#root 显示出来。
  const bg = document.createElement('div');
  bg.id = BG_ID;
  bg.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bg);
  dshDesktop.appearance.getBackground().then(applyBackground).catch(() => {});

  const icon = bar.querySelector('.dch-icon');
  maxBtn = bar.querySelector('[data-act="max"]');
  menuEl = bar.querySelector('.dch-menu');

  bar.querySelector('[data-act="min"]').addEventListener('click', () => dshDesktop.windowControls.minimize());
  bar.querySelector('[data-act="max"]').addEventListener('click', () => dshDesktop.windowControls.toggleMaximize());
  bar.querySelector('[data-act="close"]').addEventListener('click', () => dshDesktop.windowControls.close());
  bar.querySelector('[data-act="menu"]').addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuOpen) closeMenu(); else openMenu();
  });

  // 原生拖拽：标题栏 -webkit-app-region:drag，系统处理移动，不会改变窗口大小。

  document.addEventListener('click', (e) => {
    if (menuOpen && !bar.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // 初始化状态
  dshDesktop.getInfo().then((info) => {
    if (!info) return;
    state = { ...state, ...info };
    if (info.iconDataUri) icon.src = info.iconDataUri;
  }).catch(() => {});
  dshDesktop.windowControls.isMaximized().then(setMaximized).catch(() => {});
  dshDesktop.windowControls.onMaximizeChange(setMaximized);
}

// ===== 玻璃通知卡片（in-app toast） =====
let toastRoot = null;
function showGlassToast(title, body) {
  try {
    if (!toastRoot) {
      toastRoot = document.createElement('div');
      toastRoot.id = '__dsh_toast_root__';
      document.body.appendChild(toastRoot);
    }
    const el = document.createElement('div');
    el.className = 'dsh-toast';
    el.innerHTML = '<div class="dsh-toast-title"></div><div class="dsh-toast-body"></div>';
    el.querySelector('.dsh-toast-title').textContent = title || 'DSH 任务完成';
    el.querySelector('.dsh-toast-body').textContent = body || '';
    toastRoot.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    }, 4200);
  } catch {}
}
function initGlassToasts() {
  ipcRenderer.on('dsh:toast', (_e, payload) => {
    try { showGlassToast(payload && payload.title, payload && payload.body); } catch {}
  });
}

// ===== 隐藏「预览版」字样（新对话欢迎页等） =====
function hidePreviewBadges() {
  try {
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const t = (node.textContent || '');
      if (t.includes('预览版')) {
        const cleaned = t.replace(/预览版/g, '');
        if (cleaned.trim() === '') nodes.push(node);
        else node.textContent = cleaned;
      }
    }
    for (const node of nodes) {
      const parent = node.parentElement;
      if (parent) {
        if (parent.childNodes.length <= 2) parent.style.display = 'none';
        else node.textContent = '';
      }
    }
    document.querySelectorAll('*').forEach((el) => {
      if (el.children.length === 0 && (el.textContent || '').trim() === '预览版') {
        el.style.display = 'none';
      }
    });
  } catch {}
}
function initPreviewRemover() {
  hidePreviewBadges();
  const mo = new MutationObserver(() => hidePreviewBadges());
  try { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch {}
}

function initDesktopExtras() {
  initGlassToasts();
  initPreviewRemover();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { injectChrome(); initDesktopExtras(); });
} else {
  injectChrome();
  initDesktopExtras();
}
