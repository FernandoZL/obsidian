const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let renameMemories; try { ({ renameMemories } = require('../src/memory/migrate')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('renombra memorias con nombres legibles manteniendo identidad, vínculos y deduplicación', async t => {
  assert.equal(typeof renameMemories, 'function');
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-names-')); t.after(() => fs.rm(vault, { recursive: true, force: true }));
  const { saveMemory, readMemories } = require('../src/memory/store');
  const saved = await saveMemory(vault, { id: 'abc123', type: 'session', source: 'codex', content: 'Usar memoria compartida para mis proyectos', project: 'Obsidian' });
  const legacy = path.join(path.dirname(saved.path), 'abc123.md'); await fs.rename(saved.path, legacy);
  const result = await renameMemories(vault); assert.equal(result.renamed, 1);
  const records = await readMemories(vault); assert.equal(records[0].id, 'abc123'); assert.match(records[0].path, /Codex · Usar memoria compartida/);
  assert.match(await fs.readFile(path.join(vault, records[0].path), 'utf8'), /\[\[09 - Memoria IA\/Proyectos\/Recuerdos de Obsidian\|/);
  assert.equal((await saveMemory(vault, { id: 'abc123', type: 'session', source: 'codex', content: 'Usar memoria compartida para mis proyectos', project: 'Obsidian' })).created, false);
  assert.equal((await renameMemories(vault)).renamed, 0);
});
test('reanuda vínculos pendientes después de una interrupción de migración', async t => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-resume-')); t.after(() => fs.rm(vault, { recursive: true, force: true }));
  const { saveMemory } = require('../src/memory/store'); const saved = await saveMemory(vault, { id: 'legacy', title: 'Nombre legible', content: 'Contenido del proyecto' });
  const old = path.join(path.dirname(saved.path), 'legacy.md'); await fs.rename(saved.path, old);
  const ref = path.join(vault, 'Ref.md'); await fs.writeFile(ref, '[[09 - Memoria IA/Aprendizajes/legacy]]');
  const rename = fs.rename; fs.rename = async (from, to) => { if (path.basename(to) === 'Ref.md') throw new Error('interrupción'); return rename(from, to); };
  try { await assert.rejects(renameMemories(vault), /interrupción/); } finally { fs.rename = rename; }
  assert.equal(await fs.readFile(ref, 'utf8'), '[[09 - Memoria IA/Aprendizajes/legacy]]');
  await assert.rejects(fs.access(old), /ENOENT/);
  await renameMemories(vault);
  assert.equal(await fs.readFile(ref, 'utf8'), '[[09 - Memoria IA/Aprendizajes/Nombre legible]]');
});
