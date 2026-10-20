const { test } = require('node:test');
const assert = require('node:assert/strict');
let m = {}; try { m = require('../obsidian-plugin/workbench-model'); } catch(e) { if(e.code !== 'MODULE_NOT_FOUND') throw e; }

test('crea una entrega enlazada a su materia y proyecto sin permitir salir de la carpeta', () => {
  assert.equal(typeof m.makeDocument, 'function');
  const doc = m.makeDocument('task', { title: '../Resolver álgebra', course: 'Álgebra', project: 'Parcial 1', due: '2026-10-25', tags: 'uni, repaso', content: 'Repasar matrices' }, '2026-10-20');
  assert.ok(doc.folder.startsWith('02 - Universidad/'));
  assert.ok(!doc.filename.includes('/')); assert.ok(!doc.filename.includes('\\'));
  const parsed = m.readDocument(doc.text, { path: doc.folder + '/' + doc.filename, basename: doc.title, stat: { mtime: 123 } });
  assert.equal(parsed.course, 'Álgebra'); assert.equal(parsed.project, 'Parcial 1');
  assert.deepEqual(parsed.tags, ['uni', 'repaso']);
  assert.equal(parsed.tasks.length, 1); assert.equal(parsed.tasks[0].due, '2026-10-25');
  assert.match(doc.text, /\[\[02 - Universidad\/Materias\/Álgebra/);
  assert.throws(() => m.makeDocument('task', { title: 'Entrega', due: '2026-02-30' }), /fecha/i);
});

test('el tablero ignora ejemplos de código y metadatos, conserva tareas y estados existentes', () => {
  assert.equal(typeof m.readDocument, 'function');
  const doc = m.readDocument('---\ntitle: "Ejemplo"\n---\n## En curso\n- [ ] Investigar 📅 2026-10-19\n```md\n- [ ] No es tarea\n```\n<!--\n- [ ] Tampoco\n-->\n## Pendiente\n- [x] Leer\n- [ ] Escribir [estado:: en-curso]\n', { path: 'proyecto.md', basename: 'proyecto', stat: {} });
  assert.equal(doc.tasks.length, 3);
  assert.deepEqual(doc.tasks.map(t => t.state), ['en-curso', 'hecho', 'en-curso']);
  assert.equal(doc.tasks[0].due, '2026-10-19');
});

test('mover una tarjeta conserva la nota y detecta ediciones simultáneas antes de escribir', () => {
  assert.equal(typeof m.changeTaskState, 'function');
  const text = '# Trabajo\r\n- [ ] Leer 📅 2026-10-25\r\n- [ ] Otro\r\n';
  const task = m.readDocument(text, { path: 'x.md', basename: 'x', stat: {} }).tasks[0];
  const doing = m.changeTaskState(text, task, 'en-curso');
  assert.ok(doing.includes('[estado:: en-curso]')); assert.ok(doing.endsWith('- [ ] Otro\r\n'));
  assert.throws(() => m.changeTaskState(text.replace('Leer', 'Cambió'), task, 'hecho'), /cambi/i);
  const updated = m.readDocument(doing, { path: 'x.md', basename: 'x', stat: {} }).tasks[0];
  const done = m.changeTaskState(doing, updated, 'hecho'); assert.match(done, /- \[x\] Leer/);
});

test('la agenda separa vencidas, de hoy y próximas sin incluir completadas', () => {
  assert.equal(typeof m.taskSummary, 'function');
  const tasks = [{ state: 'pendiente', due: '2026-10-19' }, { state: 'en-curso', due: '2026-10-20' }, { state: 'pendiente', due: '2026-10-30' }, { state: 'hecho', due: '2026-10-18' }, { state: 'pendiente', due: '' }];
  const s = m.taskSummary(tasks, '2026-10-20'); assert.equal(s.overdue.length, 1); assert.equal(s.today.length, 1); assert.equal(s.upcoming.length, 1); assert.equal(s.open.length, 4);
});
