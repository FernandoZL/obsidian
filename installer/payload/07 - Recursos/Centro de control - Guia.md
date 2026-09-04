# Jarvis · Centro de control — Guía

Jarvis organiza una bóveda sin depender de un nombre, empresa o universidad concretos.

## Perfil

Abra la configuración de **Jarvis Core** para definir:

- nombre;
- contexto educativo activo;
- contexto laboral activo;
- idioma / región;
- moneda;
- modelo de Ollama.

Estos datos se guardan localmente en `data.json`.

## Hablar con Jarvis

Puede usar lenguaje natural:

- `Guarda esta idea: ...`
- `Anota para Proyecto X que ...`
- `Agrega una tarea a Proyecto X: ...`
- `Recuérdame ... mañana`
- `Crea un proyecto llamado ... con tareas ...`
- `En Estadística vimos ...`

Jarvis busca primero notas y materias reales. Si existe un destino claro, reutiliza ese archivo.

## Contextos

### Universidad

Puede haber varias instituciones dentro de `02 - Universidad`.

Jarvis detecta materias por la estructura y por notas típicas como Tareas, Parciales, Apuntes, Fórmulas, Conceptos o Ejercicios.

### Trabajo

Puede haber varias empresas, clientes o actividades dentro de `03 - Trabajo`.

El contexto laboral activo se muestra como:

`Trabajo · Nombre del contexto`

Las notas laborales nuevas se guardan dentro de ese contexto cuando existe.

## Plan de estudio

El botón **Plan de estudio** fuerza una actualización manual. Normalmente Jarvis lo actualiza solo cuando cambian materias o resúmenes académicos.

## Buscador

Busca por:

- título;
- carpeta;
- contenido Markdown;
- materias;
- proyectos;
- tareas;
- nombres de archivos.

## Seguridad

Jarvis no borra, renombra ni mueve información de forma masiva sin una acción explícita y segura.

Los movimientos financieros siguen requiriendo confirmación.

## Móvil

El Centro de control funciona en móvil. Ollama se ejecuta en una computadora de escritorio; los resultados guardados se sincronizan con la bóveda.

[[Inicio|Volver a Inicio]]
