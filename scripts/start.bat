@echo off
REM ==========================================
REM AI Video Studio 一键启动脚本（Windows CMD）
REM ==========================================
REM 用法：双击运行 或 在 cmd 中执行 scripts\start.bat
REM
REM 职责：检测 Node.js 是否可用，然后委托跨平台核心脚本启动服务。
REM       不做版本校验与依赖安装（交给 scripts/lib/run-dev.mjs 统一处理）。
REM 注意：本文件必须用 GBK 编码保存（中文 Windows 默认代码页），
REM       不能用 UTF-8，否则 cmd 会乱码。
REM ==========================================

setlocal

echo.
echo ═══════════════════════════════════════════
echo   AI Video Studio — 一键启动 (Windows)
echo ═══════════════════════════════════════════
echo   工作目录: %cd%
echo.

REM ===== 步骤 1：检测 Node.js =====
echo [INFO] [1/2] 检测 Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] 未检测到 Node.js，请先安装 Node.js v20+：
    echo           下载地址: https://nodejs.org/zh-cn/download/
    echo           或使用 nvm-windows: https://github.com/coreybutler/nvm-windows
    echo.
    echo [提示] 安装完成后请重新打开新的命令行窗口，再运行本脚本。
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK]   Node: %NODE_VER%

REM ===== 步骤 2：委托跨平台核心脚本 =====
echo.
echo [INFO] [2/2] 进入核心流程...
echo.

REM %~dp0 定位本脚本所在目录（带末尾反斜杠）
node "%~dp0lib\run-dev.mjs"
set "EXIT_CODE=%errorlevel%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] 启动失败，退出码 %EXIT_CODE%，请查看上方日志排查
    echo.
    pause
)

endlocal
exit /b %EXIT_CODE%
