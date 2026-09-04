# Arquitectura de Jarvis V4.6

## Capas

```text
Bóveda privada
│
├─ jarvis-core
│  ├─ interfaz
│  ├─ búsqueda
│  ├─ agente de acciones
│  ├─ recordatorios
│  ├─ finanzas
│  ├─ contextos
│  └─ estudio
│
└─ jarvis-local-ai
   ├─ extracción de documentos
   ├─ Ollama
   ├─ resúmenes
   └─ clasificación académica
```

## Separación entre motor y datos

El código no debe contener nombres de usuario, empresas, universidades, monedas, rutas personales ni proyectos reales.

Los datos de cada instalación viven en:

- la bóveda;
- `.obsidian/plugins/jarvis-core/data.json`;
- `.obsidian/plugins/jarvis-local-ai/data.json`.

Esos `data.json` nunca se versionan.

## Contextos

### Educación

Raíz: `02 - Universidad`.

Una institución es el primer nivel debajo de esa raíz. Jarvis detecta materias por notas típicas de materia (`Tareas`, `Parciales`, `Apuntes`, `Fórmulas`, `Conceptos`, `Ejercicios`) o por una nota con frontmatter `tipo: materia`.

No se exige una cantidad fija de niveles entre institución y materia.

### Trabajo

Raíz: `03 - Trabajo`.

Una instalación puede definir un `activeWorkContext`, por ejemplo una empresa, cliente, negocio o actividad freelance. Jarvis crea su nota de inicio y usa ese contexto para notas laborales nuevas.

### Proyectos

`04 - Proyectos` sigue siendo transversal: un proyecto puede relacionarse con Trabajo, Universidad o Personal mediante enlaces y contexto. V4.6 no mueve automáticamente proyectos existentes.

## Compatibilidad móvil

`jarvis-core` no es desktop-only. `jarvis-local-ai` sí requiere escritorio porque usa acceso local a archivos y Ollama.

## Identificadores universales

- Plugin principal: `jarvis-core`
- IA local: `jarvis-local-ai`
- Vista: `jarvis-core-view`
- CSS: `jarvis-*`
