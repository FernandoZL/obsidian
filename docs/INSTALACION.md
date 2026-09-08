# Instalación universal en Windows

## Requisitos

- Obsidian instalado.
- Haber abierto Obsidian al menos una vez.
- Windows 10/11 o Windows Server con PowerShell.
- Ollama solo si se desea IA local.

## Instalar

Ejecute:

```text
INSTALAR_OBSIDIAN_UNIVERSAL_V468.bat
```

El instalador:

1. Detecta las bóvedas registradas por Obsidian.
2. Permite seleccionar una existente o crear una nueva.
3. Cierra Obsidian antes de cambiar componentes.
4. Crea un respaldo de configuración.
5. Instala el Centro de control, IA local y modo móvil.
6. Conserva datos locales existentes.
7. Configura nombre, idioma/región, moneda y contextos.
8. Conserva notas y documentos existentes.
9. Comprueba Ollama sin convertirlo en requisito.
10. Abre la bóveda al finalizar.

## Actualizar

Puede volver a ejecutar `INSTALAR_OBSIDIAN_UNIVERSAL_V468.bat`. Los componentes técnicos se actualizan y los datos locales se conservan.

## Validar

Para comprobar el paquete universal:

```text
VALIDAR_INSTALADOR_UNIVERSAL_V468.bat
```

Para validar la activación de una instalación existente:

```text
VALIDAR_OBSIDIAN.bat
```

## Perfil regional

El primer inicio guarda idioma/región y moneda en la configuración local de la bóveda. El repositorio no contiene esos valores personales.

## Móvil

El modo móvil está orientado a captura, lectura, escritura, búsqueda y filtros. En iPhone se consideran teclado, `visualViewport`, safe-area y el espacio de la barra inferior nativa.

La IA local y Ollama se ejecutan en escritorio; las funciones de organización y consulta siguen disponibles en móvil.
