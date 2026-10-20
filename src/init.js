'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { ROOT } = require('./memory/store');
const TEMPLATES = {
  'Inicio.md': '# Neuronas\n\nTu espacio para pensar, recordar y avanzar.\n\n## Hoy\n- [[01 - Hoy/Hoy|Mi día]]\n- [[04 - Proyectos/Proyectos|Mis proyectos]]\n- [[04 - Proyectos/Tablero|Tablero de tareas]]\n\n## Mi memoria\n- [[09 - Memoria IA/Inicio|Memoria compartida de mis IAs]]\n- [[09 - Memoria IA/Perfil/Perfil|Lo que mis IAs deben saber]]\n- [[05 - Conocimiento/Mapa|Mapa de conocimiento]]\n\n## Capturar\n- [[00 - Inbox/Inbox|Ideas y notas rápidas]]\n- [[07 - Recursos/Guía|Cómo usar Neuronas]]\n\nAbre **Neuronas** desde la cinta lateral para buscar recuerdos, guardar decisiones y explorar conexiones.\n',
  '00 - Inbox/Inbox.md': '# Inbox\n\nAnota aquí ideas sin clasificarlas todavía.\n\n[[Inicio]]\n',
  '01 - Hoy/Hoy.md': '# Hoy\n\n## Lo más importante\n- [ ] Elegir una tarea para avanzar hoy\n\n## Notas\n\n[[04 - Proyectos/Tablero|Tablero]] · [[Inicio]]\n',
  '04 - Proyectos/Proyectos.md': '# Proyectos\n\nCrea una nota por proyecto: objetivo, siguiente acción, decisiones y enlaces.\n\n[[04 - Proyectos/Tablero|Tablero]] · [[09 - Memoria IA/Inicio|Memoria IA]] · [[Inicio]]\n',
  '04 - Proyectos/Tablero.md': '---\nkanban-plugin: board\n---\n\n## Pendiente\n\n- [ ] Explorar mi memoria compartida\n\n## En curso\n\n## Hecho\n\n\n%% kanban:settings\n```\n{"kanban-plugin":"board","list-collapse":[false,false,false]}\n```\n%%\n',
  '05 - Conocimiento/Mapa.md': '# Mapa de conocimiento\n\nLas notas y sus enlaces forman tu grafo. Desde una nota abre el grafo local para ver su contexto.\n\n[[09 - Memoria IA/Inicio|Memoria IA]] · [[04 - Proyectos/Proyectos|Proyectos]] · [[Inicio]]\n',
  '07 - Recursos/Guía.md': '# Cómo usar Neuronas\n\n1. Abre el panel Neuronas (icono de cerebro).\n2. Busca un tema: la búsqueda local no consume una API.\n3. Guarda una decisión o un aprendizaje; elige su proyecto.\n4. Abre el grafo para ver las conexiones.\n5. Usa el tablero para organizar pendientes.\n\n## Qué se recuerda\nLos importadores guardan extractos de mensajes de Codex, Claude y Gemini, con origen y atribución. No son resúmenes inteligentes ni hechos confirmados. Las decisiones guardadas de forma explícita se priorizan al recuperar contexto.\n\nLa captura automática requiere esta PC encendida. Las otras aplicaciones solo comparten memoria si se configura un conector compatible.\n\n## IA de Google\nTu complemento IA de bóveda conserva su configuración. Las consultas a Google requieren conectividad y pueden consumir la cuota del proveedor. Las consultas del panel Neuronas son locales.\n\n## Correcciones\nEdita o elimina una memoria en Obsidian. Los mensajes ya importados no reaparecen en el siguiente ciclo, salvo que reconstruyas el índice de importación.\n\n[[Inicio]]\n',
  [`${ROOT}/Inicio.md`]: '# Memoria compartida IA\n\n[[09 - Memoria IA/Perfil/Perfil|Perfil]] · [[04 - Proyectos/Proyectos|Proyectos]] · [[05 - Conocimiento/Mapa|Mapa de conocimiento]]\n\nLas sesiones son extractos de conversaciones. Las decisiones y aprendizajes guardados explícitamente tienen prioridad sobre las sesiones.\n\nUsa el panel Neuronas para buscar por contenido y abrir las fuentes. En el grafo, cada sesión se conecta con su proyecto.\n\n[[Inicio]]\n',
  [`${ROOT}/Perfil/Perfil.md`]: '# Mi perfil\n\nCompleta tus preferencias y guarda los puntos esenciales como memorias de tipo Perfil desde el panel.\n\n- Idioma preferido: español.\n- Forma de trabajar: contexto breve, decisiones claras y aprendizaje reutilizable.\n\n[[09 - Memoria IA/Inicio|Memoria IA]]\n'
};
async function initVault(vault) {
  await fs.mkdir(vault, { recursive: true });
  let created = 0;
  for (const [relative, content] of Object.entries(TEMPLATES)) {
    const file = path.join(vault, relative); await fs.mkdir(path.dirname(file), { recursive: true });
    try { await fs.writeFile(file, content, { encoding: 'utf8', flag: 'wx' }); created++; }
    catch(e) { if (e.code !== 'EEXIST') throw e; }
  }
  return { created };
}
module.exports = { initVault };
