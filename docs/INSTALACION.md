# Guía de Instalación Universal (PC y Móvil)

Este repositorio contiene la arquitectura completa para transformar Obsidian en un sistema operativo personal con inteligencia artificial multimodal (**Google Gemini** y **Ollama local**), Centro de Control interactivo, finanzas, tareas y sincronización móvil con iPhone / iPad.

---

## 📋 Requisitos previos

1. **Obsidian instalado en tu PC:** Descárgalo gratis desde [obsidian.md](https://obsidian.md).
2. **Abrir Obsidian al menos una vez:** Esto crea la carpeta interna de configuración en tu equipo.
3. *(Opcional)* Clave gratuita de **Google Gemini API** obtenida en [Google AI Studio](https://aistudio.google.com/app/apikey).
4. *(Opcional)* **Ollama** si deseas respaldo local sin conexión en tu PC.

---

## 💻 Paso 1: Clonar y Ejecutar el Instalador

Recomendamos clonar el repositorio en tu **Escritorio** o carpeta de **Documentos** local (evita clonarlo directamente dentro de `iCloudDrive` para no sincronizar innecesariamente los archivos internos de Git con la nube):

```powershell
cd $HOME\Desktop
git clone https://github.com/FernandoZL/obsidian.git
cd obsidian
.\INSTALAR.bat
```

### Lo que hace el instalador interactivo:
1. **Te pregunta dónde guardar tu bóveda:**
   - `[1] iCloud Drive` -> Configura tu bóveda directamente en iCloud para sincronizar en tiempo real con tu iPhone / iPad.
   - `[2] Documentos` -> Configura tu bóveda de forma local en tu computadora.
   - `[3] Ruta personalizada` -> Te permite elegir cualquier otra carpeta.
2. **Personaliza tu entorno:** Nombre para el saludo de bienvenida, moneda y país.
3. **Activa la IA:** Te solicita tu Google Gemini API Key y la vincula de inmediato.
4. **Instala los complementos:**
   - `control-center`: Panel principal, agenda y finanzas.
   - `vault-ai`: Conexión directa a Google Gemini (`gemini-3.5-flash-lite`) y Ollama.
   - `mobile-ui`: Optimización táctil para iPhone / iPad.
5. **Aplica los estilos:** Paleta Apple y conexión visual de notas en el grafo.

---

## 📱 Paso 2: Sincronización en Móvil (iPhone / iPad / Android)

Si en el instalador seleccionaste la opción **`[1] iCloud Drive`**:

1. Abre la app de **Obsidian** en tu iPhone o iPad.
2. Pulsa en **"Abrir carpeta como bóveda"**.
3. Selecciona la carpeta **`Obsidian`** que está en tu iCloud Drive.
4. ¡Listo! Todo tu Centro de Control, tus notas y tu asistente de IA estarán activos y sincronizados al instante.

---

## 🔧 Paso 3: Configurar o Cambiar la API Key más adelante

Si omitiste ingresar tu clave durante la instalación, puedes ponerla cuando quieras:

1. En Obsidian, abre **Ajustes** (ícono de engranaje) $\rightarrow$ **IA de bóveda**.
2. En **Google Gemini API Key**, pega tu clave.
3. El modelo por defecto es `gemini-3.5-flash-lite` (rápido, potente y con gran ventana de contexto).
4. Pulsa **Probar conexión**.
