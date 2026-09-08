# IA local con Ollama

Ollama es opcional y se utiliza únicamente en escritorio para funciones de IA local.

## Modelo inicial recomendado

```bat
ollama pull llama3.2
```

## Qué permite

- Resumir documentos compatibles.
- Crear fichas de contenido.
- Apoyar clasificación académica.
- Generar apoyo contextual para notas y planes de estudio.

## Seguridad

El modelo no debe tener acceso directo al sistema de archivos. El código prepara el contexto permitido, valida la respuesta y ejecuta únicamente acciones autorizadas.

Si Ollama no está disponible, las funciones de organización, captura, búsqueda, filtros, recordatorios y finanzas continúan funcionando.
