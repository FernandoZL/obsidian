@echo off
setlocal EnableExtensions
chcp 65001 >nul
title OBSIDIAN - VALIDAR ACTIVACION

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\validar_activacion.ps1"
set "ERR=%ERRORLEVEL%"

echo.
pause
exit /b %ERR%
