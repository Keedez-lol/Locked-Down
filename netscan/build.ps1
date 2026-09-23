# Local Windows build for NetScan -> dist\NetScan.exe (portable, no console).
# Usage (PowerShell, from the netscan\ folder):
#   .\build.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> Creating virtual environment" -ForegroundColor Cyan
python -m venv .venv
.\.venv\Scripts\Activate.ps1

Write-Host "==> Installing dependencies" -ForegroundColor Cyan
python -m pip install --upgrade pip
pip install -r requirements.txt pyinstaller==6.11.1

Write-Host "==> Fetching OUI vendor database" -ForegroundColor Cyan
python tools\fetch_oui.py

Write-Host "==> Building NetScan.exe" -ForegroundColor Cyan
pyinstaller --noconfirm netscan.spec

if (Test-Path dist\NetScan.exe) {
    $size = [math]::Round((Get-Item dist\NetScan.exe).Length / 1MB, 1)
    Write-Host "==> Done: dist\NetScan.exe ($size MB)" -ForegroundColor Green
} else {
    throw "Build failed: dist\NetScan.exe not found"
}
