# Ollama y Jarvis

Jarvis funciona sin Ollama. Sin IA local continúan disponibles el Centro de control, búsqueda, notas, tareas, recordatorios y funciones deterministas.

Ollama habilita:

- conversación contextual;
- resumen de documentos;
- apoyo para notas;
- clasificación asistida;
- planes generados con fuentes de la bóveda.

## Modelo recomendado

```bat
ollama pull llama3.2
```

Comprobación:

```bat
ollama --version
ollama list
```

Jarvis consulta el servicio local de Ollama en:

```text
http://127.0.0.1:11434
```

El modelo puede cambiarse desde la configuración de Jarvis.

## Privacidad

Los prompts se envían al servidor local de Ollama. El repositorio no necesita una API de pago.
