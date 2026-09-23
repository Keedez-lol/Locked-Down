@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title NetScan - build del .exe portable

echo ============================================
echo   NetScan  -  compilacion del .exe portable
echo ============================================
echo.

rem --- localizar Python (py launcher o python) ---
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY (
  where python >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo [ERROR] No se encontro Python.
  echo Instala Python 3.10 o superior desde https://www.python.org/downloads/
  echo y marca la casilla "Add python.exe to PATH" durante la instalacion.
  echo.
  pause
  exit /b 1
)
%PY% --version

echo.
echo [1/4] Creando entorno virtual (.venv) ...
%PY% -m venv .venv
if errorlevel 1 ( echo [ERROR] No se pudo crear el entorno virtual. & pause & exit /b 1 )
call ".venv\Scripts\activate.bat"

echo [2/4] Instalando dependencias ...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt pyinstaller==6.11.1
if errorlevel 1 ( echo [ERROR] Fallo la instalacion de dependencias. & pause & exit /b 1 )

echo [3/4] Descargando base de fabricantes (OUI) ...
python tools\fetch_oui.py

echo [4/4] Compilando NetScan.exe (puede tardar 1-2 min) ...
pyinstaller --noconfirm netscan.spec
if errorlevel 1 ( echo [ERROR] Fallo PyInstaller. & pause & exit /b 1 )

echo.
if exist "dist\NetScan.exe" (
  for %%F in ("dist\NetScan.exe") do set "MB=%%~zF"
  echo ============================================
  echo   LISTO: dist\NetScan.exe
  echo ============================================
  echo Abriendo la carpeta dist ...
  explorer "dist"
) else (
  echo [ERROR] No se genero dist\NetScan.exe
)
echo.
pause
