const { test } = require('node:test');
const assert = require('node:assert/strict');
let exportGraph; try { ({ exportGraph } = require('../src/graphify')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('exporta relaciones comprobables para Graphify con fuente y atribución', () => {
  assert.equal(typeof exportGraph, 'function');
  const graph = exportGraph([{ id: 'a', title: 'Usar memoria compartida', path: 'Decisiones/Memoria.md', source: 'codex', type: 'decision', project: 'Obsidian', attribution: 'user' }]);
  assert.equal(graph.directed, false); assert.equal(graph.nodes.find(n => n.id === 'memory:a').label, 'Usar memoria compartida');
  assert.ok(graph.links.some(e => e.source === 'memory:a' && e.target === 'project:Obsidian' && e.relation === 'belongs_to' && e.source_file === 'Decisiones/Memoria.md'));
  assert.equal(graph.nodes.find(n => n.id === 'memory:a').attribution, 'user');
});
