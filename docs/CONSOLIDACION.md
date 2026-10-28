# Unir extractos por conversación

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

## Restaurar

Cierra Obsidian y detén la captura de **esa bóveda**. Conserva primero cualquier edición posterior. Consulta el JSON contiguo al ZIP para identificar las conversaciones y el resumen que creó la migración; retira solo esos archivos generados. Extrae el ZIP en la raíz de la bóveda reemplazando los originales. Si el ZIP no contiene `.neuronas-storage.json`, retira ese archivo para recuperar el modo individual. El ZIP de notas no incluye el complemento ni sus preferencias; respáldalos aparte antes de actualizar una instalación.

Si mantienes dos bóvedas, cada una debe usar su propio directorio `state`. Este comando no cambia la bóveda configurada en las consolas ni la captura automática global.
