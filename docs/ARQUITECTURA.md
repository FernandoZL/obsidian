# Arquitectura

src/memory contiene persistencia Markdown, búsqueda, filtros, títulos y migración. src/adapters normaliza los formatos de sesión. El importador mantiene puntos de avance ligados a una bóveda y huellas de la región consumida para detectar reescrituras del mismo tamaño. Las escrituras fallidas no adelantan el punto de avance.

Las notas conservan ID en metadatos y nombres legibles. La deduplicación sobrevive a renombrados. Bloqueos locales serializan escrituras. Índices y bloqueos quedan fuera de iCloud.

obsidian-plugin contiene interfaz, proveedores y grafo. Esbuild produce un único archivo; el inicio móvil solo carga la API Obsidian y JavaScript portable. Node se inicializa únicamente en operaciones de escritorio. vendor/obsidian conserva complementos reutilizados y sus licencias.

El mapa muestra pertenencia a proyecto y origen de IA, no semejanza semántica inferida. Las sesiones son extractos, no resúmenes inteligentes ni hechos confirmados.

Los proveedores usan requestUrl: Gemini generateContent, Anthropic Messages, OpenAI Chat Completions compatible y Ollama Chat. Se envían pregunta, historial reciente acotado y hasta 3200 caracteres de referencias. No hay generaciones automáticas al iniciar ni reintentos de pago.

La tarea Windows captura cada minuto con privilegios limitados y ventana oculta. El manifiesto registra intención antes de modificar archivos. Reinstalación y desinstalación conservan archivos modificados posteriormente; puede ser necesario retirar conectores manualmente de esos archivos.

Los filtros de credenciales no garantizan detectar todo secreto arbitrario. Las claves de proveedor se guardan en ajustes sincronizados del complemento. No se publican notas en GitHub ni Graphify Cloud.
