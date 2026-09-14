# Obsidian — sistema personal

Sistema local y portable para convertir una bóveda de Obsidian en un centro personal de organización, estudio, trabajo, proyectos, conocimiento, finanzas, recordatorios y procesamiento de documentos con IA local opcional.

**Versión:** `4.7.0`

## Qué incluye V4.7.0

- Integración directa con Google Gemini API (Antigravity): procesamiento ultrarrápido, contexto masivo y soporte nativo para móvil (iPhone, iPad) y escritorio.
- Modo de IA híbrido: nube con Google Gemini (gratuito) y respaldo local sin conexión con Ollama.
- Resumen automático de PDFs extensos, Word, presentaciones y notas con gran ventana de contexto.
- Perfil local configurable por instalación (nombre, profesión, moneda, región).
- Multiempresa / multicliente y multiuniversidad / multiinstitución.
- Centro de control para escritorio con agenda, materias, finanzas y asistente contextual.
- Modo móvil optimizado para captura rápida, lectura, búsqueda y navegación fluida en iPhone/iPad.
- Plan de estudio automático multimateria y organizador de acciones asistidas.
- Registro diario, recordatorios inteligentes y clasificación de contenido.
- Instalador universal con migración segura y limpieza automática de residuos anteriores.
- Identidad visual completamente neutral y personalizable.

## Instalación rápida (1 minuto)

1. **Clona o descarga este repositorio:**
   ```bash
   git clone https://github.com/FernandoZL/obsidian.git
   ```
2. **Ejecuta el instalador con doble clic:**
   ```text
   INSTALAR.bat
   ```
3. El instalador detectará tus bóvedas de Obsidian, instalará los complementos y te permitirá ingresar tu **Google Gemini API Key** gratuita de [Google AI Studio](https://aistudio.google.com/app/apikey).
4. Abre Obsidian y ¡listo! Funciona tanto en tu PC como en tu **iPhone, iPad y Android** mediante iCloud o Sync.

Para una guía detallada paso a paso, consulta [docs/INSTALACION.md](docs/INSTALACION.md) y [docs/MOVIL.md](docs/MOVIL.md).

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

### IA de bóveda (Google Gemini y Ollama)

Motor de inteligencia artificial híbrido para escritorio y móvil (iPhone/iPad).

- **Google Gemini API**: procesamiento ultrarrápido en la nube con modelos de última generación (`gemini-3.6-flash`), ventana de contexto de cientos de miles de caracteres, sin requerir servidor local ni ordenador encendido (funciona directo en iPhone/iPad).
- **Ollama**: respaldo local privado y sin conexión (`llama3.2`, `qwen2.5:7b`, etc.) en escritorio.
- Resumen profundo de PDF, DOCX, PPTX, XLSX y notas de texto.
- Clasificación académica automática contra materias reales.
- Apoyo contextual para notas y generación de ideas.
- Asistente integrado en el Centro de control y creador de planes de estudio.

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

## Configuración de IA
 
### Google Gemini (Recomendado)
 
1. Obtén una clave API gratuita en [Google AI Studio](https://aistudio.google.com/).
2. En Obsidian, ve a **Ajustes > IA de bóveda**.
3. Pega tu API Key y pulsa **Probar conexión**.
4. ¡Listo! La IA funcionará tanto en tu PC como en tu iPhone y iPad directamente sin configuraciones complejas.
 
### Ollama (Opcional - Respaldo sin conexión)
 
Si deseas trabajar 100% offline en tu ordenador de escritorio:
 
```bat
ollama pull llama3.2
```
 
En **Ajustes > IA de bóveda**, activa el modo Ollama o déjalo como respaldo cuando no haya conexión a Internet.

## Licencia

Distribuido bajo licencia MIT. Consulte `LICENSE`.
