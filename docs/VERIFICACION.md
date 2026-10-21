# Validación de Neuronas 5.3

## Comprobaciones reproducibles

```powershell
npm ci
npm test
npm run check
npm run release
```

La suite cubre persistencia y concurrencia, redacción de credenciales, importación incremental sin duplicados, transcripciones truncadas o reescritas, migración de nombres, recuperación tras fallos, reinstalación y desinstalación respetando cambios del usuario.

También cubre captura local con fechas españolas, conservación de propiedades YAML y texto editado, tareas sin duplicación, red con identificadores únicos y archivos homónimos, actualización por eventos de archivos, arranque móvil sin Node y lectura parcial de notas aún no descargadas.

Las pruebas de instalación usan perfiles temporales: no instalan conectores en las cuentas reales del equipo. Se comprueba que el modo sin conexiones no redirija una instalación previa. El lector ZIP de Windows valida nombres y contenido Unicode de los paquetes.

## Interfaz

`node scripts/preview-workbench.js` genera una vista independiente con datos ficticios. Prueba navegación, tabla/tablero, guardado, búsqueda completa, captura clasificada, conservación de cambios recientes y recuperación de borrador. Se inspeccionan escritorio, contenedor estrecho y teclado simulado con Guardar accesible.

## Límites

No sustituye una prueba física en iOS/Android ni valida todos los proveedores de IA. Se han comprobado conversaciones reales de Antigravity CLI; los importadores también se verifican con fixtures. No se garantiza compatibilidad futura si las aplicaciones cambian sus formatos.

La clasificación usa reglas locales y nombres existentes. Las fechas y tareas se revisan antes de guardar. La estimación de tokens usa caracteres/4, no medición de facturación del proveedor. No se afirma ahorro porcentual.

Los paquetes de distribución se construyen desde una lista de carpetas del programa. Se excluyen configuraciones de bóveda, claves, conversaciones, estados locales y notas personales. Las sumas SHA256 permiten comprobar los ZIP descargados.
