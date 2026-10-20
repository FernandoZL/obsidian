const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let store = {}, retrieve = {}, filter = {};
try { store = require('../src/memory/store'); retrieve = require('../src/memory/retrieve'); filter = require('../src/memory/redact'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
async function temp(t) { const p = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-')); t.after(() => fs.rm(p, { recursive: true, force: true })); return p; }
test('una memoria persiste en español con metadatos y no se duplica', async t => {
  assert.equal(typeof store.saveMemory, 'function');
  const vault = await temp(t);
  const record = { id: 'prueba-1', type: 'decision', source: 'manual', content: 'Usar búsqueda local para Estadística', project: 'Universidad', date: '2026-10-20T12:00:00Z' };
  const a = await store.saveMemory(vault, record), b = await store.saveMemory(vault, record);
  assert.equal(a.created, true); assert.equal(b.created, false);
  assert.match(a.path, /Decisión.*Usar búsqueda local para Estadística\.md$/);
  const notes = await store.readMemories(vault);
  assert.equal(notes.length, 1); assert.equal(notes[0].content, record.content); assert.equal(notes[0].project, 'Universidad');
  assert.match(await fs.readFile(a.path, 'utf8'), /\[\[.*Universidad.*\]\]/);
});
test('nombres repetidos conservan recuerdos distintos con títulos legibles', async t => {
  const vault = await temp(t);
  const a = await store.saveMemory(vault, { id: 'primero', title: 'Una idea', content: 'Contenido uno' });
  const b = await store.saveMemory(vault, { id: 'segundo', title: 'Una idea', content: 'Contenido dos' });
  assert.notEqual(a.path, b.path); assert.match(b.path, /Una idea \(2\)\.md$/);
  assert.equal((await store.saveMemory(vault, { id: 'segundo', title: 'Otra etiqueta', content: 'Contenido dos' })).created, false);
});
test('rechaza identificadores que salen de la bóveda', async t => {
  assert.equal(typeof store.saveMemory, 'function');
  await assert.rejects(store.saveMemory(await temp(t), { id: '../fuera', content: 'x' }), /identificador/i);
});
test('escrituras concurrentes del mismo recuerdo crean una sola nota', async t => {
  assert.equal(typeof store.saveMemory, 'function'); const vault = await temp(t);
  const results = await Promise.all(Array.from({ length: 12 }, () => store.saveMemory(vault, { id: 'mismo', content: 'Contenido estable' })));
  assert.equal(results.filter(r => r.created).length, 1); assert.equal((await store.readMemories(vault)).length, 1);
});
test('no sobrescribe un recuerdo existente con contenido diferente', async t => {
  assert.equal(typeof store.saveMemory, 'function'); const vault = await temp(t);
  await store.saveMemory(vault, { id: 'estable', content: 'Original' });
  await assert.rejects(store.saveMemory(vault, { id: 'estable', content: 'Distinto' }), /conflicto/i);
  assert.equal((await store.readMemories(vault))[0].content, 'Original');
});
test('búsqueda normaliza acentos y respeta el presupuesto completo con fuentes', () => {
  assert.equal(typeof retrieve.searchMemories, 'function');
  const notes = [{ id: 'a', content: 'Estadística: estudiar probabilidad ' + 'dato '.repeat(300), project: 'Universidad', path: 'a.md', type: 'learning' }, { id: 'b', content: 'Receta de cocina', path: 'b.md' }];
  const result = retrieve.searchMemories(notes, 'estadistica', { maxChars: 420 });
  assert.deepEqual(result.sources, ['a.md']); assert.match(result.text, /Estadística/); assert.ok(result.text.length <= 420); assert.ok(result.estimatedTokens <= 105);
  assert.equal(retrieve.searchMemories(notes, 'inexistente', { maxChars: 420 }).sources.length, 0);
});
test('contexto de inicio favorece decisiones sobre extractos de sesiones', () => {
  assert.equal(typeof retrieve.searchMemories, 'function');
  const result = retrieve.searchMemories([{ id: 's', type: 'session', content: 'Texto largo de sesión', path: 's.md', date: '2026-10-21' }, { id: 'd', type: 'decision', content: 'Decisión útil', path: 'd.md', date: '2026-10-20' }], '', { maxChars: 3200 });
  assert.deepEqual(result.sources, ['d.md']); assert.ok(result.text.length <= 3200);
});
test('recuerdos editados con CRLF siguen visibles y mantienen su identidad', async t => {
  const vault = await temp(t), saved = await store.saveMemory(vault, { id: 'crlf', content: 'Una decisión\nDos líneas' });
  await fs.writeFile(saved.path, (await fs.readFile(saved.path, 'utf8')).replaceAll('\n', '\r\n'));
  const notes = await store.readMemories(vault); assert.equal(notes.length, 1); assert.equal(notes[0].content, 'Una decisión\nDos líneas');
  assert.equal((await store.saveMemory(vault, { id: 'crlf', content: 'Una decisión\nDos líneas' })).created, false);
});
test('filtra credenciales sintéticas sin borrar texto normal', () => {
  assert.equal(typeof filter.redact, 'function');
  const input = 'API_KEY=demo-secreto-no-publicar\n' + 'AIza' + 'a'.repeat(35) + '\nBearer abcdefghijklmnopqrstuvwxyz\nAprender álgebra';
  const output = filter.redact(input);
  assert.ok(!output.includes('demo-secreto')); assert.ok(!output.includes('a'.repeat(35))); assert.ok(!output.includes('abcdefghijklmnopqrstuvwxyz')); assert.match(output, /Aprender álgebra/);
});
test('reintenta reemplazos bloqueados temporalmente sin borrar el original', async t => {
  const vault = await temp(t), file = path.join(vault, 'nota.md'); await fs.writeFile(file, 'original');
  const rename = fs.rename; let attempts = 0;
  fs.rename = async (from, to) => { if (to === file && attempts++ < 2) { const error = new Error('iCloud ocupado'); error.code = 'EPERM'; throw error; } return rename(from, to); };
  try { await store.atomicWrite(file, 'actualizada'); } finally { fs.rename = rename; }
  assert.equal(await fs.readFile(file, 'utf8'), 'actualizada'); assert.equal(attempts, 3);
});
test('los nombres de proyecto no introducen delimitadores de sección en wikilinks', async t => {
  const vault = await temp(t); const result = await store.saveMemory(vault, { content: 'Aprender programación', project: 'C# [avanzado]^' });
  const text = await fs.readFile(result.path, 'utf8'); const target = text.match(/Proyecto: \[\[([^|]+)/)[1];
  assert.ok(!/[#^\[\]]/.test(target)); await fs.access(path.join(vault, target + '.md'));
});
test('copias de sincronización con misma identidad y contenido no duplican el contexto', async t => {
  const vault = await temp(t); const saved = await store.saveMemory(vault, { id: 'repetida', content: 'Decisión compartida' });
  await fs.copyFile(saved.path, path.join(path.dirname(saved.path), 'Copia de sincronización.md'));
  assert.equal((await store.readMemories(vault)).length, 1);
});
