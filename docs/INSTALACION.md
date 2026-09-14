# Instalación universal (PC y Móvil)

Este repositorio contiene la arquitectura completa para transformar Obsidian en un sistema operativo personal con inteligencia artificial multimodal (Google Gemini y Ollama local), agenda inteligente, finanzas, control académico y navegación móvil.

---

## Requisitos previos

- **Obsidian** instalado en tu computadora ([obsidian.md](https://obsidian.md)).
- Haber abierto Obsidian al menos una vez para que cree su archivo de configuración.
- **Windows 10 / 11** con PowerShell.
- *(Opcional)* Clave gratuita de **Google Gemini API** obtenida en [Google AI Studio](https://aistudio.google.com/app/apikey).
- *(Opcional)* **Ollama** si deseas respaldo local sin conexión en tu PC.

---

## Paso 1: Instalación en la PC (Automática)

Simplemente ejecuta con doble clic el archivo principal:

```text
INSTALAR.bat
```

*(También puedes usar `INSTALAR_OBSIDIAN_UNIVERSAL_V468.bat`)*

### Lo que hace el instalador por ti:
1. Detecta automáticamente todas las bóvedas de Obsidian en tu equipo (incluyendo iCloud Drive).
2. Te permite elegir una bóveda existente o crear una nueva limpia.
3. Cierra Obsidian con seguridad para evitar conflictos de archivos.
4. Genera un respaldo preventivo de la configuración existente.
5. Instala los tres complementos centrales:
   - **`control-center`**: Centro de control, buscador global, agenda, finanzas y asistente.
   - **`vault-ai`**: Motor de IA multimodal (Google Gemini `gemini-3.6-flash` y Ollama).
   - **`mobile-ui`**: Interfaz optimizada para móviles con botón de inicio y captura rápida.
6. Copia los snippets visuales (`sistema-colores.css` y `sistema-neuronal.css`).
7. Te solicita tu **Google Gemini API Key** de forma interactiva (puedes presionar Enter si prefieres ingresarla después dentro de Obsidian).
8. Abre Obsidian listo para usar.

---

## Paso 2: Configurar Google Gemini (si no lo hiciste en el instalador)

1. En Obsidian, abre **Ajustes** (icono de engranaje) $\rightarrow$ **IA de bóveda**.
2. Verifica:
   - **Proveedor de IA:** `Google Gemini (Recomendado)`
   - **Google Gemini API Key:** Pega tu clave de Google AI Studio.
   - **Modelo:** `gemini-3.6-flash (Recomendado - Estable y rápido)`
3. Pulsa **"Probar conexión"**. Recibirás una notificación verde:
   > *"Conexión exitosa con Google Gemini: gemini-3.6-flash listo"*

---

## Paso 3: Instalación y uso en Móvil (iPhone, iPad, Android)

Si guardaste o sincronizaste tu bóveda en **iCloud Drive** o mediante **Obsidian Sync**:

1. En tu celular o tableta, abre la app de **Obsidian**.
2. Abre la bóveda sincronizada.
3. ¡Listo! Todos los complementos, temas y tu clave de Google Gemini ya estarán configurados.
4. En la pantalla de inicio móvil verás las 6 acciones rápidas:
   - **✨ Asistente:** Habla con la IA en la nube directamente desde tu móvil.
   - **✍️ Nota:** Captura rápida.
   - **📅 Mi día:** Registro diario con dictado por voz.
   - **💰 Dinero:** Registro de gastos e ingresos.
   - **⏰ Recordar:** Recordatorios con fechas inteligentes.
   - **📥 Inbox:** Bandeja de notas sin clasificar.

Para más detalles sobre la experiencia móvil, consulta [docs/MOVIL.md](MOVIL.md).

---

## Actualización y mantenimiento

- Para actualizar la bóveda en el futuro conservando todas tus notas y configuraciones, vuelve a ejecutar `INSTALAR.bat`.
- Tus notas, finanzas, tareas y configuraciones personales nunca se sobreescriben ni se eliminan.
