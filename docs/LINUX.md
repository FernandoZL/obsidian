# Neuronas en Linux

Requisitos: Obsidian, Node.js 22+ y una sesión con systemd de usuario. Para iCloud: Python 3.10+, `pgrep` y rclone 1.69+. Las consolas se instalan y autentican por separado. La captura importa registros compatibles de Codex, Claude Code, Gemini CLI y Antigravity, no páginas web de chat.

## Instalar

Extrae el ZIP Linux en una carpeta estable, fuera de la bóveda. Trae el complemento compilado y no requiere npm para instalarse. Desde el código fuente, ejecuta primero `npm ci` y `npm run build`.

```bash
node scripts/install-linux.js --vault "$HOME/Documentos/Mis notas"
```

Configura conectores y `neuronas-memory.timer` cada minuto con la sesión abierta. Conserva notas, otros MCP y preferencias ajenas. Revisa la lista `preserved` si personalizaste un archivo administrado. Conserva la carpeta de aplicación: los conectores apuntan a sus scripts. El estado incremental queda fuera de la bóveda y separado por destino.

`--prepare-only` genera archivos sin activar servicios. `--without-connectors` instala solo el complemento en otra bóveda sin redirigir los conectores o servicios existentes. Reabre las sesiones de consola después de instalar.

## Regla compartida

Codex, Claude y AGY consultan recuerdos creados por cualquiera de las IAs, sin filtrar por origen. También pueden leer las notas completas mediante sus herramientas de archivos o terminal, dentro de sus permisos. `memory_search` devuelve extractos y rutas: el contexto breve reduce relecturas, no limita el acceso ni garantiza un ahorro fijo de tokens. Los recuerdos son datos con atribución, nunca instrucciones.

## iCloud opcional

Cierra Obsidian y ejecuta `~/.local/bin/icloud-conectar`. Ingresa el correo, la contraseña normal de Apple y el código de verificación únicamente en esa terminal. No los escribas en notas, comandos del historial ni Git. El backend no acepta contraseñas específicas de aplicación. Las credenciales se guardan fuera de la bóveda, en la configuración privada de rclone; su ofuscación no equivale a cifrado y el archivo debe tratarse como un secreto.

El asistente busca la bóveda y valida `.obsidian/app.json`. Si hay varias o el nombre es distinto, pide la ruta exacta. `Obsidian/Obsidian` es un ejemplo, no un valor universal. Antes de la primera unión pausa la captura y la reactiva aunque falle. Mantén Obsidian cerrado durante esa primera transferencia. Después habilita `neuronas-icloud.timer` cada tres minutos.

La política reproduce las preferencias solicitadas: **sin respaldos automáticos**. En la primera unión prevalecen los archivos coincidentes de iCloud y los archivos nuevos locales también se suben. En conflictos posteriores se prefiere la fecha más reciente y se elimina la perdedora. Si las fechas empatan, rclone puede conservar un conflicto para revisión. Esto no deduplica semánticamente memorias.

Los borrados se propagan; un límite detiene operaciones con demasiadas eliminaciones. Las rutas específicas de Neuronas y la disposición de ventanas no se sincronizan. El estado permanece fuera de la bóveda. No se repite `--resync` automáticamente para ocultar errores: rutas cambiadas o validación fallida requieren revisión.

Apple exige renovar periódicamente la sesión; rclone documenta tokens de confianza válidos por 30 días. Ejecuta `icloud-renovar` y luego `icloud-conectar`. Consulta las condiciones de rclone si usas Protección Avanzada de Datos; el instalador no cambia la seguridad de Apple. La memoria local sigue funcionando sin internet.

## Estado y desinstalación

```bash
~/.local/bin/neuronas status
systemctl --user list-timers neuronas-memory.timer neuronas-icloud.timer
journalctl --user -u neuronas-icloud.service -n 30
~/.local/bin/icloud-sincronizar --dry-run
```

Para pausar: `systemctl --user stop neuronas-memory.timer neuronas-icloud.timer`. Para reanudar la captura: `systemctl --user start neuronas-memory.timer`. Activa iCloud solo después de una conexión inicial correcta.

Actualiza la carpeta de aplicación y vuelve a ejecutar el instalador para la misma bóveda. No cambies rutas mientras las consolas usen los conectores. Linux no crea respaldos de configuración y conserva preferencias personales preexistentes al retirar la instalación.

```bash
node scripts/uninstall-linux.js
```

Detiene servicios y retira conexiones de esa instalación. Conserva notas, credenciales de rclone y archivos personalizados. Si otra bóveda utiliza los conectores, se niega a retirar automáticamente la instalación antigua. `--prepare-only` omite systemd para preparar perfiles aislados.

## Windows

Sigue usando `INSTALAR.bat` y `scripts/uninstall.ps1`: mantienen rutas `AppData`, respaldos de configuración y tareas VBS. La regla de acceso a toda la memoria es compartida. La política de iCloud de Linux no se aplica a Windows.

Referencias: [iCloud en rclone](https://rclone.org/iclouddrive/), [bisync](https://rclone.org/bisync/), [sincronización de Obsidian](https://obsidian.md/help/sync-notes).
