# Jarvis Local AI — Guía

Jarvis Local AI usa Ollama en una computadora para procesar documentos de la bóveda sin depender de una API de pago.

## Funciones

- resumir PDF con texto;
- leer DOCX;
- leer PPTX;
- leer XLSX;
- resumir archivos de texto;
- crear fichas para imágenes, audio, video y archivos comprimidos;
- sugerir apoyo para notas;
- clasificar documentos contra materias reales.

## Ollama

Compruebe:

```bat
ollama --version
ollama list
```

Modelo recomendado inicialmente:

```bat
ollama pull llama3.2
```

El modelo se puede cambiar desde Configuración.

## Procesamiento automático

Cuando aparece un archivo nuevo:

1. Jarvis detecta el archivo.
2. Extrae texto si el formato lo permite.
3. Ollama crea un resumen fiel.
4. El resumen se guarda en `07 - Recursos/01 - Resumenes automaticos`.
5. Si corresponde a una materia detectada, se informa al plan automático.

## Multiinstitución

La clasificación académica no contiene una universidad fija. Jarvis obtiene la lista de materias desde la bóveda real.

## Móvil

La IA local no se ejecuta en móvil. Los resúmenes ya guardados sí se pueden consultar desde cualquier dispositivo sincronizado.

## Privacidad

El documento se procesa mediante el Ollama local configurado. Revise siempre fechas, cifras y decisiones importantes.

[[Inicio|Volver a Inicio]]
