# Consolidar sesiones de Neuronas

> **For agentic workers:** Use superpowers:executing-plans. Ejecutar en esta sesión con pruebas antes de cada cambio de comportamiento.

**Goal:** Reducir los Markdown de la bóveda solicitada sin perder recuerdos ni búsquedas.
**Architecture:** Markdown por conversación, con metadatos individuales y anclas estables. Parser compartido entre CLI/MCP y Obsidian, compatible con notas individuales. Consolidación optativa por bóveda; no modifica la bóveda activa distinta de la indicada.
**Tech Stack:** Node.js, node:test, esbuild, API de Obsidian.
**Spec:** Propuesta aprobada en la conversación: 594 extractos en 20 conversaciones; unir 13 resúmenes; respaldo y actualización de referencias; adaptar Neuronas.

## Global Constraints
- No eliminar contenido ni cambiar atribución, fechas o identificadores.
- Respaldo fuera de la bóveda, previo a reemplazar archivos.
- No publicar ni modificar conectores de la otra bóveda.
- Estados separados para bóvedas diferentes.

## Review Focus
- Contenido con código, comentarios y delimitadores no se convierte en registros falsos.
- Reimportación y captura concurrente conservan identidad y no duplican notas.
- Enlaces wiki, Markdown relativo y Canvas conservan acceso a la fuente.
- Archivos modificados durante la operación abortan antes de eliminar originales.
- Markdown legado, CRLF y móvil siguen funcionando; migración de nombres omite registros agrupados.

## Tasks
### 1. Formato compartido
- [x] Prueba fallida: recuperar varios recuerdos con Unicode, metadatos y anclas desde una conversación; conservar formato legado.
- [x] Implementar `parseMemories`, `renderBundle` y `renderRecord` en `src/memory/format.js` sin dependencias Node.
- [x] Usar el parser en store y plugin; omitir anclas en rename.
- [x] Pruebas enfocadas verdes.

### 2. Capturas agrupadas optativas
- [x] Prueba fallida: al habilitar agrupación, guardar dos mensajes crea un archivo y reimportar no duplica; conflictos no sobrescriben.
- [x] Implementar modo por bóveda en store, usando el mismo bloqueo de notas y escritura atómica.
- [x] Pruebas de concurrencia, modo legado y agrupación verdes.

### 3. Consolidación segura
- [x] Prueba fallida: consolidar conserva todos los registros y referencias, crea respaldo y es idempotente.
- [x] Implementar consolidación y CLI; incluir resúmenes completos sin resumirlos destructivamente.
- [x] Documentar formato, recuperación y comando.
- [x] Ejecutar suite completa, build y revisión.

### 4. Aplicación local
- [x] Respaldar Markdown/Canvas y plugin de la bóveda indicada.
- [x] Aplicar consolidación, instalar build y separar su estado.
- [x] Comparar todos los recuerdos antes/después por identidad, contenido y metadatos; revisar referencias y búsqueda real CLI/plugin.
- [x] Registrar conteos y ruta de restauración.

## Progress
- Baseline: 82 tests, 80 pass, 2 platform skips, 0 failures.
- Git limpio al inicio; rama local feat/consolidar-sesiones-20261028.
- Ruling: ejecución local autorizada por el usuario; no se solicita otra aprobación de plan ni se crea worktree. Los cambios quedan en una rama local revisable.
- Ruling: solo la copia `Memoria IA/Obsidian/Obsidian` se consolida; la configuración global conserva la bóveda activa anterior.

- Final: suite completa 94 pruebas, 92 aprobadas, 2 omitidas por plataforma; 0 fallos. Sintaxis: 74 archivos JavaScript v?lidos.
- Revisi?n independiente: corregidos delimitadores en anotaciones, comparaci?n sem?ntica y relectura de destinos antes de borrar; enlaces a secciones se rechazan antes de escribir y subcarpetas se conservan.
- Aplicaci?n: 690 ? 104 Markdown; 594 extractos ? 20 conversaciones; 13 res?menes ? 1. Los 634 recuerdos conservaron contenido y metadatos; el parser m?vil tambi?n recuper? 634.
- Integridad: ZIP de notas 691 entradas, ZIP del complemento 4 entradas, CRC v?lidos; 607 destinos/anclas comprobados. B?squeda CLI verificada, configuraci?n global conservada, copia con estado propio.
- C?digo queda en rama local, sin publicaci?n ni cambios a conectores globales.
