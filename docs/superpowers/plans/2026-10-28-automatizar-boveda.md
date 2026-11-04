# Automatizar la bóveda organizada

**Goal:** Dirigir la captura de Windows y los conectores a la bóveda consolidada y reunir futuros resúmenes sin intervención.
**Architecture:** Mantener la tarea de captura de un minuto, usar el estado independiente de la bóveda nueva y ejecutar mantenimiento de resúmenes al terminar cada captura. El mantenimiento conserva el resumen acumulado y respalda antes de retirar notas nuevas.
**Scope approved:** El usuario pidió hacerlo automáticamente tras explicar que faltaba redirigir la captura y automatizar los resúmenes. Se ejecuta localmente, con respaldo, sin nuevas preguntas ni publicación.

- [x] Pruebas: añadir un resumen nuevo a uno reunido conserva ambos y sus referencias; repetir no duplica; sync activa mantenimiento solo por configuración de bóveda.
- [x] Implementar mantenimiento de resúmenes en consolidación e importador, y documentar.
- [x] Suite completa y build antes de instalar.
- [x] Respaldar configuración, tarea y recuerdos de ambas bóvedas; detener temporalmente tarea durante el cambio.
- [x] Copiar recuerdos faltantes de la anterior sin borrar fuentes y conservar el avance de importación con identidad de la nueva bóveda.
- [x] Redirigir configuración global, instrucciones compartidas, tarea y complemento. Mantener APIs y ajustes personales.
- [x] Ejecutar captura real, comprobar tarea, destino, búsquedas, ausencia de duplicados y respaldo.

## Constraints
- No activar nuevas llamadas a proveedores IA ni costes: reunir resúmenes existentes/nuevos es una operación local.
- No borrar la bóveda anterior ni sus preferencias.
- Los procesos MCP abiertos cargaron su destino al arrancar y necesitan reiniciarse; no cerrar consolas del usuario.
- Cada estado pertenece a una sola bóveda.

## Verification
- Suite:97 pruebas,95 aprobadas,2 omitidas por plataforma,0 fallos. Sintaxis:74 archivos v?lidos. Revisi?n independiente sin bloqueos tras corregir deduplicaci?n de res?menes y validaci?n de enlaces desde conversaciones.
- Recuperaci?n:1372 recuerdos faltantes; se verificaron contenido y metadatos de la uni?n. Fuentes anteriores intactas y respaldo ZIP verificado (2172 entradas).
- Tarea Windows:PT1M, habilitada, acci?n usa el estado de la b?veda organizada. Primera ejecuci?n real:1 importado,0 errores,c?digo de tarea0. Segunda captura:0 importados,0 errores.
- Estado comprobado:2007 recuerdos,1855 extractos en54 archivos de conversaci?n, todos agrupados; plugin y captura comparten estado, mantenimiento de res?menes habilitado. Conteos pueden crecer con nuevas capturas.
- Config global y last-setup, bloque compartido de Codex/Claude/Gemini y complemento actualizados. Procesos MCP ya abiertos conservan la configuraci?n de arranque hasta reiniciarse; no se cierran consolas.
