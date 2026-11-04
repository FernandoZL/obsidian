# Unir extractos por conversación

## Organización automática por eventos con IA

`node bin/organize.js` captura los mensajes nuevos y solicita a **Codex → Claude → AGY** una propuesta de agrupación por temas. Si un programa está ausente, falla su conexión, alcanza un límite, tarda más de tres minutos o devuelve un plan inválido, continúa con el siguiente. Si todos fallan, registra el motivo sin aplicar fusiones.

Los asistentes reciben un inventario con extractos redactados y devuelven JSON. No tienen permiso para modificar la bóveda: las fusiones y actualizaciones de enlaces las aplica código local, con respaldo y comparación de recuerdos. Codex deshabilita shell, web, plugins y herramientas; Claude usa herramientas vacías; AGY selecciona un agente sin herramientas y debe confirmarlo en su evento `init` antes de recibir el inventario. No se cambian los modelos ni la autenticación de las cuentas.

La IA agrupa recuerdos compatibles dentro de una misma categoría, conservando contenido, fechas, atribuciones, fuentes y anotaciones. Las notas académicas, índices operativos, tableros y adjuntos mantienen su estructura. Se incorpora una navegación temática en Memoria IA. Si la huella de los archivos no cambió desde la última organización satisfactoria, no se vuelve a llamar a los asistentes.

En Windows, `scripts/activate-organizer.ps1` instala dos disparadores para `ObsidianNeuronas-Sync`: inicio de sesión y evento System/Kernel-Power 105 con `AcOnline=true`. Espera treinta segundos para que la sesión y red estén disponibles. **No tiene repetición de un minuto.** La acción usa `state/organize-hidden.vbs`; una ejecución simultánea se ignora. Los resultados y fallos se registran en `state/organization-status.json`; los planes quedan en `state/organization-runs` y los respaldos en `state/backups`.

La captura y los hooks manuales siguen disponibles. El disparador de corriente usa un evento comprobado en esta PC; en otros dispositivos debe verificarse que Windows emita ese evento. Se necesita una sesión de Windows abierta y conexión del asistente. Una cuota agotada se trata como indisponibilidad, sin cambiar de cuenta ni contratar servicios.

## Consolidación manual

`node bin/memory.js consolidate --vault "ruta de la bóveda"`

Une las notas de `09 - Memoria IA/Sesiones` por aplicación y conversación. Cada extracto conserva su identificador, contenido, metadatos, anotaciones y un enlace de bloque estable. El CLI, MCP y complemento leen recuerdos individuales y agrupados. Las nuevas capturas de esa bóveda se añaden a su conversación; otras bóvedas conservan su formato anterior.

También reúne las notas de `07 - Recursos/01 - Resumenes automaticos` en una nota histórica con sus textos y metadatos completos. No resume ni interpreta las conversaciones y no elimina preferencias, decisiones o aprendizajes.

## Respaldo y comprobaciones

Antes de reemplazar notas se crea un ZIP fuera de la bóveda: `ObsidianNeuronas/backups` en el directorio de datos local. `--backup "carpeta"` cambia su ubicación. El ZIP conserva los Markdown y Canvas originales y la configuración de agrupación si ya existía. El archivo JSON contiguo registra los destinos y conteos; no incluye credenciales.

Se verifica la igualdad de todos los recuerdos y que las fuentes no hayan cambiado durante el respaldo. Un error durante la operación restaura los archivos que el proceso modificó, conservando ediciones humanas concurrentes. Repetir la operación sobre una bóveda ya consolidada no vuelve a agruparla.

Las referencias wiki, Markdown y Canvas se actualizan. La migración se limita a archivos directamente en esas dos carpetas. Se detiene antes de escribir si hay referencias a encabezados o bloques específicos dentro de notas que se trasladarían, o enlaces locales a secciones en las sesiones: estos necesitan una revisión individual para conservar exactamente su destino. Las subcarpetas permanecen intactas.

## Formato y edición

Las conversaciones tienen `neuronasBundle: 1` en su YAML. Cada extracto tiene metadatos JSON en un comentario, un ancla `^neuronas-ID` y delimitadores de contenido y registro. Puedes editar el texto del extracto y añadir anotaciones, conservando esos comentarios y el identificador. Los ejemplos de comentarios dentro del texto no crean recuerdos adicionales. No copies registros completos fuera de sus delimitadores: eso puede interpretarse como un recuerdo nuevo.

La migración habilita `.neuronas-storage.json` dentro de `09 - Memoria IA`. Las decisiones, preferencias y aprendizajes siguen usando notas individuales. En móvil, la lectura de las conversaciones no necesita Node; la captura automática sigue ejecutándose en la computadora.

Si `.neuronas-storage.json` incluye `"autoConsolidateSummaries": true`, cada captura ejecutada en la computadora reúne los resúmenes nuevos en `Resúmenes reunidos.md`, conserva todo el contenido anterior y actualiza los enlaces. Se crea respaldo solo cuando hay notas para reunir, en `state/backups`. El mantenimiento no activa la generación de resúmenes con IA ni llama a proveedores. Una nueva versión de un resumen se conserva como otra entrada histórica con su propia ancla; no reemplaza anotaciones previas.

## Restaurar

Cierra Obsidian y detén la captura de **esa bóveda**. Conserva primero cualquier edición posterior. Consulta el JSON contiguo al ZIP para identificar las conversaciones y el resumen que creó la migración; retira solo esos archivos generados. Extrae el ZIP en la raíz de la bóveda reemplazando los originales. Si el ZIP no contiene `.neuronas-storage.json`, retira ese archivo para recuperar el modo individual. El ZIP de notas no incluye el complemento ni sus preferencias; respáldalos aparte antes de actualizar una instalación.

Si mantienes dos bóvedas, cada una debe usar su propio directorio `state`. Este comando no cambia la bóveda configurada en las consolas ni la captura automática global.
