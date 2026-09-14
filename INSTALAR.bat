@echo off
chcp 65001 >nul
setlocal

echo ============================================================
echo       SISTEMA UNIVERSAL PARA OBSIDIAN (v4.7.0)
echo       Google Gemini API + Centro de Control + Modo Movil
echo ============================================================
echo.
echo Este instalador configura la boveda con:
echo   1. Centro de control personal (agenda, notas, proyectos, finanzas).
echo   2. Motor de IA universal con Google Gemini (cloud) y Ollama (local).
echo   3. Interfaz movil optimizada para iPhone, iPad y Android.
echo.
echo Compatible con PC y movil sincronizado via iCloud o Sync.
echo.

set "ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%installer\instalar_obsidian_universal_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La instalacion no termino correctamente.
  echo.
  pause
  exit /b %RC%
)

echo.
echo ============================================================
echo [OK] Instalacion completada exitosamente.
echo ============================================================
echo.
echo Tu boveda esta lista para usarse en PC y sincronizar con tu movil.
echo.
pause
exit /b 0
