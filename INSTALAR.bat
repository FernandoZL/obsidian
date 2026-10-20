@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo Neuronas - Obsidian 5
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22 o posterior antes de continuar.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1" -Activate
if errorlevel 1 (
  echo Instalacion incompleta. Revisa el mensaje anterior.
  pause
  exit /b 1
)
echo Listo. Abre tu boveda y activa Neuronas en los complementos de comunidad.
pause
