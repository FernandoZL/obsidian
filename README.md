# Neuronas · Obsidian 5

Memoria compartida entre tus asistentes y tu espacio de trabajo. Las consolas aportan recuerdos; desde PC, celular o iPad puedes explorar conexiones y consultar tu IA.

## Funciones

- Captura incremental de sesiones locales de Codex, Claude Code y Gemini CLI, con origen y atribución. Excluye herramientas, razonamiento y archivos de autenticación.
- Contexto breve: prioriza preferencias y decisiones; busca por tema. Presupuesto inicial de 3200 caracteres, aproximadamente 800 tokens, no una medición del proveedor.
- Mis neuronas: mapa interactivo de recuerdos, proyectos e IAs de origen. Toca un nodo y abre su nota.
- IA en Obsidian: Gemini, Claude, servicios compatibles con Chat Completions de OpenAI y Ollama. Elige proveedor, modelo, clave y dirección.
- Trabajo diario: tareas Markdown, proyectos, Kanban, notas y consultas con contexto.
- Graphify opcional: exporta relaciones verificables para consultas locales.

Las memorias tienen nombres descriptivos. Los identificadores quedan en metadatos; títulos repetidos reciben un número.

## Instalar en Windows

Requiere Node.js 22 o posterior y Obsidian. Clona el código fuera de iCloud y ejecuta INSTALAR.bat, o usa PowerShell:

```powershell
npm ci
npm run build
.\scripts\install.ps1 -VaultPath "$env:USERPROFILE\iCloudDrive\iCloud~md~obsidian\Obsidian" -Activate
```

La instalación normal no borra notas existentes. Conserva configuraciones modificadas desde la instalación anterior y las informa como preserved. La captura periódica se ejecuta cada minuto con la sesión de Windows abierta.

## Celular e iPad

Abre la misma bóveda sincronizada y activa Neuronas en los complementos de comunidad de cada dispositivo. En Ajustes → Neuronas elige proveedor y modelo. La configuración existente de Gemini/Ollama se migra desde IA de bóveda al primer inicio.

Las consultas a proveedores de nube funcionan con la PC apagada. La captura de consolas requiere la PC encendida; las memorias llegan cuando iCloud las sincroniza. Android requiere otro método de sincronización compatible; este proyecto no configura iCloud para Android.

Cada servicio necesita acceso por API, no necesariamente incluido en una suscripción de chat. Las claves se guardan en los ajustes sincronizados del complemento, nunca en notas de memoria. Ollama necesita un servidor accesible desde el móvil; localhost apunta al propio teléfono.

## Usar

1. Abre Neuronas desde el icono de cerebro.
2. Guarda decisiones y aprendizajes indicando su proyecto.
3. Explora Mis neuronas o el grafo nativo.
4. Abre Hablar con mi IA para consultar notas y recuerdos.
5. Reinicia las consolas abiertas para cargar sus nuevos conectores.

El chat es consultivo: no ejecuta acciones. Puedes guardar respuestas como aprendizajes atribuidos al asistente.

## Cobertura

| Aplicación | Captura local | Memoria compartida |
|---|---|---|
| Codex | JSONL incremental | MCP e instrucciones globales |
| Claude Code | Importación y evento al terminar | MCP y contexto al iniciar |
| Gemini CLI | Importación y evento al terminar | MCP y contexto; requiere carpeta confiable |
| Cursor, Copilot CLI | Pendiente | MCP configurado; cada app debe cargarlo |
| Windsurf | Pendiente | MCP si ya existía configuración |
| Antigravity CLI (`agy`) | Contexto automático al iniciar, MCP y captura de mensajes/respuestas finalizadas | Probado con sesión real en Windows; requiere reabrir consolas existentes |
| Otras aplicaciones | Adaptador pendiente | Sin captura universal garantizada |

No se cambian políticas de confianza. No hay sincronización de cuentas Trello, Notion o Evernote: se reutilizan sus ideas con Markdown, Tasks, Kanban y Dataview.

## CLI

```powershell
node bin/memory.js status
node bin/memory.js context
node bin/memory.js search "mi proyecto"
node bin/memory.js add --file recuerdo.txt --type decision --project "Mi proyecto"
node bin/memory.js sync
node bin/memory.js graphify-export
```

Configuración: %LOCALAPPDATA%\ObsidianNeuronas\config.json. Notas en iCloud; estado y bloqueos fuera. scripts/uninstall.ps1 desactiva la tarea y revierte archivos administrados, conservando notas y archivos modificados posteriormente e informando conflictos.

## Desarrollo

```powershell
npm ci
npm test
npm run check
```

Las pruebas construyen un complemento de archivo único. Usan credenciales sintéticas y HTTP local, sin llamadas de pago. Consulta [arquitectura](docs/ARQUITECTURA.md), [móvil](docs/MOVIL.md), [Graphify](docs/GRAPHIFY.md) y [validación](docs/VERIFICACION.md).
