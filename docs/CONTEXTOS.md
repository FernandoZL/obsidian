# Contextos múltiples

## Trabajo

`activeWorkContext` representa el contexto laboral principal del momento. Puede ser:

- empresa;
- cliente;
- freelance;
- negocio propio;
- práctica profesional.

Jarvis crea:

```text
03 - Trabajo/<contexto>/<contexto> - Inicio.md
```

No mueve automáticamente información laboral antigua. Esto evita romper enlaces o clasificar mal contenido histórico.

## Universidad / educación

`activeEducationContext` representa la institución que se quiere priorizar visualmente.

Jarvis puede detectar materias de varias instituciones a la vez. El plan de estudio da una bonificación de prioridad a la institución activa, pero las demás no desaparecen.

## Cambio de contexto

Cambiar un contexto activo:

- no borra el anterior;
- no mueve archivos en masa;
- no modifica proyectos históricos;
- afecta saludo visual, rutas nuevas de Trabajo y priorización.

## Proyectos transversales

Un proyecto puede pertenecer a Trabajo, Universidad o Personal. V4.6 mantiene `04 - Proyectos` como área transversal para no imponer una jerarquía única.

## Órdenes naturales entre contextos

Jarvis puede distinguir contextos que ya existan en la bóveda. Ejemplos:

```text
Guarda para Empresa A que el servidor necesita revisión
Guarda para Cliente B que falta aprobar el presupuesto
Guarda en Academia de idiomas que el horario cambió
Crea un proyecto de trabajo llamado Migrar ERP con tareas hacer backup y probar conexión
```

Cuando se menciona explícitamente un contexto existente, Jarvis lo prioriza sobre el contexto activo. Si no se menciona ninguno, usa el contexto activo cuando corresponde.

Los proyectos permanecen en `04 - Proyectos` porque pueden ser transversales, pero los nuevos proyectos pueden guardar metadatos de contexto laboral o educativo para mantener la relación sin imponer una estructura física única.
## Contextos visibles

Los contextos activos se muestran como indicadores en el Centro de control. Cambiar el contexto activo no elimina ni archiva los anteriores.

