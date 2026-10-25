<div align="center">

# 🧠 Neuronas

### Tus ideas conectadas. Tu memoria, siempre tuya.

Una bóveda para tus apuntes, universidad, proyectos y recuerdos de IA. Tus notas viven en archivos Markdown que puedes abrir, mover y conservar.

![Versión del código](https://img.shields.io/badge/c%C3%B3digo-5.4.0-7868e6?style=for-the-badge)
![Obsidian](https://img.shields.io/badge/para-Obsidian-7c6de8?style=for-the-badge&logo=obsidian&logoColor=white)
![Plataformas](https://img.shields.io/badge/Windows%20%E2%80%A2%20Linux%20%E2%80%A2%20m%C3%B3vil-242938?style=for-the-badge)

**Creado por Fernando ZL** · [Descargas](https://github.com/FernandoZL/obsidian/releases/latest) · [Instalación](docs/INSTALACION.md) · [Linux e iCloud](docs/LINUX.md) · [Celular e iPad](docs/MOVIL.md)

</div>

---

## Empieza por aquí

Elige el paquete según lo que quieras usar. Los ZIP de la versión actual se preparan en [GitHub Actions](https://github.com/FernandoZL/obsidian/actions); **Releases** contiene la última versión publicada.

| Paquete | Incluye | Requisitos |
|:--|:--|:--|
| **Plugin** | Notas, materias, proyectos, tareas, captura y red automática | Obsidian en Windows, macOS, Linux, iOS o Android |
| **Windows** | Plugin y conexiones con consolas de IA | Windows y Node.js 22+ |
| **Linux** | Plugin, memoria de consolas y conexión opcional con iCloud | Linux, Node.js 22+; iCloud requiere Python 3.10+ y rclone |

### Solo quieres el complemento

1. Descarga y descomprime el ZIP **Plugin**.
2. Copia la carpeta `neuronas` dentro de `<tu bóveda>/.obsidian/plugins/`.
3. En Obsidian, habilita los complementos de comunidad y activa **Neuronas**.
4. Abre el icono del cerebro y elige **Escribir una nota**.

Para el celular, instala primero el complemento en la PC y sincroniza la bóveda junto con su carpeta `.obsidian`. Después actívalo en el dispositivo. [Ver guía móvil](docs/MOVIL.md).

### Windows y consolas de IA

1. Instala Obsidian y Node.js 22 o posterior.
2. Extrae el ZIP **Windows** en una carpeta estable, fuera de la bóveda.
3. Ejecuta `INSTALAR.bat` y selecciona tu bóveda —o crea una nueva—.
4. Elige si quieres conectar las consolas de IA y reinicia las aplicaciones abiertas.

El ZIP está compilado y no requiere Git ni `npm install`. Conserva la carpeta extraída porque las consolas usan sus archivos. Al actualizar se respetan las notas y ajustes personalizados. [Actualizar o desinstalar](docs/INSTALACION.md).

### Linux y consolas de IA

Extrae el ZIP **Linux** en una carpeta estable, fuera de la bóveda, y ejecuta:

```bash
node scripts/install-linux.js --vault "$HOME/Documentos/Mis notas"
```

La ruta es un ejemplo: cada usuario elige la suya. La captura de memoria funciona cada minuto con la sesión abierta. Para conectar iCloud, instala rclone y ejecuta `~/.local/bin/icloud-conectar`. [Ver instalación Linux, sincronización y desinstalación](docs/LINUX.md).

---

## Lo que puedes hacer

| | Función |
|:--:|:--|
| 📝 | **Capturar ideas** en Markdown y encontrarlas con búsqueda de contenido y etiquetas. |
| 🎓 | **Organizar la universidad** por materias, apuntes y entregas. |
| 🧩 | **Llevar proyectos y tareas** con tablas, tableros y estados. |
| ✨ | **Ordenar notas al guardar** con sugerencias locales de carpeta, tareas y fechas. Tú revisas y decides. |
| 🕸️ | **Conectar la bóveda** al crear, renombrar o borrar notas; el grafo evita repetir nodos. |
| 🤖 | **Compartir memoria entre asistentes** con búsqueda por tema y contexto breve. |
| 💬 | **Consultar tus notas en el chat** con Gemini, Anthropic, servicios compatibles con OpenAI Chat Completions u Ollama. |

Neuronas no envía tus datos a una API para organizar, buscar o conectar notas. El chat sí usa el servicio que configures y puede generar cargos de API. Ollama requiere un servidor accesible desde el dispositivo.

## Una memoria compartida entre tus asistentes

> Codex, Claude y AGY pueden consultar recuerdos guardados por cualquiera de las IAs y leer notas completas de la bóveda. El contexto inicial es breve para ahorrar relecturas; no limita el acceso.

| Consola | Captura de sesiones | Contexto compartido |
|:--|:--|:--|
| Codex | Sesiones JSONL | MCP e instrucciones |
| Claude Code | Sesiones y evento de finalización | MCP y contexto de inicio |
| Gemini CLI | Sesiones y evento de finalización | MCP y contexto en carpetas confiables |
| Antigravity CLI (`agy`) | Transcripciones finalizadas | MCP y eventos de sesión |
| Cursor, Copilot CLI, Windsurf | Sin importador propio | MCP cuando está disponible |

La captura automática solo cubre formatos compatibles; no existe captura universal de todas las IAs. Las claves del chat se guardan en los ajustes del complemento y pueden sincronizarse con la bóveda. No incluyas claves, conversaciones ni notas privadas al compartir archivos. Los importadores excluyen herramientas y razonamiento e intentan filtrar credenciales. El chat es consultivo: no ejecuta acciones.

## Desarrollo

En Windows PowerShell, macOS o Linux:

```sh
npm ci
npm test
npm run check
npm run release
```

`dist/` contiene el complemento compilado. `release/` genera los paquetes Plugin, Windows y Linux junto con `SHA256SUMS.txt`; ambos directorios se generan localmente y no se suben al código fuente. GitHub Actions comprueba Windows y Linux y publica los ZIP como artefactos de cada ejecución.

Desde el código fuente, puedes instalar en la bóveda que elijas:

```powershell
.\scripts\install.ps1 -VaultPath "D:\Mis notas" -Activate
```

## Proyecto

**Neuronas para Obsidian** · versión del código **5.4.0**<br>
Desarrollado por **Fernando ZL**. Las notas permanecen en la bóveda del usuario, en formatos abiertos.

[Arquitectura](docs/ARQUITECTURA.md) · [Verificación y límites](docs/VERIFICACION.md) · [Graphify opcional](docs/GRAPHIFY.md) · [Contribuir](CONTRIBUTING.md)
