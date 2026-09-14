# Modo móvil e IA en Celular y Tablet (iPhone, iPad y Android)

La experiencia móvil está optimizada para que tengas toda la potencia de tu bóveda y de **Google Gemini** en la palma de tu mano, sin depender de tener tu computadora encendida.

---

## 1. ¿Cómo funciona la IA en móvil?

A diferencia de las versiones anteriores que dependían exclusivamente de servidores locales (Ollama), la versión **4.7.0** integra la **API de Google Gemini**:

- **Conexión en la nube directa:** Obsidian en tu iPhone, iPad o teléfono Android se comunica de forma cifrada mediante HTTPS directamente con Google Gemini.
- **Sin computadora encendida:** Puedes interactuar con la IA, resumir notas, crear proyectos y hacer preguntas desde cualquier lugar con conexión a internet.
- **Cero consumo excesivo de batería:** El procesamiento neuronal ocurre en los servidores de Google, por lo que tu dispositivo móvil se mantiene rápido y ligero.

---

## 2. Pantalla de inicio móvil (`Inicio`)

Al abrir Obsidian en tu celular o tableta, verás una interfaz dedicada diseñada para dedos, teclados móviles y pantallas táctiles:

### Botones de acción rápida:
1. **✨ Asistente IA:** Abre el agente personal conversacional con Google Gemini.
   - Pregúntale cosas como: *"Organiza mi día"*, *"¿Qué tengo de pendientes?"*, *"Crea un proyecto llamado Examen Final con tareas repasar temas 1 al 4"*, o *"Explícame el concepto de polimorfismo según mis apuntes"*.
   - Compatible con dictado por voz del teclado de iOS y Android.
2. **✍️ Nota:** Captura rápida de ideas asignando área inmediata (`Inbox`, `Universidad`, `Trabajo`, `Proyectos`, `Personal`).
3. **📅 Mi día:** Registro de pensamientos, logros y actividades del día.
4. **💰 Dinero:** Registro al instante de ingresos, gastos, ahorros o pagos de cuotas.
5. **⏰ Recordar:** Creación de recordatorios con fechas relativas (*"mañana"*, *"el viernes"*, *"en 3 días"*).
6. **📥 Inbox:** Acceso directo a las notas pendientes de clasificar.

### Búsqueda y explorador con filtros:
- Buscador instantáneo con teclado optimizado.
- Filtros por área (`Universidad`, `Trabajo`, `Proyectos`, etc.).
- Filtros por tipo de contenido (`Notas`, `Documentos`, `Imágenes`, `Pendientes`).

---

## 3. Dock Flotante Inteligente y Tabla de Herramientas IA & Notas (PC, iPad, iPhone, Android)

Al abrir cualquier nota, dispones de una **Cápsula Flotante Inteligente** (`✨ Asistente IA`) diseñada para mejorar tu productividad sin estorbar:

- **Nunca tapa el contenido ni las funciones:**
  - El editor tiene un margen inferior de seguridad (`padding-bottom`) que permite scrollear el final de la nota holgadamente por encima del dock.
  - **Modo escritura inteligente:** Al escribir o activar el teclado en móvil, el dock se atenúa automáticamente para no tapar el teclado ni la barra de formato nativa de Obsidian.
  - **Minimizable:** Con un toque en el botón `—`, se colapsa a una burbuja mínima `✨` en la esquina para lectura sin distracciones.

### Tabla de Herramientas de IA para la Nota Activa (al pulsar la cápsula):
1. **`📝 Resumir`:** Genera un resumen ejecutivo estructurado (Idea central, Puntos clave y Conclusiones) con botón para **Insertar al final de la nota** o **Copiar**.
2. **`⚡ Mejorar texto`:** Pule la redacción, corrige ortografía y mejora la claridad sin alterar el significado (permite reemplazar la selección o la nota completa).
3. **`✅ Extraer tareas`:** Identifica compromisos y pendientes y genera una lista de verificación Markdown `- [ ]`.
4. **`❓ Repaso / Examen`:** Crea preguntas clave de estudio tipo flashcards con sus respuestas.
5. **`💡 Explicar`:** Desglosa conceptos complejos con analogías y pasos didácticos.
6. **`💬 Chat IA`:** Abre el agente conversacional con el contenido completo de la nota precargado como contexto.
7. **Caja de consulta rápida:** Escribe cualquier orden libre (*"traduce esto"*, *"haz una tabla comparativa"*, etc.) y Gemini la procesará al instante.
8. **Acciones de navegación:** Acceso directo a `🏠 Inicio`, `✍️ Nota rápida`, `📅 Mi día` y `⏰ Recordatorio`.

---

## 4. Cómo sincronizar con tu iPhone / iPad / Android

### Opción A: iCloud Drive (Recomendado para Apple / iPhone / iPad / Mac / PC)
1. En tu PC, instala la bóveda en tu carpeta de sincronización de iCloud (el instalador `INSTALAR.bat` la detectará automáticamente).
2. En tu iPhone o iPad, abre la app de Obsidian.
3. Selecciona **"Abrir carpeta existente como bóveda"** y selecciona tu carpeta de Obsidian en iCloud.
4. Toda la configuración, plugins (`control-center`, `vault-ai`, `mobile-ui`) y tu configuración de Google Gemini se sincronizan automáticamente.

### Opción B: Obsidian Sync (Multiplataforma: Windows, Mac, iOS, Android)
1. Activa Obsidian Sync en los ajustes de tu bóveda en la PC.
2. En las opciones de sincronización, asegúrate de activar:
   - **Sincronizar archivos de configuración principal**
   - **Sincronizar complementos de la comunidad**
   - **Sincronizar temas y fragmentos CSS**
3. En tu teléfono o tableta, abre Obsidian y conéctate a la bóveda sincronizada.
