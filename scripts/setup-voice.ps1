param([string]$NodeExecutable = '')
$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent $PSScriptRoot
if (-not $NodeExecutable) { $NodeExecutable = (Get-Command node -ErrorAction Stop).Source }
$npmCmd = Join-Path (Split-Path -Parent $NodeExecutable) 'npm.cmd'
if (-not (Test-Path -LiteralPath $npmCmd)) { throw '找不到與 Node 配套的 npm.cmd' }
Push-Location -LiteralPath $pluginRoot
try {
    & $npmCmd ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw '語音 Node 依賴安裝失敗' }
    & $NodeExecutable (Join-Path $pluginRoot 'node_modules/ffmpeg-static/install.js')
    if ($LASTEXITCODE -ne 0) { throw 'FFmpeg 安裝失敗' }
    & (Join-Path $pluginRoot '.venv/Scripts/python.exe') -m pip install --disable-pip-version-check --only-binary=:all: PyNaCl==1.5.0 davey==0.1.0
    if ($LASTEXITCODE -ne 0) { throw '個人帳號語音依賴安裝失敗' }
} finally { Pop-Location }
