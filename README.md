# Obsidian — sistema personal

Sistema local y portable para convertir una bóveda de Obsidian en un centro personal de organización, estudio, trabajo, proyectos, conocimiento, finanzas, recordatorios y procesamiento de documentos con IA local opcional.

**Versión:** `4.6.8`

## Qué incluye V4.6.8

- Perfil local configurable por instalación.
- Multiempresa / multicliente.
- Multiuniversidad / multiinstitución.
- Multimoneda y multirregión.
- Centro de control para escritorio.
- Modo móvil orientado a captura, lectura, escritura, búsqueda y filtros.
- Plan de estudio automático multimateria.
- Registro diario, recordatorios, finanzas y clasificación de contenido.
- IA local opcional con Ollama en escritorio.
- Instalador universal para una bóveda existente o una bóveda nueva.
- Migración segura desde versiones anteriores, conservando notas, documentos y datos locales.
- Corrección de codificación visible y ajustes de safe-area en iPhone.
- Identidad visible neutral: la interfaz no depende de un nombre propio.

## Filosofía

El repositorio contiene el motor, instaladores y documentación. Cada persona conserva su información en una bóveda privada.

```text
Repositorio
├─ código
├─ instaladores
├─ documentación
└─ componentes del sistema

Bóveda privada
├─ notas
├─ universidad / educación
├─ trabajo / empresas
├─ proyectos
├─ finanzas
├─ documentos
└─ preferencias locales
```

## Áreas base

```text
00 - Inbox
01 - Hoy
02 - Universidad
03 - Trabajo
04 - Proyectos
05 - Conocimiento
06 - Personal
07 - Recursos
08 - Plantillas
90 - Archivo
```

Las áreas son generales y cada persona puede adaptarlas a sus instituciones, empresas, clientes, proyectos y necesidades reales.

## Componentes visibles

### Centro de control

Disponible en escritorio.

- Buscador global.
- Acciones rápidas.
- Notas, tareas y recordatorios.
- Contextos activos de trabajo y educación.
- Finanzas locales.
- Estudio automático multimateria y multiinstitución.

### IA local

Complemento de escritorio para Ollama.

- Resumen de PDF, DOCX, PPTX, XLSX y texto.
- Fichas de archivos no textuales.
- Clasificación académica contra materias reales.
- Apoyo contextual para notas.
- Integración con planes de estudio.

### Modo móvil

Orientado a iPhone y otros dispositivos móviles.

- Captura rápida.
- Lectura de toda la bóveda.
- Escritura y formularios adaptados al teclado.
- Búsqueda y filtros.
- Navegación con espacio inferior para no ocultar el último elemento bajo la barra nativa.

## Instalación rápida

### Windows

1. Instalar Obsidian.
2. Abrir Obsidian al menos una vez.
3. Clonar el repositorio:

```bat
git clone https://github.com/FernandoZL/obsidian.git
```

4. Entrar a la carpeta descargada.
5. Ejecutar:

```text
INSTALAR_OBSIDIAN_UNIVERSAL_V468.bat
```

6. Elegir una bóveda existente o crear una nueva.
7. Completar el perfil local.
8. Instalar Ollama únicamente si se desea IA local.

## Actualizar una instalación existente

Desde una copia actualizada del repositorio puede volver a ejecutar:

```text
INSTALAR_OBSIDIAN_UNIVERSAL_V468.bat
```

El instalador conserva notas y documentos personales y actualiza únicamente los componentes técnicos requeridos.

## Privacidad

El perfil, rutas procesadas, recordatorios, documentos y configuración individual se guardan en la bóveda o en archivos locales excluidos de Git.

No se deben subir al repositorio:

- `data.json`
- `workspace.json`
- `workspace-mobile.json`
- notas personales
- instituciones educativas reales del usuario
- empresas o clientes reales del usuario
- PDFs, Word, Excel o PowerPoint personales
- movimientos financieros
- respaldos de la bóveda

## Desarrollo y Git

`OBSIDIAN_ADMIN.bat` administra el repositorio en Windows: auditoría, commit, push, actualización, release e instalación.

Repositorio oficial:

```text
FernandoZL/obsidian
```

## Validación

Para validar una instalación nueva puede ejecutar:

```text
VALIDAR_INSTALADOR_UNIVERSAL_V468.bat
```

y, para pruebas aisladas:

```text
PROBAR_INSTALACION_LIMPIA_V468.bat
VALIDAR_BOVEDA_PRUEBA_V468.bat
```

## Ollama

Modelo recomendado inicialmente:

```bat
ollama pull llama3.2
```

La IA local es opcional; las funciones que no dependen de IA continúan disponibles sin Ollama.

## Licencia

Distribuido bajo licencia MIT. Consulte `LICENSE`.
