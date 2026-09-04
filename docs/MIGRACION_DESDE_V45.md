# Migración desde V4.5.x

V4.5.x utilizaba identificadores internos ligados al desarrollo original:

- `fernando-centro-control`
- `fernando-resumen-local`
- snippets `fernando-*`
- detección académica ligada a una estructura concreta.

V4.6 migra a:

- `jarvis-core`
- `jarvis-local-ai`
- snippets `jarvis-*`
- perfil y contextos locales;
- detección académica multiinstitución.

El migrador conserva los `data.json` y actualiza referencias de workspace.

No se suben ni transforman en masa las notas privadas.
## Apariencia

V4.6.3 copia primero los snippets universales, valida que existan y solo después retira los nombres `fernando-*`. También conserva `graph.json` si ya tiene grupos de colores.

