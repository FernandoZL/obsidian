@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title OBSIDIAN - ADMIN GIT / GITHUB
cd /d "%~dp0.."

set "EXPECTED_REPO=FernandoZL/obsidian"
set "GIT_EXE="
if exist "C:\Program Files\Git\cmd\git.exe" set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
if not defined GIT_EXE if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT_EXE=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if not defined GIT_EXE if exist "C:\Program Files (x86)\Git\cmd\git.exe" set "GIT_EXE=C:\Program Files (x86)\Git\cmd\git.exe"

if not exist "VERSION" goto :CARPETA_INCORRECTA
if not exist "INSTALAR.bat" goto :CARPETA_INCORRECTA

:MENU
cls
set "PROJECT_VERSION="
for /f "usebackq delims=" %%V in ("VERSION") do set "PROJECT_VERSION=%%V"
echo ============================================================
echo           OBSIDIAN - ADMIN GIT / GITHUB
echo ============================================================
echo Repositorio: %EXPECTED_REPO%
echo Version local: %PROJECT_VERSION%
echo Carpeta: %CD%
echo.
echo [1] Ver estado Git + auditoria de seguridad
echo [2] Ver cambios pendientes
echo [3] Crear respaldo local del codigo
echo [4] Guardar version ^(commit^)
echo [5] Subir a GitHub ^(push^)
echo [6] Actualizar desde GitHub ^(pull --rebase seguro^)
echo [7] Crear paquete instalable ^(release^)
echo [8] Abrir carpeta del proyecto
echo [9] Abrir GitHub
echo [10] Instalar / actualizar en una boveda
echo [11] Auditoria para publicar repositorio
echo [0] Salir
echo ============================================================
echo Este BAT administra SOLO el proyecto. No toca la boveda iCloud.
echo ============================================================
set "OPCION="
set /p "OPCION=Seleccione una opcion: "
if "%OPCION%"=="1" goto :ESTADO
if "%OPCION%"=="2" goto :CAMBIOS
if "%OPCION%"=="3" goto :BACKUP
if "%OPCION%"=="4" goto :COMMIT
if "%OPCION%"=="5" goto :PUSH
if "%OPCION%"=="6" goto :PULL
if "%OPCION%"=="7" goto :RELEASE
if "%OPCION%"=="8" goto :CARPETA
if "%OPCION%"=="9" goto :ABRIR
if "%OPCION%"=="10" goto :INSTALAR
if "%OPCION%"=="11" goto :PUBLICAR
if "%OPCION%"=="0" exit /b 0
goto :MENU

:ESTADO
cls
echo ============================================================
echo ESTADO GIT + AUDITORIA DE SEGURIDAD
echo ============================================================
call :REQUIERE_GIT || goto :PAUSA
call :VALIDA_ORIGIN
"%GIT_EXE%" status --short --branch
echo.
call :AUDITORIA_PRIVADA
if errorlevel 1 (
  echo.
  echo [BLOQUEADO] No haga commit ni push hasta corregir la auditoria.
) else (
  echo.
  echo [OK] Auditoria de seguridad superada.
)
goto :PAUSA

:CAMBIOS
cls
echo ============================================================
echo CAMBIOS PENDIENTES
echo ============================================================
call :REQUIERE_GIT || goto :PAUSA
"%GIT_EXE%" status --short
echo.
"%GIT_EXE%" diff --stat
echo.
"%GIT_EXE%" diff --cached --stat
goto :PAUSA

:BACKUP
cls
echo ============================================================
echo RESPALDO LOCAL DEL CODIGO
echo ============================================================
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%T"
set "DEST=%USERPROFILE%\Desktop\Obsidian_Codigo_Backup_%STAMP%"
mkdir "%DEST%" >nul 2>nul
robocopy "%CD%" "%DEST%" /E /XD ".git" "release" /XF "*.zip" "data.json" "workspace.json" "workspace-mobile.json" /R:1 /W:1 >nul
if errorlevel 8 (
  echo [ERROR] No se pudo completar el respaldo.
) else (
  echo [OK] Respaldo: %DEST%
)
goto :PAUSA

:COMMIT
cls
echo ============================================================
echo GUARDAR VERSION LOCAL
echo ============================================================
call :REQUIERE_GIT || goto :PAUSA
call :VALIDA_ORIGIN || goto :PAUSA
call :AUDITORIA_PRIVADA || goto :PAUSA
"%GIT_EXE%" add --all
call :AUDITORIA_TRACKED || goto :PAUSA
"%GIT_EXE%" diff --cached --quiet
if not errorlevel 1 (
  echo [INFO] No hay cambios nuevos para guardar.
  goto :PAUSA
)
"%GIT_EXE%" status --short
set "MENSAJE="
set /p "MENSAJE=Nombre de la version/commit: "
if not defined MENSAJE set "MENSAJE=Obsidian V%PROJECT_VERSION%"
"%GIT_EXE%" commit -m "%MENSAJE%"
if errorlevel 1 (
  echo [ERROR] No se pudo crear el commit.
) else (
  echo [OK] Version guardada localmente.
)
goto :PAUSA

:PUSH
cls
echo ============================================================
echo SUBIR A GITHUB
echo ============================================================
call :REQUIERE_GIT || goto :PAUSA
call :VALIDA_ORIGIN || goto :PAUSA
call :AUDITORIA_PRIVADA || goto :PAUSA
"%GIT_EXE%" status --porcelain | "%SystemRoot%\System32\findstr.exe" . >nul
if not errorlevel 1 (
  echo [ERROR] Hay cambios locales sin guardar. Use primero [4].
  goto :PAUSA
)
"%GIT_EXE%" fetch origin main >nul 2>nul
set "REMOTE_AHEAD=0"
for /f %%A in ('"%GIT_EXE%" rev-list --count HEAD..origin/main 2^>nul') do set "REMOTE_AHEAD=%%A"
if not "%REMOTE_AHEAD%"=="0" (
  echo [ERROR] GitHub tiene cambios nuevos. Use primero [6].
  goto :PAUSA
)
"%GIT_EXE%" push -u origin main
if errorlevel 1 (
  echo [ERROR] No se completo el push.
) else (
  echo [OK] GitHub actualizado correctamente.
)
goto :PAUSA

:PULL
cls
echo ============================================================
echo ACTUALIZAR DESDE GITHUB - SEGURO
echo ============================================================
call :REQUIERE_GIT || goto :PAUSA
call :VALIDA_ORIGIN || goto :PAUSA
"%GIT_EXE%" status --porcelain | "%SystemRoot%\System32\findstr.exe" . >nul
if not errorlevel 1 (
  echo [ERROR] Hay cambios locales. Guardelos con [4] antes del pull.
  goto :PAUSA
)
"%GIT_EXE%" pull --rebase origin main
if errorlevel 1 (
  echo [ERROR] No se completo el pull. No fuerce ni borre archivos.
) else (
  echo [OK] Proyecto actualizado desde GitHub.
)
goto :PAUSA

:RELEASE
cls
call :AUDITORIA_PRIVADA || goto :PAUSA
call "%~dp0CREAR_RELEASE.bat"
goto :PAUSA

:CARPETA
start "" "%CD%"
goto :MENU

:ABRIR
start "" "https://github.com/FernandoZL/obsidian"
goto :MENU

:INSTALAR
cls
call "%~dp0INSTALAR.bat"
goto :MENU

:PUBLICAR
cls
echo ============================================================
echo AUDITORIA PARA PUBLICACION
echo ============================================================
call :REQUIERE_GIT || goto :PAUSA
call :VALIDA_ORIGIN || goto :PAUSA
if not exist "%~dp0AUDITAR_PUBLICACION.ps1" (
  echo [ERROR] No existe AUDITAR_PUBLICACION.ps1.
  goto :PAUSA
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AUDITAR_PUBLICACION.ps1" -RepoRoot "%CD%" -GitExe "%GIT_EXE%"
goto :PAUSA

:REQUIERE_GIT
if not defined GIT_EXE (
  echo [ERROR] No se encontro git.exe.
  exit /b 1
)
if not exist "%GIT_EXE%" (
  echo [ERROR] No se encontro: %GIT_EXE%.
  exit /b 1
)
if not exist ".git\" (
  echo [ERROR] Esta carpeta no conserva el repositorio .git.
  exit /b 1
)
exit /b 0

:VALIDA_ORIGIN
set "ORIGIN_URL="
for /f "delims=" %%U in ('"%GIT_EXE%" remote get-url origin 2^>nul') do set "ORIGIN_URL=%%U"
if not defined ORIGIN_URL (
  echo [ERROR] No existe origin.
  exit /b 1
)
echo %ORIGIN_URL% | "%SystemRoot%\System32\findstr.exe" /I /C:"FernandoZL/obsidian" >nul
if errorlevel 1 (
  echo [ERROR] Origin no corresponde a %EXPECTED_REPO%.
  exit /b 1
)
exit /b 0

:AUDITORIA_PRIVADA
set "AUDIT_FILE=%TEMP%\obsidian_audit_%RANDOM%.txt"
"%GIT_EXE%" ls-files --cached --others --exclude-standard > "%AUDIT_FILE%"
"%SystemRoot%\System32\findstr.exe" /I /R /C:"data.json$" /C:"workspace.json$" /C:"workspace-mobile.json$" /C:"02 - Universidad" /C:"06 - Personal" /C:"Movimientos" /C:"Notas diarias" /C:"Backup_" /C:"\.pdf$" /C:"\.docx$" /C:"\.xlsx$" /C:"\.pptx$" "%AUDIT_FILE%" >nul
if errorlevel 1 (
  del "%AUDIT_FILE%" >nul 2>nul
  exit /b 0
)
echo [ALERTA] Se detectaron posibles datos personales o archivos locales:
"%SystemRoot%\System32\findstr.exe" /I /R /C:"data.json$" /C:"workspace.json$" /C:"workspace-mobile.json$" /C:"02 - Universidad" /C:"06 - Personal" /C:"Movimientos" /C:"Notas diarias" /C:"Backup_" /C:"\.pdf$" /C:"\.docx$" /C:"\.xlsx$" /C:"\.pptx$" "%AUDIT_FILE%"
del "%AUDIT_FILE%" >nul 2>nul
exit /b 1

:AUDITORIA_TRACKED
set "AUDIT_FILE=%TEMP%\obsidian_audit_tracked_%RANDOM%.txt"
"%GIT_EXE%" ls-files > "%AUDIT_FILE%"
"%SystemRoot%\System32\findstr.exe" /I /R /C:"data.json$" /C:"workspace.json$" /C:"workspace-mobile.json$" /C:"02 - Universidad" /C:"06 - Personal" /C:"Movimientos" /C:"Notas diarias" /C:"Backup_" /C:"\.pdf$" /C:"\.docx$" /C:"\.xlsx$" /C:"\.pptx$" "%AUDIT_FILE%" >nul
if errorlevel 1 (
  del "%AUDIT_FILE%" >nul 2>nul
  exit /b 0
)
echo [ALERTA] Git ya preparo/rastrea archivos que no deben subirse.
del "%AUDIT_FILE%" >nul 2>nul
exit /b 1

:CARPETA_INCORRECTA
echo [ERROR] Ejecute OBSIDIAN_ADMIN.bat dentro de la carpeta del proyecto Obsidian.
echo No debe ejecutarse dentro de la boveda de Obsidian.
goto :PAUSA

:PAUSA
echo.
pause
goto :MENU
