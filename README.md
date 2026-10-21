# Neuronas para Obsidian

Tus apuntes, tus ideas y lo que tienes pendiente. Notas, universidad, proyectos y memoria de tus asistentes de IA, en archivos Markdown que siguen siendo tuyos.

**Versión 5.3.1** · [Descargar](https://github.com/FernandoZL/obsidian/releases/latest) · [Instalación paso a paso](docs/INSTALACION.md) · [Celular e iPad](docs/MOVIL.md)

## Elige cómo instalarlo

| Descarga | Para qué sirve | Requisitos |
|---|---|---|
| `Neuronas-5.3.1-Plugin.zip` | Notas, materias, proyectos, tareas, captura, chat y red automática | Obsidian en Windows, macOS, Linux, iOS o Android. No requiere Node.js |
| `Neuronas-5.3.1-Windows.zip` | Lo anterior y conexiones locales con consolas de IA | Windows, Obsidian y Node.js 22 o posterior |

En **Releases → Assets** están los ZIP y sus sumas SHA256. Si el repositorio es privado, necesitas acceso para descargarlos. No aparece todavía en el catálogo oficial de complementos de Obsidian.

### Solo el complemento

1. Descarga y descomprime el ZIP Plugin.
2. Copia la carpeta `neuronas` dentro de `<tu bóveda>/.obsidian/plugins/`.
3. En Obsidian habilita los complementos de comunidad y activa **Neuronas**.
4. Abre el icono del cerebro. Puedes empezar con **Escribir una nota**.

Para el celular resulta más sencillo instalarlo en la PC y sincronizar la bóveda y su carpeta `.obsidian`; después actívalo también en el dispositivo. [Detalles](docs/MOVIL.md).

### Windows con memorias de consola

1. Instala Obsidian y Node.js 22 o posterior.
2. Extrae el ZIP Windows en una carpeta estable, fuera de tu bóveda.
3. Ejecuta `INSTALAR.bat` y elige la carpeta de tu bóveda. Puedes crear una nueva.
4. Elige si quieres configurar conexiones de consola para esa bóveda.
5. Reinicia Obsidian y las consolas que estuvieran abiertas.

El ZIP ya está compilado: no requiere Git ni `npm install`. Conserva la carpeta extraída porque los conectores ejecutan sus scripts. Al actualizar se respetan las notas y ajustes personalizados. [Actualizar o desinstalar](docs/INSTALACION.md).

## Qué puedes hacer

- **Inicio:** pendientes, notas recientes y acceso a lo que estás haciendo.
- **Universidad:** materias, apuntes y entregas con fecha.
- **Proyectos y tareas:** progreso, tabla y tablero con tarjetas y estados.
- **Biblioteca:** cuadernos, etiquetas y búsqueda en el contenido completo.
- **Captura inteligente:** escribe primero; revisa sugerencias de organización, tareas y fechas al guardar. Usa reglas locales y tus nombres existentes, sin gastar API. Los borradores duran mientras la aplicación siga abierta.
- **Tu red:** notas, adjuntos y memorias conectados al guardar, renombrar o borrar archivos, con Neuronas activo. El mapa nativo usa un índice de enlaces automático. El panel distingue archivos homónimos y muestra hasta 120 registros por vista; usa filtros para explorar el resto.
- **Memoria IA:** captura incremental con origen y atribución, búsqueda por tema y contexto breve para asistentes compatibles.
- **Chat:** Gemini, Anthropic, servicios compatibles con OpenAI Chat Completions u Ollama, usando tus notas como contexto. Configuras proveedor, modelo y credenciales.

Las fechas organizan la agenda; no generan notificaciones del sistema. Las sugerencias locales son editables y pueden equivocarse. No hay sincronización de cuentas de Notion, Trello o Evernote.

## Qué cuesta y qué se comparte

Organización, búsqueda, red y captura local no llaman a una API de pago. El chat utiliza el acceso API de tu proveedor, que puede tener coste independiente de una suscripción a su aplicación. Ollama necesita un servidor accesible desde el dispositivo.

Las claves se guardan en ajustes del complemento y pueden viajar con la sincronización de tu bóveda. No se incluyen claves, conversaciones ni notas personales en los paquetes de descarga. Los importadores excluyen herramientas y razonamiento e intentan filtrar credenciales; revisa lo que compartas. El chat es consultivo y no ejecuta acciones.

## Consolas compatibles

| Aplicación | Captura de conversaciones | Contexto compartido |
|---|---|---|
| Codex | Sesiones JSONL | MCP e instrucciones globales |
| Claude Code | Sesiones y evento de finalización | MCP y contexto de inicio |
| Gemini CLI | Sesiones y evento de finalización | MCP y contexto; respeta carpetas confiables |
| Antigravity CLI (`agy`) | Transcripciones finalizadas | MCP y eventos SessionStart/Stop |
| Cursor, Copilot CLI, Windsurf | Sin importador propio | Configuración MCP cuando corresponde |

La captura programada de Windows funciona cada minuto con la sesión del usuario abierta. Los recuerdos ya sincronizados se consultan desde otros dispositivos sin esa PC. Las aplicaciones necesitan cargar su conector; no existe captura universal de todas las IAs.

## Desarrollo

```powershell
npm ci
npm test
npm run check
npm run release
```

`dist/` contiene el complemento compilado; `release/` contiene los dos ZIP y `SHA256SUMS.txt`. Ambos directorios se generan y no se suben al código fuente. GitHub Actions verifica las pruebas y prepara artefactos en cada cambio de `main`.

Desde el código fuente, instala en una bóveda elegida:

```powershell
.\scripts\install.ps1 -VaultPath "D:\Mis notas" -Activate
```

[Arquitectura](docs/ARQUITECTURA.md) · [Validación y límites](docs/VERIFICACION.md) · [Graphify opcional](docs/GRAPHIFY.md) · [Contribuir](CONTRIBUTING.md)
