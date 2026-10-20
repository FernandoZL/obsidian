const { test } = require('node:test');
const assert = require('node:assert/strict');
let buildGraph; try { ({ buildGraph } = require('../obsidian-plugin/graph')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('el mapa neuronal enlaza cada recuerdo con su proyecto y su IA de origen', () => {
  assert.equal(typeof buildGraph, 'function');
  const graph = buildGraph([{ id: 'a', type: 'decision', project: 'Obsidian', source: 'codex', title: 'Decisión de proyecto', path: 'a.md', content: 'Algo útil' }, { id: 'b', type: 'learning', project: 'Obsidian', source: 'gemini', title: 'Aprendizaje', path: 'b.md' }]);
  assert.ok(graph.nodes.some(n => n.id === 'memory:a' && n.path === 'a.md'));
  assert.ok(graph.edges.some(e => e.source === 'memory:a' && e.target === 'project:Obsidian' && e.kind === 'project'));
  assert.ok(graph.edges.some(e => e.source === 'memory:b' && e.target === 'source:gemini' && e.kind === 'source'));
  assert.ok(graph.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)));
});
test('filtra proyectos y limita cantidad de neuronas sin enlaces rotos', () => {
  assert.equal(typeof buildGraph, 'function');
  const records = Array.from({ length: 200 }, (_, i) => ({ id: String(i), project: i % 2 ? 'A' : 'B', source: 'codex', type: 'session' }));
  const graph = buildGraph(records, { project: 'A', limit: 30 });
  assert.equal(graph.nodes.filter(n => n.kind === 'memory').length, 30);
  assert.ok(!graph.nodes.some(n => n.id === 'project:B'));
  const ids = new Set(graph.nodes.map(n => n.id)); assert.ok(graph.edges.every(e => ids.has(e.source) && ids.has(e.target)));
});
test('el mapa distribuye las neuronas sin amontonarlas en los bordes', () => {
  const records = Array.from({ length: 30 }, (_, i) => ({ id: String(i), project: i % 2 ? 'Obsidian' : 'General', source: i % 2 ? 'codex' : 'gemini', type: 'session' }));
  const graph = buildGraph(records);
  assert.ok(graph.nodes.filter(n => Math.abs(n.x) > 430 || Math.abs(n.y) > 265).length < 8);
});
