const { test } = require('node:test');
const assert = require('node:assert/strict');
let model = {}; try { model = require('../obsidian-plugin/model'); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('lee recuerdos Markdown del contrato y conserva texto Unicode', () => {
  assert.equal(typeof model.fromMarkdown, 'function');
  const text = '---\nneuronas: 1\nid: "uno"\ntype: "decision"\nproject: "Estadística"\n---\n\n# Título\n\n<!-- contenido -->\nAprender probabilidad\n<!-- /contenido -->\n';
  const note = model.fromMarkdown(text, '09 - Memoria IA/Decisiones/uno.md'); assert.equal(note.project, 'Estadística'); assert.equal(note.content, 'Aprender probabilidad');
  assert.equal(model.fromMarkdown('# Nota normal', 'otra.md'), null);
  assert.equal(model.fromMarkdown(text.replaceAll('\n', '\r\n'), 'a.md').content, 'Aprender probabilidad');
});
test('modificar una tarea cambia solo el estado de esa línea', () => {
  assert.equal(typeof model.toggleTask, 'function');
  const input = '# Hoy\r\n- [ ] Comprar café\r\n- [ ] Estudiar\r\n';
  const changed = model.toggleTask(input, 1, 'Comprar café');
  assert.equal(changed, '# Hoy\r\n- [x] Comprar café\r\n- [ ] Estudiar\r\n');
  assert.throws(() => model.toggleTask(input, 2, 'Comprar café'), /cambió/i);
});
