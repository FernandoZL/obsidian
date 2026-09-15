# 🧠 Obsidian AI Workspace (v4.7.0)

> Sistema inteligente y portable para convertir tu bóveda de **Obsidian** en un segundo cerebro personal con **Google Gemini**, Centro de Control, finanzas, notas y sincronización nativa entre **PC, iPhone, iPad y Android**.

---

## ⚡ Instalación Rápida (1 Minuto)

### 1. Clona el repositorio
Abre tu terminal (**PowerShell** o CMD) y descarga el proyecto en tu **Escritorio** o **Documentos**:

```powershell
cd $HOME\Desktop
git clone https://github.com/FernandoZL/obsidian.git
cd obsidian
```

> [!TIP]
> **¿Por qué clonar en el Escritorio y no en iCloud?**
> Clona el código instalador en tu Escritorio o Documentos locales. No es necesario clonarlo dentro de iCloud; el propio instalador te preguntará si deseas que tu **bóveda final** se cree en **iCloud Drive** para sincronizarse automáticamente con tu iPhone o iPad sin saturar tu nube con archivos temporales de Git.

### 2. Ejecuta el instalador
En la misma terminal ejecuta:
```powershell
.\INSTALAR.bat
```
*(O haz doble clic sobre el archivo **`INSTALAR.bat`** desde el explorador de Windows).*

### 3. Configura en pantalla
El instalador te guiará con preguntas interactivas:
1. **¿Dónde deseas guardar tu bóveda?**
   - `[1] iCloud Drive` *(Recomendado para sincronizar con iPhone / iPad / Mac)*.
   - `[2] Documentos` *(Carpeta local en esta PC)*.
   - `[3] Ruta personalizada` *(Escribe cualquier carpeta de tu preferencia)*.
2. **Tu nombre:** Cómo quieres que te salude el asistente de IA.
3. **Moneda / Región:** Detecta tu país automáticamente (o presiona Enter).
4. **Google Gemini API Key:** Pega tu clave gratuita de [Google AI Studio](https://aistudio.google.com/app/apikey) para activar la IA inmediatamente (puedes omitirlo con Enter y configurarlo después en los ajustes de Obsidian).

¡Y listo! Al terminar, abre **Obsidian** y tu bóveda estará lista para usarse.

---

## 📱 Sincronización con iPhone / iPad / Mac

Si elegiste la opción **`[1] iCloud Drive`**:
1. Descarga e instala **Obsidian** desde la App Store en tu iPhone o iPad.
2. Abre la app y selecciona **"Abrir carpeta como bóveda"** (o busca la carpeta `Obsidian` dentro de tu iCloud Drive).
3. ¡Todo tu centro de control, notas y el asistente de IA estarán sincronizados al instante!

---

## ✨ ¿Qué incluye este sistema?

* 🤖 **Asistente de IA (Google Gemini + Ollama):**
  * Procesamiento ultrarrápido en la nube con modelos de última generación (`gemini-3.5-flash-lite`).
  * Resumen profundo de notas y PDFs directamente en PC y móvil.
  * Respaldo local sin conexión opcional con Ollama (`llama3.2`).
* 📊 **Centro de Control:**
  * Tablero interactivo con agenda, pendientes, materias o proyectos y finanzas personales.
* 📱 **Modo Móvil Nativo:**
  * Interfaz optimizada para pantallas táctiles de iPhone y Android con navegación fluida.
* 🎨 **Tema y Estilos Apple:**
  * Modo claro y oscuro estilizado, tarjetas limpias y conexión visual de notas.
* 🔒 **100% Privado y Seguro:**
  * Tus notas personales, documentos y finanzas se quedan en tu dispositivo o en tu iCloud personal. **Nunca** se suben a Git.

---

## 📁 Estructura del Repositorio

```text
├── INSTALAR.bat     # El instalador interactivo principal (1 clic)
├── README.md        # Esta guía de uso e instrucciones
├── LICENSE          # Licencia MIT
├── VERSION          # Versión actual del sistema
├── docs/            # Documentación complementaria (IA, móvil, configuración)
├── installer/       # Motor del instalador, complementos y plantillas base
└── tools/           # Utilidades para desarrolladores (auditoría, empaquetado)
```

---

## 📚 Documentación Adicional

* 📖 [Guía de Instalación Paso a Paso](docs/INSTALACION.md)
* 📱 [Optimización para Móviles (iOS / Android)](docs/MOVIL.md)
* 🤖 [Configuración de Ollama (IA Local)](docs/OLLAMA.md)
* 🔒 [Seguridad, Datos y Privacidad](docs/SEGURIDAD_Y_DATOS.md)
* 📝 [Historial de Cambios](docs/CHANGELOG.md)

---

## 📄 Licencia

Distribuido bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
