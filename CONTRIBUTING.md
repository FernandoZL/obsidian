# Contribuir

Trabaja en una rama corta creada desde `main`. Describe el problema y los pasos para reproducirlo sin adjuntar notas privadas, claves o conversaciones completas.

```powershell
npm ci
npm test
npm run check
npm run release
```

Conserva la compatibilidad móvil: el inicio del complemento solo debe importar la API de Obsidian y JavaScript portable. Carga módulos Node únicamente en operaciones de escritorio. Mantén las notas en Markdown y evita reemplazar propiedades o contenido ajeno a una edición solicitada.

Para una entrega, actualiza juntos `VERSION`, `package.json`, `package-lock.json` y `obsidian-plugin/manifest.json`, además de las instrucciones pertinentes. Genera los ZIP, comprueba una instalación con perfil temporal y publica los artefactos de `release/`. No incluyas esa carpeta generada en Git.

Integra solo con comprobaciones aprobadas. Después de subir a `main`, elimina las ramas ya integradas; conserva cualquier rama con trabajo pendiente.
