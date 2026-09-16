# 🧠 Obsidian AI Workspace (v4.7.0)

> Sistema inteligente y portable para convertir tu bóveda de **Obsidian** en un segundo cerebro personal con **Google Gemini**, Centro de Control, finanzas, notas y sincronización nativa entre **PC, iPhone, iPad y Android**.

---

## ⚡ Instalación Rápida (3 Pasos)

### Paso 1: Descarga el proyecto en tu Escritorio
Abre tu terminal (**PowerShell**) y ejecuta:

```powershell
cd $HOME\Desktop
git clone https://github.com/FernandoZL/obsidian.git
cd obsidian
```

> [!TIP]
> **¿Por qué clonar en el Escritorio y no dentro de iCloud?**
> Clona este código de instalación en tu **Escritorio** o **Documentos** locales. **No lo descargues dentro de la carpeta iCloudDrive**, ya que iCloud intentaría sincronizar miles de archivos internos de Git con la nube. El propio instalador se encargará de crear tu **bóveda limpia dentro de iCloud** sin saturar tu almacenamiento.

---

### Paso 2: Ejecuta el instalador
En la misma ventana de PowerShell escribe:

```powershell
.\INSTALAR.bat
```
*(O haz doble clic sobre el archivo **`INSTALAR.bat`** en la carpeta `obsidian` del Escritorio).*

---

### Paso 3: Responde las preguntas en pantalla

El instalador te guiará con ejemplos directos:

#### 🖥️ Ejemplo exacto de lo que verás en tu pantalla:

```text
============================================================
          PASO 1: ¿DONDE DESEAS GUARDAR TU BOVEDA?
============================================================
Elige donde se creara tu espacio de notas y documentos:

 [1] iCloud Drive (Recomendado para sincronizar con iPhone / iPad)
     -> Ruta: C:\Users\...\iCloudDrive\iCloud~md~obsidian\Obsidian
 [2] Documentos (Carpeta local en esta PC)
     -> Ruta: C:\Users\...\Documents\Obsidian Vault
 [3] Escribir otra ruta personalizada

💡 EJEMPLOS DE SELECCION:
   - Si usas iPhone o iPad: Presiona '1' (o solo presiona Enter).
   - Si solo usas PC: Presiona '2' para guardarlo en tu carpeta Documentos.

Tu seleccion [1-3] (Presiona Enter para [1]): 1
============================================================
[OK] Boveda seleccionada.

============================================================
          PASO 2: PERSONALIZACION BASICA
============================================================
1. Nombre para el saludo de bienvenida:
   💡 EJEMPLO: Escribe tu nombre (ej. 'Alex') o presiona Enter para usar 'Usuario'.
   Tu nombre [Usuario]: Alex

2. Moneda local para finanzas:
   💡 EJEMPLO: Presiona Enter para usar la detectada (USD), o escribe 'USD', 'EUR', 'MXN'.
   Codigo de moneda [USD]: [Presiona Enter]
   Simbolo [$] (Ejemplos: $, Q, €): [Presiona Enter]

3. Universidad y Empresa (Opcionales):
   💡 EJEMPLO: Solo presiona ENTER para omitir si prefieres no configurarlos ahora.
   Universidad / centro de estudios [Enter para omitir]: [Presiona Enter]
   Empresa / trabajo activo [Enter para omitir]: [Presiona Enter]

============================================================
          PASO 3: INTELIGENCIA ARTIFICIAL (GOOGLE GEMINI)
============================================================
Permite resumir notas, analizar PDFs y conectar ideas.
Clave gratuita disponible en: https://aistudio.google.com/app/apikey

💡 EJEMPLOS:
   - Si ya tienes tu clave: Pegala aqui (ejemplo: AIzaSy...)
   - Si NO tienes clave aun: Solo presiona ENTER para omitir.
     (Podras configurarla cuando quieras en Obsidian > Ajustes > IA de boveda).

Pega tu Gemini API Key [Presiona Enter para omitir]: AIzaSy...

============================================================
[OK] ¡Instalacion completada exitosamente!
============================================================
```

---

### Paso 4: Activa tus complementos favoritos (PC y Móvil)

Para que tu bóveda cargue a la velocidad de la luz y no se congele en iCloud, el instalador te entrega una versión súper optimizada. Una vez que estés dentro de Obsidian, tú decides qué más encender:

1. **En PC o Mac:** Ve a **Ajustes ⚙️ > Plugins de la comunidad** y verifica que tus complementos estén activos. Si necesitas cosas extra (como un Calendario o Pizarra virtual), puedes descargarlas gratis desde "Explorar".
2. **En Celular o iPad:** Ve a **Ajustes ⚙️ > Plugins de la comunidad > Apaga el "Modo Seguro"**. Luego enciende *Vault AI* y *Centro de Control*. *(¡No olvides ir a la sección de **Apariencia** y encender los Fragmentos CSS para que se vea igual de bonito!)*

---

## 📱 ¿Cómo usarlo en tu iPhone / iPad?

Si en el **Paso 1** elegiste la opción **`[1] iCloud Drive`**:

1. En tu iPhone o iPad, descarga **Obsidian** desde la App Store.
2. Abre la app en tu teléfono y selecciona **"Abrir carpeta existente como bóveda"**.
3. Elige la carpeta **`Obsidian`** que aparece dentro de tu **iCloud Drive**.
4. **¡Listo!** Tendrás tu Centro de Control, tus notas y tu asistente de IA sincronizados automáticamente.

> [!IMPORTANT]
> **Notas cruciales para usuarios de iPad/iPhone:**
> 1. **Modo Seguro:** Apple desactiva los plugins por defecto. Para que funcione el Centro de Control y la IA, debes ir a Configuración ⚙️ > **Plugins de la comunidad** > y desactivar el **"Modo seguro"**.
> 2. **Sincronización:** Deja abierta la app "Archivos" de tu iPad un par de minutos la primera vez para asegurar que iCloud descargue la configuración y tu llave de Inteligencia Artificial al 100%.
> 3. **Cuelgues en Windows por iCloud:** Para evitar que la app de iCloud de Windows se congele sincronizando, el instalador viene optimizado de fábrica (solo activa los 5 plugins más ligeros y rápidos). Si quieres usar los plugins pesados como Excalidraw, puedes encenderlos manualmente desde los Ajustes de Obsidian una vez que tu bóveda ya haya cargado exitosamente.

---

## 🧭 ¿Qué opción elegir según tu caso?

| Tu objetivo | Qué hacer en el Instalador |
| :--- | :--- |
| 📱 **Quiero usar Obsidian en mi iPhone y mi PC** | Selecciona la opción **`1`** (iCloud Drive). Todo se sincronizará automáticamente. |
| 💻 **Solo quiero usar Obsidian en mi computadora** | Selecciona la opción **`2`** (Documentos local). Todo se guardará en tu PC. |
| 🔑 **No tengo una clave de Gemini todavía** | Presiona **Enter** en el Paso 3. Puedes usar Obsidian normalmente y añadir tu clave más tarde. |

---

## 🦙 ¿Cómo instalar Ollama para IA Local (100% Offline)?

Si deseas usar inteligencia artificial en tu PC **sin conexión a internet** y con total privacidad:

1. **Descarga Ollama:** Descarga e instala el programa gratuito para Windows desde [ollama.com/download](https://ollama.com/download).
2. **Descarga el modelo:** Abre tu terminal y ejecuta:
   ```powershell
   ollama pull llama3.2
   ```
3. **Actívalo en Obsidian:** Ve a **Ajustes ⚙️ > IA de bóveda**, cambia el proveedor a **Ollama (Local)** y ¡listo!

*(Para ver más modelos como DeepSeek o Qwen y cómo configurarlos, consulta la [Guía de Ollama](docs/OLLAMA.md)).*

---

## ✨ ¿Qué incluye la Suite Pro (12 Complementos Integrados)?

### 🤖 Motores de Productividad e Inteligencia:
* 🤖 **Asistente de IA (Google Gemini + Ollama):**
  * Procesamiento ultrarrápido en la nube con modelos de última generación (`gemini-3.5-flash-lite`).
  * Resumen profundo de notas y PDFs directamente en PC y móvil.
  * Respaldo local sin conexión opcional con Ollama (`llama3.2`).
* 📊 **Centro de Control:**
  * Tablero interactivo con agenda diaria, pendientes, materias o proyectos y finanzas personales.
* 📱 **Modo Móvil Nativo:**
  * Interfaz optimizada para pantallas táctiles de iPhone y Android con navegación fluida y dock flotante.

### 🛠️ Complementos Esenciales Incluidos de Fábrica:
* 📊 **Dataview:** Transforma tus notas en potentes bases de datos dinámicas con consultas y tablas.
* 📝 **Editing Toolbar:** Barra de formato visual flotante (negrita, colores, tablas, listas) estilo Word/Notion para PC y móvil.
* 🎨 **Style Settings:** Panel visual para calibrar colores, tarjetas, tipografías y bordes sin tocar código CSS.
* 🍎 **Tema y Estilos Apple:** Modo claro y oscuro estilizado, tarjetas limpias y conexión visual de notas en grafos.
* 🔒 **100% Privado y Seguro:** Tus notas personales, documentos y finanzas se quedan en tu dispositivo o en tu iCloud personal. **Nunca** se suben a Git.

---

## 📁 Estructura del Repositorio

```text
├── INSTALAR.bat     # El instalador interactivo principal (1 clic)
├── README.md        # Esta guía de uso con ejemplos visuales
├── LICENSE          # Licencia MIT
├── VERSION          # Versión actual del sistema
├── docs/            # Documentación complementaria (IA, móvil, configuración)
├── installer/       # Motor del instalador, complementos y plantillas base
└── tools/           # Utilidades para desarrolladores (auditoría, empaquetado)
```

---

## 📚 Guías Detalladas

* 📖 [Instalación Paso a Paso](docs/INSTALACION.md)
* 📱 [Optimización para Móviles (iOS / Android)](docs/MOVIL.md)
* 🤖 [Configuración de Ollama (IA Local)](docs/OLLAMA.md)
* 🔒 [Seguridad, Datos y Privacidad](docs/SEGURIDAD_Y_DATOS.md)
* 📝 [Historial de Cambios](docs/CHANGELOG.md)

---

## 📄 Licencia

Distribuido bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.


