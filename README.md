# Jarvis para Obsidian

Jarvis es un sistema local y portable para convertir una bóveda de Obsidian en un centro personal de organización, estudio, trabajo, proyectos, conocimiento, finanzas, recordatorios y procesamiento de documentos con IA local.

**Versión:** `4.6.5`

## Qué cambia en V4.6

V4.6 elimina las dependencias funcionales de una persona, empresa, universidad o país concretos.

- Perfil local configurable por instalación.
- Multiempresa / multicliente: `Trabajo` puede tener varios contextos y uno activo.
- Multiuniversidad / multiinstitución: las materias se detectan sin depender de una universidad concreta.
- Multimoneda y multirregión, configuradas por perfil local.
- Apariencia portable: snippets `jarvis-colores` / `jarvis-neuronal` y gráfica por áreas se preservan al actualizar.
- Contextos activos visibles en el Centro de control, sin fijarlos en el código.
- Nombres internos universales: `jarvis-core` y `jarvis-local-ai`.
- Instalador universal para una bóveda existente o una bóveda nueva.
- Migración segura desde V4.5.x, conservando notas, documentos y datos locales.
- Ollama es opcional: Jarvis funciona sin IA local y la habilita cuando Ollama está disponible.
- El repositorio no contiene la bóveda ni datos personales.

## Filosofía

El repositorio contiene el **motor de Jarvis**. Cada persona conserva su información en una bóveda privada.

```text
Repositorio
├─ código
├─ instalador
├─ documentación
└─ plantillas del sistema

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

Jarvis utiliza áreas generales que cualquier persona puede adaptar:

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

Dentro de `02 - Universidad` puede haber múltiples instituciones, programas, periodos y materias. Dentro de `03 - Trabajo` puede haber múltiples empresas, clientes o contextos laborales.

## Ejemplos

```text
02 - Universidad/
├─ Universidad A/
│  └─ Periodo 2026/
│     ├─ Cálculo/
│     └─ Estadística/
└─ Academia de idiomas/
   └─ Inglés/

03 - Trabajo/
├─ Empresa A/
├─ Cliente B/
└─ Freelance/
```

Jarvis no necesita que esos nombres existan de antemano.

## Componentes

### `jarvis-core`

Funciona en escritorio y móvil.

- Centro de control.
- Buscador global.
- Agente de acciones.
- Notas, tareas y recordatorios.
- Contextos activos de trabajo y educación.
- Finanzas locales.
- Estudio automático multimateria y multiinstitución.
- Interfaz responsive.

### `jarvis-local-ai`

Complemento de escritorio para Ollama.

- Resumen de PDF, DOCX, PPTX, XLSX y texto.
- Fichas de archivos no textuales.
- Clasificación académica contra materias reales.
- Apoyo contextual para notas.
- Integración con el plan automático.

## Instalación rápida

### Windows

1. Instalar Obsidian.
2. Abrir Obsidian al menos una vez.
3. Descargar o clonar este repositorio.
4. Ejecutar `INSTALAR_JARVIS.bat`.
5. Elegir una bóveda existente o crear una nueva.
6. Completar el perfil local.
7. Instalar Ollama si desea IA local.

Consulte `docs/INSTALACION.md` y `docs/OLLAMA.md`.

### macOS / Linux

Los plugins no dependen de datos personales, pero el instalador automático V4.6 está orientado a Windows. Consulte `docs/INSTALACION_MANUAL.md` para copiar los plugins y configurar Ollama manualmente.

## Privacidad

El perfil, las rutas procesadas, los recordatorios, los documentos y la configuración individual se guardan en la bóveda y en `data.json`, que está excluido de Git.

No suba al repositorio:

- `data.json`
- `workspace.json`
- notas personales
- Universidad real
- Trabajo real
- PDFs, Word, Excel o PowerPoint
- movimientos financieros
- respaldos de la bóveda

## Desarrollo y Git

`OBSIDIAN_ADMIN.bat` administra el repositorio:

```text
[1] Estado + auditoría
[4] Guardar versión
[5] Subir a GitHub
```

Repositorio oficial del proyecto: `FernandoZL/obsidian-jarvis`.

## Estabilidad de inicio V4.6.5

En Windows, Jarvis mantiene sus archivos técnicos disponibles localmente cuando la bóveda está en un proveedor de archivos en la nube. El validador ya no se limita a revisar `community-plugins.json`: `jarvis-core` genera un heartbeat local cuando su `onload()` se ejecuta realmente.

Al iniciar, el Centro de control usa varios intentos cortos de recuperación en vez de depender de un único temporizador.

Si se necesita una comprobación manual, ejecute `VALIDAR_JARVIS.bat`. V4.6.5 confirma tanto la configuración como la carga real del plugin.

## Validar o reparar Jarvis

Si después de una instalación o actualización Obsidian no carga Jarvis o su apariencia, ejecute:

```text
VALIDAR_JARVIS.bat
```

El validador comprueba y repara la activación de:

- `jarvis-core`
- `jarvis-local-ai`
- `jarvis-colores`
- `jarvis-neuronal`

También elimina referencias de activación antiguas de V4.5.x sin modificar las notas, documentos ni datos personales de la bóveda.

## Licencia

Jarvis se publica bajo la licencia MIT. Consulte `LICENSE`.

## Ollama

Modelo recomendado inicialmente:

```bat
ollama pull llama3.2
```

El modelo se puede cambiar desde la configuración de Jarvis.
