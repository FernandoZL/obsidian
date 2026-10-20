# Evolución del proyecto: memoria compartida IA

Estado: propuesta para revisión, sin cambios funcionales.

## Base verificada
La copia local coincide con HEAD remoto 2b9d2ed y estaba limpia antes de añadir este documento. La versión declarada es 4.7.3; README todavía anuncia 4.7.0. Los complementos propios son control-center y vault-ai. La bóveda de uso está fuera del repositorio, en iCloud.

## Recomendación
Extender el proyecto existente con un núcleo local de memoria reutilizable por las consolas y por los complementos. Markdown será la fuente de verdad; el índice regenerable y los bloqueos quedarán fuera de iCloud. Conservar las funciones actuales de tareas, tableros y documentos.

## Orden propuesto
1. Primera entrega: memoria compartida en Markdown, búsqueda local con presupuesto de contexto, enlaces a fuentes y adaptadores verificados para Codex, Claude y Gemini. Panel de memoria en Centro de control con últimas sesiones, proyectos y acceso al grafo. Prueba de guardado, consulta y deduplicación en bóveda temporal antes de activar sobre iCloud.
2. Evaluación de Graphify con Markdown de prueba: medir recuperación y compatibilidad MCP. Adoptarlo solo si aporta valor sobre el índice local. La memoria y el grafo nativo no dependerán de él.
3. Extender cobertura a Cursor, Copilot, Antigravity y otras aplicaciones según sus mecanismos reales. Documentar qué se captura automáticamente y qué requiere lanzador o exportación.
4. Mejorar vistas de tareas y proyectos reutilizando Tasks, Kanban y Dataview. Evaluar importaciones de Notion, Trello y Evernote por separado; la sincronización bidireccional queda fuera de la primera entrega.

## Mejoras del proyecto detectadas por lectura
- Revisar Sanitize-VaultSyncConflicts en installer/instalar_obsidian.ps1: actualmente elimina directorios de conflicto después de rescatar únicamente workspace-mobile.json. Conservar o respaldar el contenido completo antes de resolver un conflicto.
- Sustituir la selección de contexto basada únicamente en recortes de caracteres por recuperación relevante y presupuesto explícito. vault-ai usa recortes entre 25.000 y 32.000 caracteres en varias acciones y maxCharacters por defecto de 100.000.
- Revisar la actualización del modelo configurado: vault-ai reemplaza diversos identificadores anteriores durante onload. Separar migraciones necesarias de preferencias del usuario; verificar disponibilidad en la documentación del proveedor antes de cambiar modelos.
- Mantener versiones y documentación coherentes.
- Agregar pruebas del núcleo de memoria, deduplicación, escrituras concurrentes, recuperación tras interrupción y conservación de conflictos; usar comprobación sintáctica para complementos y scripts.

## Contrato de memoria
Cada registro tendrá id estable, tipo, fecha, origen, referencia de sesión, proyecto, estado y enlaces. Las inferencias de asistentes se distinguirán de afirmaciones del usuario. El índice inicial tendrá un presupuesto objetivo de 800 tokens, indicando si el conteo es estimado. Consultas adicionales devolverán solo fragmentos relevantes con referencias.

La captura será incremental, con seguimiento de avance y exclusión de las propias salidas para evitar ciclos. Usar eventos nativos cuando estén soportados; documentar lanzadores o importaciones periódicas como alternativas. La PC debe permanecer encendida para procesar sesiones automáticamente.

## Datos y operación
No publicar notas, historiales, credenciales ni configuraciones privadas. Respaldar configuraciones antes de modificarlas. No añadir llamadas pagadas automáticas en la primera entrega. Los filtros de secretos son una mitigación, no garantía de detección universal. Las escrituras serán atómicas y los conflictos se conservarán para revisión.

## Opciones consideradas
- Recomendada: núcleo local compartido y panel integrado. Permite usar la memoria incluso con Obsidian cerrado.
- Solo complemento de Obsidian: menos componentes, pero la captura depende de que Obsidian esté abierto.
- Servicio externo como centro: mayor dependencia de conectores y condiciones del proveedor; no es necesario para comenzar.

## Criterios de aceptación
Desde una consola soportada: recuperar contexto breve, guardar un aprendizaje, encontrarlo en una sesión posterior y abrir su nota y fuente desde Obsidian. Importar una sesión dos veces sin duplicarla. Mantener secretos de prueba fuera de las salidas. Recuperarse de una escritura interrumpida sin perder las notas originales. Desactivar la automatización conservando las memorias.

## Siguiente paso
Revisar este diseño. Después, preparar el plan de implementación con cambios y validaciones concretas por entrega. No reinstalar la bóveda ni publicar cambios antes de verificar el resultado.
