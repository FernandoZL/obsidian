# Organización por eventos con asistentes de respaldo

**Goal:** Capturar y organizar semánticamente la bóveda al iniciar sesión o conectar corriente, sin temporizador de un minuto.
**Architecture:** Windows activa un runner local. Captura primero, prepara un inventario compacto, solicita un plan JSON a Codex/Claude/AGY por orden y aplica fusiones con código local validado y respaldo. Los asistentes no reciben permisos de escritura en la bóveda. Una falla de autenticación, límite, timeout o plan inválido pasa al siguiente. Se omite IA si no cambió el contenido desde la última organización satisfactoria.
**Authorization:** El usuario pidió explícitamente inicio de PC/corriente y asistentes intercambiables. Implementar y verificar sin solicitar otra aprobación.

## Tasks
- [x] Pruebas de fallback, salida inválida, timeout, clasificación, validación de rutas y preservación de todos los recuerdos/enlaces/anotaciones.
- [x] Formar planes agrupando recuerdos de una misma categoría por temas. Proteger materias, tareas, tableros, configuración y adjuntos; incluir navegación temática para el resto.
- [x] Aplicar mediante la transacción de consolidación existente, con respaldo, revisión de cambios simultáneos y rollback.
- [x] Runner no interactivo: Codex → Claude → AGY; sin bypass de permisos y sin ejecución de instrucciones de las notas.
- [x] Tarea con inicio de sesión y evento Kernel-Power 105 AcOnline=true; ninguna repetición periódica, mutex de ejecución.
- [x] Pruebas completas, ejecución real por un asistente y registro del resultado; verificar configuración de la tarea.

## Constraints
- Conservar los registros individuales, atribuciones, fechas y fuentes; la agrupación semántica cambia los archivos, no reescribe las conversaciones.
- No borrar notas académicas ni convertir tableros en documentos.
- No enviar claves ni configuración de proveedores: el inventario excluye .obsidian y redacta extractos.
- Los agentes reciben solo inventario textual y devuelven JSON; el código local decide qué se puede escribir.
- Sin red o con los tres asistentes indisponibles: guardar error y conservar las fuentes; siguiente evento reintenta.
- Aprovechar autenticación existente de los CLIs. No cambiar modelos ni contratar servicios.

## Evidence
- Retirado el disparador PT1M el 28-10-2026 antes de implementar el runner.
- Codex y Claude autenticados; AGY instalado y dispone de --print --mode plan --sandbox.
- Confirmado evento real System/Kernel-Power 105 con Data AcOnline=true al conectar corriente y false al desconectar.
- Referencia oficial Codex: https://learn.chatgpt.com/docs/non-interactive-mode (exec, read-only, output-schema).

## Completion evidence
- Suite final:104 pruebas,102 aprobadas,2 omitidas por plataforma,0 fallos. Sintaxis:79 archivos JS v?lidos.
- Primera ejecuci?n real:Codex,45 grupos tem?ticos,297?186 Markdown, respaldos y validaci?n de registros antes de borrar. Segunda ejecuci?n omiti? IA por huella sin cambios.
- Tarea Windows ejecutada mediante VBS:resultado0; exactamente LogonTrigger + EventTrigger Kernel-Power105 AcOnline=true; ninguna repetici?n peri?dica.
- Fallback probado con procesos ausentes/JSON inv?lido/timeout/plan inv?lido y protocolo NDJSON de AGY. Claude real retorna l?mite semanal, tratado como indisponible. AGY real no respondi? dentro del plazo de prueba; no se afirma disponibilidad de los tres.
- Revisi?n:Codex sin shell/web/plugins/MCP; AGY confirma tools=[] antes de recibir inventario; Claude tools vac?os. Se rechazan colisiones de encabezados referenciados por wiki, Markdown inline/referencia y Canvas.
- Hooks internos y adaptadores no recapturan los trabajos del organizador. Plugin instalado; fuentes de la b?veda anterior se conservan.
