'use strict';
// 重新生成各版本 Gitee 分片合并脚本：
// - 纯 ASCII 文案（不依赖 chcp/代码页）
// - 每行 CRLF
// - set "FAILED=1" / pause 独立成行，避免被 echo 吞掉
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'dist');
const dirs = [
  ['split-v030b', '0.3.0'],
  ['split-v030', '0.3.0'],
  ['split-v031', '0.3.1'],
  ['split-v032', '0.3.2'],
  ['split-v033', '0.3.3'],
  ['split-v038', '0.3.8'],
];

function buildBat(version) {
  const lines = [
    '@echo off',
    'setlocal enabledelayedexpansion',
    'cd /d "%~dp0"',
    '',
    'echo ============================================',
    `echo   DSH Desktop v${version} installer merge tool`,
    'echo ============================================',
    'echo.',
    '',
    'set "FAILED="',
    '',
    `call :merge "DSH-Desktop-${version}-portable-x64.exe" "DSH-Desktop-${version}-portable-x64.exe.part1" "DSH-Desktop-${version}-portable-x64.exe.part2"`,
    `call :merge "DSH-Desktop-Setup-${version}-x64.exe" "DSH-Desktop-Setup-${version}-x64.exe.part1" "DSH-Desktop-Setup-${version}-x64.exe.part2"`,
    '',
    'if defined FAILED (',
    '    echo.',
    '    echo [ERROR] One or more parts failed to merge.',
    '    echo Please make sure ALL .part1 / .part2 files are downloaded completely.',
    '    echo.',
    '    pause',
    '    exit /b 1',
    ')',
    '',
    'echo.',
    'echo [OK] All parts merged. You can now run the exe.',
    'echo.',
    'pause',
    'exit /b 0',
    '',
    ':merge',
    'set "OUT=%~1"',
    'set "P1=%~2"',
    'set "P2=%~3"',
    '',
    'if not exist "%P1%" (',
    '    echo [MISSING] %P1%',
    '    set "FAILED=1"',
    '    goto :eof',
    ')',
    'if not exist "%P2%" (',
    '    echo [MISSING] %P2%',
    '    set "FAILED=1"',
    '    goto :eof',
    ')',
    '',
    'echo Merging %OUT% ...',
    'copy /b "%P1%" + "%P2%" "%OUT%" >nul',
    'if errorlevel 1 (',
    '    echo [FAILED] Could not merge %OUT%',
    '    set "FAILED=1"',
    ') else (',
    '    echo [DONE] %OUT%',
    ')',
    'goto :eof',
  ];
  return lines.join('\r\n') + '\r\n';
}

for (const [dir, version] of dirs) {
  const file = path.join(root, dir, 'merge.bat');
  fs.writeFileSync(file, buildBat(version));
  const buf = fs.readFileSync(file);
  let crlf = 0, bareLf = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) {
      if (i > 0 && buf[i - 1] === 0x0d) crlf++;
      else bareLf++;
    }
  }
  console.log(`${dir}/merge.bat size=${buf.length} CRLF=${crlf} bareLF=${bareLf}`);
}
