# Validación de la entrega 5.0.0

Fecha: 2026-10-20.

## Comprobaciones realizadas

- `npm test`: 41 pruebas correctas, cero fallos. El comando construye el complemento antes de ejecutar pruebas.
- `npm run check`: sintaxis válida en 38 archivos JavaScript propios y generados.
- Análisis sintáctico PowerShell de instalación, desinstalación y consulta Graphify: sin errores.
- MCP por stdio: inicialización, catálogo de dos herramientas y búsqueda real de memoria correctos.
- Claude Code informó el servidor Neuronas como Connected. Codex lo mostró habilitado.
- Gemini CLI detectó el servidor, pero lo deshabilitó en una carpeta no confiable. No se alteró la política de confianza.
- Los eventos de inicio de Claude y Gemini produjeron JSON válido y contexto breve; no se hicieron generaciones de modelo para probarlos.
- La tarea programada Windows ejecutó importaciones con resultado 0 y sin errores en el estado local.
- La clave de Google existente respondió HTTP 200 a la consulta de modelos; su modelo configurado aparece en la lista. No se probó generación de pago.
- Graphify 0.9.93 procesó un corpus sintético y consultó después el grafo exportado de memoria, mostrando conexiones y notas de origen.
- Se abrió el complemento instalado en Obsidian de escritorio y se inspeccionaron visualmente panel, nombres y mapa.
- El inicio móvil se probó en un contexto sin módulos Node. Los cuatro adaptadores de proveedor tienen pruebas de solicitud/respuesta y una comprobación de transporte HTTP real con servidor local y datos sintéticos.

## Casos de recuperación cubiertos

Sesiones incompletas, truncadas o reescritas con igual tamaño; escritura fallida; regiones consumidas modificadas; estado reutilizado en otra bóveda; concurrencia; CRLF; títulos repetidos; caracteres reservados por wikilinks; copia idéntica de sincronización; renombrado interrumpido con journal persistente; manifiesto previo a la escritura; preferencias añadidas durante una instalación pendiente; preservación de cambios del usuario al reinstalar o desinstalar; bloqueo temporal de iCloud.

La revisión independiente encontró fallos en esas áreas. Se añadieron pruebas de regresión, se corrigieron y se revisaron de nuevo los cuatro bloqueantes restantes; no quedó un bloqueante demostrado entre ellos.

## Migración local

Antes de reconstruir se creó un respaldo adicional de la bóveda anterior. Se verificaron los 344 archivos por SHA256, sin diferencias. La bóveda anterior también se conservó por separado.

Durante el cambio de carpeta de iCloud se localizaron notas generadas en la carpeta anterior; se recuperaron las que faltaban. Las lecturas posteriores y la tarea periódica comprobaron su persistencia. La recuperación local conserva copias idénticas fuera del contexto para no duplicar recuerdos, sin borrar documentos del usuario.

## Límites de esta validación

### Antigravity CLI en Windows

Integración comprobada con una sesión real de `agy`: respuesta correcta, contexto Neuronas presente como `SYSTEM_MESSAGE` en la transcripción y mensajes/respuestas guardados en la bóveda. `agy mcp list` muestra Neuronas habilitado. Los eventos globales SessionStart/Stop ejecutan el conector; la tarea periódica también captura los extractos. La versión probada no produjo registro de metadatos de sesión, por lo que el proyecto puede quedar como General; esto no impide contexto ni captura. No se probó la aplicación gráfica ni el IDE.

45 pruebas automatizadas aprobadas. La regresión adicional con el envoltorio real `USER_REQUEST` verifica que las notas conserven la petición y excluyan metadatos técnicos. El comando de Windows conserva rutas con espacios y JSON Unicode.

No hubo prueba física en iPhone/iPad, ni generaciones reales de Claude/OpenAI/Ollama. La ejecución móvil real, red y sincronización se comprueban en cada dispositivo. La disponibilidad de modelos y cuota depende de cada cuenta.

No se importaron historiales de todas las aplicaciones instaladas ni cuentas externas de Notion, Trello o Evernote. La cobertura exacta figura en README. No se publicó el proyecto ni se subieron memorias a GitHub.

Las estimaciones de tokens usan caracteres/4. No se afirma un porcentaje de ahorro ni una reducción de facturación medida.
