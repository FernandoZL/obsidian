# Funcionamiento de Jarvis

## Agente de acciones

La orden se interpreta, se contrasta con notas/materias/contextos reales y luego se convierte en acciones permitidas.

```text
Orden
→ contexto
→ candidatos reales
→ plan seguro
→ validación
→ escritura
```

## Estudio

Jarvis detecta materias bajo `02 - Universidad` sin asumir institución fija. Considera tareas, fechas, material reciente y rotación.

## Trabajo

Las notas laborales nuevas pueden dirigirse al contexto laboral activo. La información histórica no se mueve de forma automática.

## Finanzas

La moneda y la región son configurables. Los montos se guardan como números y se muestran con el formato local seleccionado.

## IA local

Ollama nunca tiene permiso directo sobre el sistema de archivos. El modelo propone; el código valida y ejecuta.
