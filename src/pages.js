'use strict';
const LEGACY_PAGES={
  "Inicio.md": "# Neuronas\n\nTu espacio para pensar, recordar y avanzar.\n\n## Hoy\n- [[01 - Hoy/Hoy|Mi día]]\n- [[04 - Proyectos/Proyectos|Mis proyectos]]\n- [[04 - Proyectos/Tablero|Tablero de tareas]]\n\n## Mi memoria\n- [[09 - Memoria IA/Memoria IA|Memoria compartida de mis IAs]]\n- [[09 - Memoria IA/Perfil/Perfil|Lo que mis IAs deben saber]]\n- [[05 - Conocimiento/Mapa de conocimiento|Mapa de conocimiento]]\n\n## Capturar\n- [[00 - Inbox/Inbox|Ideas y notas rápidas]]\n- [[07 - Recursos/Guía|Cómo usar Neuronas]]\n\nAbre **Neuronas** desde la cinta lateral para buscar recuerdos, guardar decisiones y explorar conexiones.\n",
  "01 - Hoy/Hoy.md": "# Hoy\n\n## Lo más importante\n- [ ] Elegir una tarea para avanzar hoy\n\n## Notas\n\n[[04 - Proyectos/Tablero|Tablero]] · [[Inicio]]\n",
  "00 - Inbox/Inbox.md": "# Inbox\n\nAnota aquí ideas sin clasificarlas todavía.\n\n[[Inicio]]\n",
  "02 - Universidad/Universidad.md": "# Mi universidad\n\nAbre **Neuronas → Universidad** para crear tus materias, apuntes y entregas.\n\n1. Crea una materia con su nombre real.\n2. Desde su tarjeta, agrega un apunte o una entrega.\n3. Asigna una fecha a la entrega para verla en la agenda.\n4. Cambia su estado desde Tareas, en tabla o tablero.\n\nLos apuntes y entregas enlazan a su materia; esos enlaces también aparecen en el grafo de Obsidian.\n\n[[07 - Recursos/Centro de trabajo|Guía del centro de trabajo]] · [[Inicio]]\n",
  "04 - Proyectos/Proyectos.md": "# Proyectos\n\nCrea una nota por proyecto: objetivo, siguiente acción, decisiones y enlaces.\n\n[[04 - Proyectos/Tablero|Tablero]] · [[09 - Memoria IA/Memoria IA|Memoria IA]] · [[Inicio]]\n",
  "04 - Proyectos/Tablero.md": "---\nkanban-plugin: board\n---\n\n## Pendiente\n\n- [ ] Explorar mi memoria compartida\n\n## En curso\n\n## Hecho\n\n\n%% kanban:settings\n```\n{\"kanban-plugin\":\"board\",\"list-collapse\":[false,false,false]}\n```\n%%\n",
  "05 - Conocimiento/Mapa de conocimiento.md": "# Mapa de conocimiento\n\nLas notas y sus enlaces forman tu grafo. Desde una nota abre el grafo local para ver su contexto.\n\n[[09 - Memoria IA/Memoria IA|Memoria IA]] · [[04 - Proyectos/Proyectos|Proyectos]] · [[Inicio]]\n"
};
const PAGE_SEEDS={
  "Inicio.md": "# Mi espacio\n\n[[02 - Universidad/Universidad|Universidad]] · [[01 - Hoy/Hoy|Hoy]] · [[04 - Proyectos/Tablero|Tareas]] · [[09 - Memoria IA/Memoria IA|Memoria IA]]\n\nAbre **Neuronas** para crear notas, entregas y proyectos.\n",
  "01 - Hoy/Hoy.md": "# Hoy\n\n## Mis notas del día\n\n[[Inicio]]\n",
  "00 - Inbox/Inbox.md": "# Inbox\n\n## Capturas e ideas\n\n[[Inicio]]\n",
  "02 - Universidad/Universidad.md": "# Mi universidad\n\nAbre **Neuronas → Universidad** para añadir apuntes y entregas a tus materias.\n\n[[Inicio]]\n",
  "04 - Proyectos/Proyectos.md": "# Mis proyectos\n\n[[04 - Proyectos/Tablero|Tareas]] · [[Inicio]]\n",
  "04 - Proyectos/Tablero.md": "# Mis tareas\n\nAbre **Neuronas → Tareas** para cambiar el estado de una tarea. Los enlaces de esta página abren su nota original.\n\n[[Inicio]]\n",
  "05 - Conocimiento/Mapa de conocimiento.md": "# Mi biblioteca\n\n[[05 - Conocimiento/Red automática/Red automática|Todos mis archivos]] · [[Inicio]]\n"
};
module.exports={LEGACY_PAGES,PAGE_SEEDS};
