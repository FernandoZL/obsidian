@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo       V4.6.7 - MODO MOVIL CAPTURA Y FILTROS
echo ============================================================
echo.
echo Celular: captura, lectura, busqueda y filtros.
echo PC: IA local con Ollama.
echo Interfaz: sin marca visible.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\instalar_modo_movil_v467.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" goto :error

echo.
echo [..] Aplicando interfaz sin marca visible...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\aplicar_sin_marca_v467.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" goto :error

echo.
echo [OK] Modo movil e interfaz sin marca instalados para prueba.
goto :end

:error
echo.
echo [ERROR] La instalacion no termino correctamente.

:end
echo.
pause
exit /b %RC%
