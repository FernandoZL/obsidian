# 🦙 Guía Completa: Inteligencia Artificial Local con Ollama

> **Ollama** te permite ejecutar modelos de inteligencia artificial avanzados directamente en el hardware de tu propia computadora, de forma **100% privada, gratuita y sin necesidad de conexión a internet**.

En este sistema, **Google Gemini** es el motor principal en la nube (ideal para iPhone, iPad y respuestas ultrarrápidas), mientras que **Ollama** funciona como el respaldo local perfecto para tu ordenador cuando no tienes conexión a internet o cuando deseas máxima privacidad para documentos confidenciales.

---

## 📥 Paso 1: Descargar e Instalar Ollama en Windows

1. Ve a la página oficial de descarga:
   🔗 **[https://ollama.com/download](https://ollama.com/download)**
2. Descarga el instalador para **Windows** (`OllamaSetup.exe`).
3. Ejecútalo y pulsa **Install**.
4. Una vez instalado, Ollama se ejecutará silenciosamente en segundo plano (verás el ícono de una pequeña llama en la barra de tareas de Windows, junto al reloj).

---

## 🧠 Paso 2: Descargar un Modelo de Inteligencia Artificial

Abre tu terminal (**PowerShell** o CMD) y escribe el comando para descargar el modelo recomendado:

### Modelo recomendado para uso diario:
```powershell
ollama pull llama3.2
```
* **Tamaño:** ~2.0 GB.
* **Requisitos:** Funciona de forma fluida en cualquier PC o laptop moderna (con 8 GB de RAM o más).
* **Ideal para:** Resumir textos, organizar tareas, responder preguntas y redactar apuntes.

### Otros modelos populares que puedes probar:
* **DeepSeek:** `ollama pull deepseek-r1:7b` (Para razonamiento lógico y programación).
* **Qwen 2.5:** `ollama pull qwen2.5:7b` (Excelente para análisis en español).
* **Mistral:** `ollama pull mistral` (Muy equilibrado y rápido).

---

## ⚙️ Paso 3: Conectar Ollama con Obsidian

Una vez descargado el modelo:

1. Abre **Obsidian**.
2. Ve a **Ajustes ⚙️** (esquina inferior izquierda) $\rightarrow$ **IA de bóveda**.
3. En **Proveedor de IA**, selecciona:
   * **`Ollama (Local)`**
4. En **Modelo local de Ollama**, escribe o selecciona:
   * `llama3.2`
5. Pulsa el botón **"Probar conexión"**.
6. Recibirás una notificación en verde:
   > *"[OK] Conexión exitosa con Ollama local: llama3.2 listo."*

---

## 🔄 ¿Cuándo usar Gemini y cuándo usar Ollama?

| Característica | ☁️ Google Gemini (Cloud) | 💻 Ollama (Local) |
| :--- | :--- | :--- |
| **¿Funciona en iPhone / iPad?** | ✅ Sí, directo y nativo. | ❌ Solo en tu PC local. |
| **¿Requiere Internet?** | Sí (mediante API Key gratuita). | ❌ No, funciona 100% offline. |
| **Velocidad y Contexto** | Ultrarrápido, procesa PDFs gigantes. | Depende de la potencia de tu PC. |
| **Privacidad** | Datos procesados por Google AI. | 100% local, nada sale de tu disco. |

---

## 🛠️ Comandos útiles de Ollama en la Terminal

* **Ver los modelos que tienes instalados:**
  ```powershell
  ollama list
  ```
* **Probar el modelo en la terminal directamente:**
  ```powershell
  ollama run llama3.2
  ```
* **Eliminar un modelo para liberar espacio:**
  ```powershell
  ollama rm llama3.2
  ```
