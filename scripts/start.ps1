# 一键启动脚本（Windows）
# 用法：在 PowerShell 中执行 .\scripts\start.ps1
# 或在 cmd 中执行：powershell -ExecutionPolicy Bypass -File scripts\start.ps1
#
# 职责：检测并安装 Node.js，然后调用跨平台核心脚本启动服务

$ErrorActionPreference = "Stop"

# ===== 配置 =====
$NODE_MIN_MAJOR = 20
$NPM_MIN_MAJOR  = 9
$NODE_INSTALL_VERSION = "22"

# ===== 颜色输出 =====
function Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Warn($msg)  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function ErrorMsg($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Ok($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }

# ===== 步骤 1：检测 Node.js =====
# 返回：0=满足，1=未安装，2=版本过低
function Detect-Node {
    $nodeExe = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeExe) { return 1 }
    try {
        $ver = [int](node -p "process.versions.node.split('.')[0]" 2>$null)
    } catch {
        return 1
    }
    if ($ver -lt $NODE_MIN_MAJOR) {
        Warn "Node.js 版本过低：v$(node -v)（需要 >= v$NODE_MIN_MAJOR）"
        return 2
    }
    return 0
}

# ===== 步骤 2：安装 Node.js =====
function Install-Node {
    Info "开始安装 Node.js v$NODE_INSTALL_VERSION..."

    # 优先用 winget（Windows 10 1809+ 自带）
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Info "使用 winget 安装 Node.js LTS..."
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            # 刷新当前会话 PATH（winget 装到系统级，需重新读取）
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            if (Get-Command node -ErrorAction SilentlyContinue) {
                Ok "Node.js 已通过 winget 安装：$(node -v)"
                return $true
            }
        } catch {
            Warn "winget 安装失败，尝试其他方式..."
        }
    }

    # 备选：nvm-windows
    $nvm = Get-Command nvm -ErrorAction SilentlyContinue
    if ($nvm) {
        Info "检测到 nvm-windows，使用 nvm 安装..."
        try {
            nvm install $NODE_INSTALL_VERSION
            nvm use $NODE_INSTALL_VERSION
            # nvm use 后需刷新 PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            Ok "Node.js 已通过 nvm 安装：$(node -v)"
            return $true
        } catch {
            Warn "nvm 安装失败，尝试其他方式..."
        }
    }

    # 最后兜底：提示手动下载
    ErrorMsg "未检测到可用的 winget 或 nvm-windows，请手动安装 Node.js >= $NODE_MIN_MAJOR："
    ErrorMsg "  下载地址：https://nodejs.org/en/download/"
    ErrorMsg "  或先安装 winget：https://github.com/microsoft/winget-cli"
    ErrorMsg "  或安装 nvm-windows：https://github.com/coreybutler/nvm-windows"
    return $false
}

# ===== 主流程 =====
function Main {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════"
    Write-Host "  AI Video Studio — 一键启动（Windows）    "
    Write-Host "═══════════════════════════════════════════"
    Info "工作目录：$(Get-Location)"
    Write-Host ""

    # 步骤 1：Node 检测
    Info "[1/3] 检测 Node.js..."
    $r = Detect-Node
    switch ($r) {
        0 { Ok "Node.js: $(node -v)" }
        1 {
            Warn "未检测到 Node.js"
            if (-not (Install-Node)) { ErrorMsg "Node.js 安装失败"; exit 1 }
        }
        2 {
            if (-not (Install-Node)) { ErrorMsg "Node.js 升级失败"; exit 1 }
        }
    }

    # 步骤 2：npm 检测
    Info "[2/3] 检测 npm..."
    $npmExe = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmExe) {
        ErrorMsg "npm 未安装，请重新安装 Node.js（npm 会随 Node 一起安装）"
        exit 1
    }
    $npmVer = (npm -v 2>$null)
    $npmMajor = ($npmVer -split '\.')[0] -as [int]
    if ($npmMajor -lt $NPM_MIN_MAJOR) {
        Warn "npm 版本过低：$npmVer（需要 >= $NPM_MIN_MAJOR）"
        Warn "请升级 Node.js 到 LTS 版本"
        exit 1
    }
    Ok "npm: $npmVer"

    # 步骤 3：调用 Node 核心脚本
    Info "[3/3] 进入核心流程..."
    Write-Host ""
    # 兼容多种调用方式：直接执行 / dot-source / powershell -File
    # $MyInvocation.MyCommand.Path 在 dot-source 等场景下为 null，
    # 直接 Split-Path -Parent $null 在 ErrorActionPreference=Stop 下会抛错，
    # 因此先用 $PSScriptRoot（PowerShell 3.0+ 内置，最可靠），再依次回退。
    $scriptDir = $PSScriptRoot
    if (-not $scriptDir) {
        $cmdPath = $MyInvocation.MyCommand.Path
        if ($cmdPath) { $scriptDir = Split-Path -Parent $cmdPath }
    }
    if (-not $scriptDir) { $scriptDir = (Get-Location).Path + "\scripts" }
    & node "$scriptDir\lib\run-dev.mjs"
}

Main
