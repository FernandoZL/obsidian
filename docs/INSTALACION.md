# Instalación universal en Windows

## Requisitos

- Obsidian instalado.
- Haber abierto Obsidian al menos una vez.
- Windows 10/11 o Windows Server con PowerShell.
- Ollama solo si se desea IA local.

## Instalar

Ejecute:

```text
INSTALAR_JARVIS.bat
```

El instalador:

1. Lee las bóvedas registradas por Obsidian.
2. Permite seleccionar una existente o crear una nueva.
3. Cierra Obsidian antes de cambiar plugins.
4. Crea un respaldo de configuración.
5. Instala `jarvis-core` y `jarvis-local-ai`.
6. Migra `data.json` de una instalación Jarvis V4.5.x si existe.
7. Configura nombre, idioma/región, moneda y contextos.
8. Crea solo los archivos base que falten.
9. Conserva todas las notas y documentos existentes.
10. Comprueba Ollama sin convertirlo en requisito.
11. Abre la bóveda.

## Actualizar

Puede volver a ejecutar `INSTALAR_JARVIS.bat`. Los archivos de plugin se actualizan y los `data.json` locales se conservan.

## Migración V4.5.x

La migración cambia identificadores internos antiguos por los universales. Antes se respalda:

- plugins antiguos;
- configuración de Obsidian;
- snippets;
- archivos de workspace;
- archivos legado que deban limpiarse.

No mueve automáticamente Universidad, Trabajo, Proyectos ni documentos.
## Perfil regional

En el primer inicio Jarvis guarda el idioma/región y la moneda en `jarvis-core/data.json`. El repositorio no contiene esos valores personales.

## Validación de activación V4.6.4

El instalador vuelve a leer `community-plugins.json` y `appearance.json` para confirmar que `jarvis-core`, `jarvis-local-ai`, `jarvis-colores` y `jarvis-neuronal` estén realmente habilitados.

La comprobación se repite después de abrir Obsidian para detectar restauraciones tardías de configuración en bóvedas sincronizadas.

Si una actualización deja los plugins o snippets deshabilitados, también puede ejecutarse:

```text
VALIDAR_JARVIS.bat
```
