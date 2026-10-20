# Reconstrucción limpia de Obsidian y memoria IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir el proyecto con memoria Markdown compartida, recuperación breve y una interfaz Obsidian que permita inspeccionar sesiones y relaciones.

**Architecture:** Núcleo local Node.js sin dependencias de servicios pagados, con CLI y adaptadores de sesiones. Un complemento Obsidian separado muestra y consulta la memoria; Markdown vive en iCloud y el estado regenerable fuera de iCloud. Los adaptadores se habilitan individualmente tras comprobar el formato real instalado.

**Tech Stack:** Node.js LTS compatible >=22, JavaScript CommonJS, node:test, PowerShell, API de complementos de Obsidian. No instalar dependencias globales innecesarias.

**Spec:** docs/PROPUESTA_MEMORIA_COMPARTIDA.md, con la autorización posterior del usuario para reconstruir desde cero.

## Global Constraints
- Primera entrega sin nuevas llamadas pagadas automáticas.
- Markdown será la fuente de verdad; índices y bloqueos fuera de iCloud.
- Contexto inicial: presupuesto objetivo de 800 tokens estimados, con esa estimación explícita.
- No publicar historiales, notas ni credenciales en GitHub.
- Preservar la API de Google configurada mediante migración local de ajustes, sin mostrar valores.
- No garantizar captura universal: documentar cobertura real por aplicación.
- La autorización de borrado cubre la reconstrucción del proyecto y de la bóveda indicada; no otras carpetas o aplicaciones del usuario.
- Revisar rutas absolutas antes de mover o borrar directorios; mantener un inventario de migración y reversión.

## Review Focus
- Sesiones cortadas o en escritura: omitir fragmentos incompletos y reintentar sin duplicar.
- Mismo nombre de proyecto o nota: usar identificadores estables y referencias sin ambigüedad.
- Texto español, wikilinks y rutas con espacios: preservar Unicode y evitar salida fuera de la bóveda.
- iCloud inaccesible o archivo en conflicto: conservar originales, no avanzar el punto de importación si falla la escritura.
- Reinicio y consultas simultáneas: mantener Markdown válido, puntos de avance recuperables y escrituras atómicas.

## Estructura propuesta
- package.json: comandos test, memory y check.
- src/memory/store.js: notas con metadatos, deduplicación y escritura atómica.
- src/memory/retrieve.js: extracción de términos, relevancia y presupuesto de contexto.
- src/memory/redact.js: filtrado de patrones de credenciales conocidos.
- src/adapters/{codex,claude,gemini}.js: normalización de eventos verificados.
- src/importer.js: puntos de avance y manejo de sesiones incompletas.
- bin/memory.js: CLI init, add, search, context, sync y status.
- obsidian-plugin/{main.js,manifest.json,styles.css}: panel de memoria, búsqueda y navegación.
- scripts/{install,uninstall}.ps1: despliegue local, respaldo de ajustes y reversión.
- tests/: pruebas de comportamiento con fixtures sintéticos y directorios temporales.
- docs/: guía de uso, cobertura, migración y evaluación de Graphify.

## Task 1: Preparar reconstrucción y contrato de datos
**Files:** package.json, tests/store.test.js, src/memory/store.js, docs/MIGRACION.md.
**Interfaces:** saveMemory(vaultPath, record) -> {id,path,created}; readMemories(vaultPath) -> record[]. Campos: id,type,date,source,session,project,status,content,links.
- [ ] Inventariar datos y configuraciones reales; comprobar qué respaldos contienen notas y ajustes. Crear respaldo adicional de lo que vaya a reemplazarse y comprobar archivos antes de mover la bóveda.
- [ ] Preparar rama de reconstrucción sin publicar cambios; conservar historia Git.
- [ ] Escribir y ejecutar pruebas fallidas de guardado, deduplicación, Unicode y rechazo de rutas fuera de la bóveda.
- [ ] Implementar store con identificadores estables y reemplazo atómico; conservar archivos ajenos y conflictos.
- [ ] Ejecutar node --test; verificar que una escritura fallida conserva el original.

## Task 2: Recuperación local y filtrado
**Files:** src/memory/retrieve.js, src/memory/redact.js, tests/retrieve.test.js, tests/redact.test.js.
**Interfaces:** searchMemories(records,query,{maxChars}) -> {text,sources,estimatedTokens}; redact(text) -> string.
- [ ] Escribir y ejecutar pruebas fallidas de relevancia en español, consultas vacías, presupuesto de 800 tokens estimados y secretos sintéticos.
- [ ] Implementar búsqueda por términos normalizados y referencias; identificar contenido recuperado como datos, no instrucciones ejecutables.
- [ ] Implementar patrones para claves y tokens conocidos sin leer archivos de autenticación.
- [ ] Ejecutar node --test; comprobar que búsqueda y lectura no realizan llamadas de red.

## Task 3: Importación y CLI
**Files:** src/adapters/codex.js, src/adapters/claude.js, src/adapters/gemini.js, src/importer.js, bin/memory.js, tests/importer.test.js, tests/cli.test.js.
**Interfaces:** adaptSession(raw,sourcePath) -> normalizedRecords[]; sync(config) -> {imported,skipped,errors}; CLI con --vault y --state explícitos.
- [ ] Consultar documentación oficial y observar estructura de sesiones instalada sin imprimir conversaciones ni credenciales. No asumir formatos ni eventos.
- [ ] Escribir fixtures sintéticos de los formatos verificados y pruebas fallidas de importación repetida, sesión parcial, archivo truncado y bóveda temporalmente inaccesible.
- [ ] Implementar adaptadores individuales; guardar extractos como extractos y distinguir declaraciones del usuario de inferencias de asistentes.
- [ ] Implementar puntos de avance por origen; excluir salidas propias para evitar ciclos. No avanzar estado si falla escritura.
- [ ] Implementar CLI init/add/search/context/sync/status y validar argumentos.
- [ ] Ejecutar node --test y un flujo CLI completo en bóveda temporal.

## Task 4: Complemento y bóveda limpia
**Files:** obsidian-plugin/main.js, obsidian-plugin/manifest.json, obsidian-plugin/styles.css, tests/plugin.test.js, templates/.
**Interfaces:** complemento consume las notas Markdown del contrato; vistas de sesiones, proyectos, decisiones, búsqueda y enlaces al grafo.
- [ ] Crear pruebas fallidas sobre selección de notas de memoria y generación de enlaces usando utilidades puras; simular solo el límite de API de Obsidian.
- [ ] Implementar un panel sencillo con estado de sincronización, última importación y navegación a fuente. Evitar dependencias de Node en vistas móviles.
- [ ] Crear plantillas Inicio, Perfil, Proyectos, Decisiones, Aprendizajes y Sesiones con wikilinks; conservar tareas y tableros como Markdown portable.
- [ ] Migrar ajustes Gemini/Ollama de forma local; verificar disponibilidad del modelo antes de modificarlo. No cambiar claves.
- [ ] Ejecutar node --test y node --check sobre todos los archivos propios; abrir Obsidian y comprobar panel, búsqueda y grafo si la interfaz local está disponible.

## Task 5: Activación de consolas y despliegue
**Files:** scripts/install.ps1, scripts/uninstall.ps1, tests/install.test.js, docs/COBERTURA.md, README.md.
**Interfaces:** instalador recibe rutas de código, bóveda y estado; desinstalador elimina exclusivamente elementos registrados en manifiesto de instalación.
- [ ] Escribir pruebas fallidas para instalación repetida, conservación de configuraciones existentes y desinstalación sin pérdida de notas.
- [ ] Elegir eventos nativos documentados por cada consola; donde falten, crear lanzadores visibles y documentar su alcance. Usar tarea programada solo para importación periódica necesaria.
- [ ] Respaldar y combinar instrucciones globales sin sobrescribir reglas ajenas; mantener arranque breve y consulta bajo demanda.
- [ ] Probar instalación/desinstalación en destino temporal y analizar sintaxis PowerShell sin ejecutar acciones destructivas.
- [ ] Desplegar en la bóveda real; verificar guardado/consulta desde cada consola disponible. Registrar cuáles se probaron y cuáles quedan sin cobertura.

## Task 6: Graphify, validación final y documentación
**Files:** docs/GRAPHIFY.md, docs/VERIFICACION.md, README.md, VERSION.
- [ ] Verificar documentación actual de Graphify y probar con Markdown sintético sin secretos. Registrar compatibilidad, dependencia de nube y coste de indexación observado.
- [ ] Adoptar integración opcional solo si funciona con el contrato de memoria; mantener búsqueda y grafo Obsidian operativos sin ella.
- [ ] Ejecutar node --test, comprobación sintáctica de JavaScript y PowerShell, y revisión de diff y secretos antes de preparar cualquier publicación.
- [ ] Comparar tamaño del contexto bruto y recuperado para la misma tarea; etiquetar números como estimaciones o mediciones reales.
- [ ] Documentar cobertura efectiva, operación con PC apagada, sincronización iCloud, límites de filtrado y pasos de reversión.
- [ ] Entregar cambios locales verificables. Publicación en GitHub queda pendiente de revisar el resultado concreto.
