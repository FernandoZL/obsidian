# Changelog

## 4.7.0 - Integración con Google Gemini (Antigravity) y arquitectura neutral

- Integración completa con la API de Google Gemini (`gemini-flash-latest`, `gemini-3.6-flash`, `gemini-2.5-flash`, `gemini-pro-latest`): procesamiento ultrarrápido y multimodal de documentos en Obsidian.
- Soporte nativo de IA para móvil (iPhone/iPad) y escritorio directamente vía HTTPS sin requerir servidor local ni ordenador encendido.
- Ventana de contexto masiva (100k+ caracteres) para resúmenes de documentos completos en una sola pasada.
- Modo híbrido de IA: Google Gemini como motor primario en la nube con respaldo local sin conexión a Ollama (`127.0.0.1:11434`).
- Reemplazo completo de plugins anteriores por componentes modulares y limpios:
  - `control-center` (v4.7.0): núcleo del sistema, agenda, buscador global, materias, finanzas y asistente contextual.
  - `vault-ai` (v4.7.0): motor de IA universal para escritorio y móvil con soporte para Gemini y Ollama.
  - `mobile-ui` (v4.7.0): interfaz de navegación móvil optimizada, vistas dedicadas y botón de inicio flotante.
- Erradicación total de referencias a marcas previas en código fuente, nombres de carpetas, identificadores de plugins, snippets CSS y documentación.
- Migración transparente y sin pérdida de información: el instalador universal detecta instalaciones previas, limpia plugins obsoletos y preserva intactas notas, tareas, finanzas y configuraciones de usuario.
- Snippets de diseño actualizados y neutralizados: `sistema-colores.css` y `sistema-neuronal.css`.

## 4.6.6 - Móvil, recordatorios y consultas de pendientes

- Las consultas como `Dime qué tengo pendiente` se responden sin crear tareas ni recordatorios.
- Se eliminan de forma conservadora recordatorios conversacionales incorrectos creados anteriormente.
- Se evita repetir el nombre de un proyecto en textos como `Continuar proyecto: Proyecto — Proyecto`.
- Las fechas visibles usan el idioma/región configurados.
- La sección `Próximos` se compacta en móvil.
- El modal de recordatorios considera teclado, `visualViewport` y safe-area en iPhone.
- `Guardar` y `Cancelar` permanecen accesibles durante la captura móvil.
- El validador de runtime obtiene la versión esperada desde el propio proyecto.
- El instalador muestra la versión real del sistema en vez de depender de texto fijo.
- V4.6.6 fue probada en escritorio y móvil antes de integrarse como versión estable.

## 4.6.5 - Arranque persistente y validación real

- El núcleo del sistema escribe un heartbeat local cuando `onload()` se ejecuta realmente.
- `VALIDAR_OBSIDIAN.bat` distingue entre plugin habilitado y plugin cargado en runtime.
- En Windows se intenta mantener disponibles localmente los archivos técnicos en bóvedas sincronizadas.
- El Centro de control usa varios intentos cortos de recuperación durante el arranque.
- El instalador universal ejecuta la validación real de runtime al finalizar.
- Se elimina el nombre duplicado del comando de estudio automático.
- Se conservan notas, documentos, contextos, finanzas y `data.json`.

## 4.6.4 - Validación robusta de activación y preparación pública

- Relee `community-plugins.json` y exige plugins principales del sistema.
- Relee `appearance.json` y exige snippets de estilo del sistema.
- Retira IDs anteriores conservando otros plugins y snippets del usuario.
- Reintenta la activación para bóvedas sincronizadas.
- Vuelve a comprobar después de abrir Obsidian.
- Si Obsidian/iCloud restaura IDs antiguos, repara y valida otra vez.
- Agrega `VALIDAR_OBSIDIAN.bat`.
- Alinea la versión de los plugins con `VERSION`.
- Agrega licencia MIT para publicación pública.

## 4.6.3 - Portabilidad estable, perfil regional y apariencia

- Corrige la migración de región y moneda para que no se imponga `en-US` / `USD`.
- El instalador universal configura el locale y deriva la moneda del perfil local.
- Preserva/migra los snippets visuales del sistema.
- Preserva una gráfica existente con grupos de colores; si falta, instala una gráfica universal por áreas.
- Muestra los contextos activos de educación y trabajo en el encabezado del Centro de control.
- Refuerza la limpieza segura de `.obsidian` anidadas sin tocar la configuración raíz.
- Mantiene la interfaz móvil compacta ocultando chips de contexto en pantallas pequeñas.

## 4.6.2 - 2026-09-03

- Reparación del migrador universal: validación robusta de VERSION y recuperación segura tras una migración parcial.
- No cambia ni borra datos personales; conserva respaldos y dependencias vendor.

### Universal / Multi-contexto

- El perfil deja de estar codificado para una persona concreta.
- El saludo, los prompts de IA, la voz, la moneda y la región usan configuración local.
- Módulos personales migran a arquitectura modular genérica.
- Las clases CSS y los snippets pasan a nombres neutrales del sistema.
- Se elimina la dependencia académica de una universidad concreta.
- La detección de materias se basa en la estructura real de `02 - Universidad` y convenciones de materia.
- Se agregan contextos educativos y laborales activos.
- El panel muestra `Universidad · <contexto>` y `Trabajo · <contexto>` cuando existe un contexto activo.
- Las notas nuevas de Trabajo se guardan en el contexto laboral activo cuando su carpeta existe.
- Se elimina una empresa concreta del clasificador heurístico.
- Finanzas dejan de asumir una moneda concreta; se usa moneda/locale configurables.
- Se agrega una pestaña de configuración `Perfil y contextos`.
- Se agrega instalador universal para bóveda existente o nueva.
- El instalador migra datos locales desde versiones anteriores, renombra plugins, snippets y estados de workspace.
- Se agrega comprobación opcional de IA y modelos.
- El instalador puede limpiar `.obsidian` anidados creados por versiones antiguas, únicamente durante una migración legado y después de respaldarlos.
- El repositorio se reorganiza para que cualquier persona pueda instalar el sistema sin recibir datos privados del autor.

## 4.5.4 - 2026-09-03

- Limpieza final posterior a la validación real del Agente de acciones.
- Las notas creadas por el asistente eliminan prefijos conversacionales como `Guarda esta idea:`, `Anota:` o `Nota:` antes de almacenar el contenido.
- Migra notas creadas previamente y limpia únicamente su primera línea cuando contiene uno de esos prefijos.
- Retira `01 - Hoy/Recordatorios.md` únicamente si corresponde al archivo legado vacío; si contiene tareas o información, se conserva.
- Mantiene como archivo oficial `01 - Hoy/Recordatorios/Recordatorios.md`.
- Conserva las correcciones V4.5.3 de proyectos, tareas, fechas y recordatorios enlazados.

## 4.5.3 - 2026-09-03

- Corrige la creación de proyectos detectada en la validación real: las tareas ya no pueden guardarse como `[object Object]`.
- Normaliza tareas devueltas por el motor de IA aunque lleguen como objetos (`task`, `text`, `title`, `content`, etc.).
- Las órdenes explícitas `Crea un proyecto... con tareas...` se procesan de forma determinística antes de la IA.
- Extrae varias tareas separadas por comas y por `y` cuando inicia otra acción.
- Detecta fechas naturales del proyecto (por ejemplo `sábado`) y las agrega a `Fechas`, con recordatorio enlazado.
- Elimina automáticamente únicamente el artefacto inválido exacto `- [ ] [object Object]` creado por la versión anterior.
- Evita duplicar una tarea idéntica al volver a ejecutar una orden.
- Mejora la comparación de títulos redundantes cuando el H1 comienza con un icono o emoji.

## 4.5.2 - 2026-09-03

- Corrige la intención **“Recuérdame…”** para que nunca se convierta en una nota de Inbox.
- Si no se indica fecha, el recordatorio se agenda para **hoy** en vez de pedir configuración adicional.
- Si la orden menciona claramente un proyecto o nota existente, el asistente agrega también la acción como tarea en ese destino y enlaza el recordatorio.
- Las intenciones inequívocas de recordatorio se resuelven por código antes de consultar a la IA, evitando clasificaciones erróneas.
- Los recordatorios iguales no se duplican.
- Mejora el texto de confirmación para distinguir recordatorios de hoy.

## 4.5.1 - 2026-09-03

- Corrige la validación del paquete de actualización V4.5.0 en Windows.
- La validación usa PowerShell en lugar de `findstr` para archivos JavaScript grandes.
- El BAT del instalador ahora devuelve correctamente el código de salida de PowerShell.
- Conserva todas las funciones del Agente de acciones V4.5.0.
- Puede completar de forma segura una instalación V4.5.0 que quedó parcialmente copiada en el repositorio local.

## 4.5.0 - 2026-09-03

- Nuevo **Agente de acciones** para órdenes naturales dentro del sistema.
- Clasificación automática de notas entre Inbox, Trabajo, Proyectos, Conocimiento y Personal.
- Detección de materias existentes para guardar apuntes directamente en Universidad.
- Si existe una nota o proyecto claramente relacionado, el asistente intenta **agregar la información allí** antes de crear otro archivo.
- Creación y actualización de proyectos con extracción de tareas.
- Alta directa de tareas y recordatorios cuando la intención y la fecha son claras.
- Fechas naturales ampliadas: hoy, mañana, pasado mañana, días de la semana y “en N días”.
- El planificador IA solo devuelve acciones de una lista blanca; las rutas se validan contra archivos y materias reales.
- Borrado, renombrado y movimientos masivos siguen bloqueados sin confirmación.
- Finanzas mantienen confirmación explícita para evitar registrar montos incorrectos.
- En móvil se conserva un clasificador heurístico para acciones básicas; la planificación avanzada se ejecuta con IA.

## 4.4.1 - 2026-09-03

- V4.4 validada visualmente por el usuario.
- Reorganización del repositorio existente `FernandoZL/obsidian` para que sea legible y mantenible.
- `OBSIDIAN_ADMIN.bat` pasa a ser el administrador único de Git/GitHub.
- Instalador convertido en paquete autocontenido (`installer/payload`).
- Añadidos `styles.css`, JSZip, PDF.js y licencias al procesador local para soportar instalaciones limpias.
- Auditoría Git reforzada para evitar subir datos de la bóveda o documentos personales.
- Generador de release integrado.

## 4.4.0 - 2026-09-03

- Buscador global rediseñado como panel flotante compacto.
- Máximo de 6 resultados visibles en escritorio y 5 en móvil.
- Ajustes responsive para móvil.
- Búsqueda por título, carpeta y contenido.

## 4.3.0 - 2026-09-03

- Buscador global inicial.
- Limpieza segura del H1 interno cuando repite el nombre del archivo.
- Se conserva el título inline de Obsidian.

## 4.1.x - 4.2.x

- Ocultación visual de identificadores internos de estudio.
- Reducción de textos repetidos en pendientes.
- Correcciones de títulos duplicados.

## 4.0.x

- Estudio automático multimateria.
- Física 2 deja de estar fija o privilegiada.
- Plan automático de 7 días.
- Integración de documentos resumidos con la materia detectada.

## 3.3 y anteriores

- Centro de control, finanzas, recordatorios, IA local y primeras herramientas Git.
