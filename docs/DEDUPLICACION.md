# Prevención de repeticiones · 5.4.1

Las capturas largas de sesión con contenido idéntico se reúnen únicamente cuando coinciden tipo, fuente y atribución. Se conservan sus IDs, fechas, sesiones y procedencias en `occurrences`, con anclas alias para mantener las referencias. No se mezclan decisiones con sesiones ni mensajes del usuario con respuestas del asistente.

Los mensajes cortos pueden repetirse legítimamente y no se fusionan por contenido. Los extractos truncados nuevos incluyen un hash del texto completo ya filtrado: compartir los primeros 6000 caracteres no basta para fusionarlos. Los avisos automáticos conocidos de límites de uso y los envoltorios de herramientas se omiten antes de capturar; una pregunta humana sobre ellos sigue guardándose.

El organizador retira las portadas generadas de los paquetes antes de reunirlos otra vez. No modifica el contenido de los recuerdos ni las anotaciones personales fuera de esas portadas.

## Reparación de datos históricos

`src/memory/repair.js` expone `planRepair(files)` y `repairVault(vault, { backupDirectory })`. Utiliza el respaldo ZIP y la transacción de consolidación existentes. El respaldo debe quedar fuera de la bóveda. Antes de escribir valida todos los recuerdos únicos y conserva la procedencia de los extractos reunidos. Si una nota cambia simultáneamente, detiene la operación y protege los originales.

La limpieza de avisos técnicos conserva en las notas sus anclas y anotaciones; el contenido técnico original permanece en el respaldo. La reparación es idempotente: una segunda ejecución sin cambios no vuelve a escribir.

Esto evita las causas reproducidas y comprobadas mediante las pruebas de `tests/deduplication.test.js`. No promete detectar similitud semántica, duplicaciones parciales, mensajes cortos legítimos ni alteraciones hechas por otras instalaciones desactualizadas. Para cargar el código del complemento después de instalarlo, recargar Neuronas o reiniciar Obsidian.

## Mapa automático · 5.4.2

Si falta `Red automática.md` pero existe una única copia numerada con los marcadores del mapa generado, el complemento la recupera mediante el renombrado de Obsidian, conservando anotaciones y actualizando sus referencias. Si encuentra varias copias generadas, las conserva para revisión en lugar de crear otra. Una nota con nombre parecido sin esos marcadores no se considera una copia del mapa. Pruebas: `tests/graph.test.js`.
