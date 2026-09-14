# IA de bóveda — Guía de uso

El complemento **IA de bóveda** procesa documentos y asiste en tus notas utilizando **Google Gemini** (recomendado para máxima velocidad, gran contexto y soporte móvil) u **Ollama** (para ejecución 100% local y offline en PC).

## Proveedores de IA

### 1. Google Gemini (Recomendado)
- **Velocidad inmediata:** Respuestas en pocos segundos.
- **Contexto masivo:** Maneja ventanas de más de 1 millón de tokens (libros completos, PDFs largos, código).
- **Soporte Móvil Nativo:** Funciona directamente en iPhone y iPad sin necesidad de tener encendida la PC.
- **Configuración:**
  1. Obtén tu API Key gratuita en [Google AI Studio](https://aistudio.google.com/).
  2. En Obsidian, ve a **Ajustes > IA de bóveda**.
  3. Selecciona **Google Gemini** e introduce tu clave.
  4. Modelo recomendado: `gemini-2.0-flash`.

### 2. Ollama Local (Offline en PC)
- **Privacidad 100% offline:** El modelo corre en tu propio hardware sin conexión a internet.
- **Configuración:**
  1. Instala Ollama en tu PC y descarga el modelo:
     ```bat
     ollama pull llama3.2
     ```
  2. En Obsidian, ve a **Ajustes > IA de bóveda**.
  3. Selecciona **Ollama Local** e indica el modelo (`llama3.2`).

## Funciones principales

- **Resumen automático de documentos:** Extrae texto y genera síntesis estructuradas de archivos PDF, DOCX, PPTX, XLSX y texto plano.
- **Fichas de archivos no textuales:** Registra enlaces y fichas organizativas para imágenes, audios o archivos comprimidos.
- **Sugerencias y apoyo para notas:** Analiza la nota en pantalla y propone secciones faltantes, enlaces hacia otras notas y recordatorios.
- **Clasificación académica automática:** Asocia lecturas y documentos a las materias correspondientes de tu universidad.

## Procesamiento automático

Al agregar un archivo a la bóveda:
1. El sistema detecta el archivo nuevo.
2. Extrae el texto legible.
3. La IA genera un resumen estructurado (Resumen, Puntos importantes, Cifras, Tareas).
4. El resumen se guarda en `07 - Recursos/01 - Resumenes automaticos`.
5. Si pertenece a una materia académica, se conecta con tu plan de estudio.

[[Inicio|Volver a Inicio]]
