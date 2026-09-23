# PyInstaller spec — builds a single portable NetScan.exe (no console window).
# Build: pyinstaller netscan.spec  (run tools/fetch_oui.py first for full OUI DB)
import os
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

datas = collect_data_files("customtkinter")
if os.path.exists("data/oui.csv"):          # full vendor DB when fetched
    datas += [("data/oui.csv", "data")]

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=["customtkinter"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["matplotlib", "numpy", "PIL.ImageQt", "pytest", "tkinter.test"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="NetScan",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # windowed / matte GUI, no console pop-up
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="assets/netscan.ico" if __import__("os").path.exists("assets/netscan.ico") else None,
)
