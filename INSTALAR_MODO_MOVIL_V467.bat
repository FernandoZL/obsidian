@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo        JARVIS V4.6.7 - MODO MOVIL CAPTURA Y FILTROS
echo ============================================================
echo.
echo Celular: captura, lectura, busqueda y filtros.
echo PC: IA local con Ollama.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\instalar_modo_movil_v467.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] El modo movil no termino correctamente.
) else (
  echo.
  echo [OK] Modo movil instalado para prueba.
)

echo.
pause
exit /b %RC%
