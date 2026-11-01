# Limpieza y prevención de duplicados

**Objetivo:** limpiar las repeticiones confirmadas sin perder recuerdos únicos, procedencia, anotaciones o enlaces; impedir las causas observadas en nuevas capturas y fusiones.

**Arquitectura:** comparar extractos largos de sesión por contenido y atribución, conservar las ocurrencias originales y sus anclas como alias, filtrar envoltorios automáticos antes de importar y eliminar únicamente encabezados generados fuera de los registros. Aplicar la reparación con el mecanismo existente de respaldo, bloqueo, comprobación de cambios concurrentes y reversa.

**Restricciones:** no alterar las aplicaciones de htdocs; no borrar texto humano; no mezclar tipos, fuentes o atribuciones; no confundir prefijos truncados con mensajes completos iguales. No publicar ni hacer push.

## Ejecución y verificaciones

- [x] Añadir pruebas que fallen para contenido idéntico con IDs distintos, procedencia y alias, repetición concurrente, contenido truncado diferente, ruido de consola y fusiones reiteradas con anotaciones.
- [x] Corregir `src/memory/store.js`, `src/memory/format.js`, `src/adapters/common.js` y `src/organizer/vault.js` con utilidades enfocadas y sin modificar el contenido de los extractos únicos.
- [x] Añadir planificador de reparación idempotente y pruebas de respaldo, anclas, ruido, anotaciones, conflictos y conservación de todos los textos únicos.
- [x] Ejecutar pruebas completas y build; respaldar fuera de la bóveda y aplicar el plan validado a los archivos afectados.
- [x] Repetir auditoría y sincronización para verificar que no reaparezcan los duplicados. Instalar el build local del complemento conservando su configuración.

## Riesgos que deben probarse

- Los mensajes cortos repetidos pueden ser intervenciones legítimas: no fusionarlos por contenido.
- Dos mensajes truncados pueden compartir el prefijo: comparar su hash completo cuando esté disponible.
- Los enlaces a IDs retirados deben continuar funcionando mediante anclas alias.
- Las anotaciones fuera de los bloques y el texto de los registros deben permanecer intactos.
- Una edición concurrente o un conflicto de identidad debe detener la reparación sin perder el original.
