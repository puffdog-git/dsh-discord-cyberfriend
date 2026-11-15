param([string]$PythonExecutable = '')
$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent $PSScriptRoot
if (-not $PythonExecutable) {
    $bundledPython = Join-Path $env:LOCALAPPDATA 'Programs/DeepSeek Harness/resources/runtime/primary-runtime/dependencies/python/python.exe'
    $currentRuntimePython = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe'
    if (Test-Path -LiteralPath $currentRuntimePython) { $bundledPython = $currentRuntimePython }
    if (Test-Path -LiteralPath $bundledPython) { $PythonExecutable = $bundledPython }
    else { throw '請指定 -PythonExecutable，使用 Python 3.11 以上的完整執行檔路徑。' }
}
# Source installs keep .venv in the package folder. A package installed under node_modules
# (market / npm) is replaced on update, so its environment goes to the data folder instead.
$venvRoot = Join-Path $pluginRoot '.venv'
if ($pluginRoot -split '[\\/]' -contains 'node_modules') {
    $dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh' }
    $venvRoot = Join-Path $dshHome 'data/dsh-discord-cyberfriend/venv'
}
$venvPython = Join-Path $venvRoot 'Scripts/python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) {
    & $PythonExecutable -m venv $venvRoot
    if ($LASTEXITCODE -ne 0) { throw '建立虛擬環境失敗' }
}
& $venvPython -m pip install --isolated --disable-pip-version-check --use-deprecated=legacy-certs --index-url https://pypi.org/simple setuptools wheel
if ($LASTEXITCODE -ne 0) { throw '建置依賴安裝失敗' }
& $venvPython -m pip install --isolated --disable-pip-version-check --use-deprecated=legacy-certs --no-build-isolation --only-binary=Pillow --index-url https://pypi.org/simple -r (Join-Path $pluginRoot 'requirements.lock.txt')
if ($LASTEXITCODE -ne 0) { throw '安裝 Python 依賴失敗' }
& $venvPython (Join-Path $PSScriptRoot 'check-runtime.py')
if ($LASTEXITCODE -ne 0) { throw 'Python 執行環境檢查失敗' }
