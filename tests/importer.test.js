const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let sync; try { ({ sync } = require('../src/importer')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-import-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const vault = path.join(root, 'vault'), sessions = path.join(root, 'sessions');
  await fs.mkdir(vault); await fs.mkdir(sessions);
  return { root, vault, sessions, state: path.join(root, 'state'), sources: [{ app: 'codex', root: sessions }] };
}
const codex = (text, role = 'user') => JSON.stringify({ type: 'response_item', timestamp: '2026-10-20T12:00:00Z', payload: { type: 'message', role, phase: 'final_answer', content: [{ type: 'input_text', text }] } });
test('importa mensajes, excluye herramientas y no duplica al repetir', async t => {
  assert.equal(typeof sync, 'function'); const c = await setup(t);
  await fs.writeFile(path.join(c.sessions, 'a.jsonl'), [codex('Decidí usar Obsidian'), JSON.stringify({ type: 'response_item', payload: { type: 'custom_tool_call_output', output: 'SECRETO DE HERRAMIENTA' } }), codex('Queda implementado', 'assistant')].join('\n') + '\n');
  const a = await sync(c), b = await sync(c);
  assert.equal(a.imported, 2); assert.equal(b.imported, 0); assert.deepEqual(a.errors, []);
});
test('no consume una línea incompleta y la importa al completarse', async t => {
  assert.equal(typeof sync, 'function'); const c = await setup(t), file = path.join(c.sessions, 'a.jsonl');
  const line = codex('Mañana continuar con álgebra');
  await fs.writeFile(file, line.slice(0, 40)); assert.equal((await sync(c)).imported, 0);
  await fs.appendFile(file, line.slice(40) + '\n'); assert.equal((await sync(c)).imported, 1);
});
test('un fallo de escritura no adelanta el punto de importación', async t => {
  assert.equal(typeof sync, 'function'); const c = await setup(t);
  await fs.writeFile(path.join(c.sessions, 'a.jsonl'), codex('Preferencia persistente') + '\n');
  await fs.writeFile(path.join(c.vault, '09 - Memoria IA'), 'obstrucción');
  assert.ok((await sync(c)).errors.length > 0);
  await fs.unlink(path.join(c.vault, '09 - Memoria IA'));
  assert.equal((await sync(c)).imported, 1);
});
test('captura Claude y Gemini conservando atribución y excluyendo razonamiento', async t => {
  assert.equal(typeof sync, 'function'); const c = await setup(t);
  const claude = path.join(c.root, 'claude'), gemini = path.join(c.root, 'gemini'); await fs.mkdir(claude); await fs.mkdir(gemini);
  c.sources = [{ app: 'claude', root: claude }, { app: 'gemini', root: gemini }];
  await fs.writeFile(path.join(claude, 'c.jsonl'), JSON.stringify({ type: 'user', uuid: 'c1', sessionId: 'c', message: { role: 'user', content: 'Prefiero respuestas breves' } }) + '\n');
  await fs.writeFile(path.join(gemini, 'g.jsonl'), [JSON.stringify({ $set: { sessionId: 'g' } }), JSON.stringify({ type: 'gemini', id: 'g1', content: 'Respuesta de Gemini', thoughts: [{ text: 'NO EXPORTAR' }] })].join('\n') + '\n');
  const result = await sync(c); assert.equal(result.imported, 2);
  const { readMemories } = require('../src/memory/store'); const memories = await readMemories(c.vault);
  assert.equal(memories.find(x => x.source === 'claude').attribution, 'user');
  assert.equal(memories.find(x => x.source === 'gemini').attribution, 'assistant');
  assert.ok(memories.every(x => !x.content.includes('NO EXPORTAR')));
});
test('relee un archivo truncado sin perder mensajes nuevos', async t => {
  assert.equal(typeof sync, 'function'); const c = await setup(t), file = path.join(c.sessions, 'a.jsonl');
  await fs.writeFile(file, codex('Primera preferencia de proyecto bastante larga') + '\n'); await sync(c);
  await fs.writeFile(file, codex('Nueva decisión') + '\n'); assert.equal((await sync(c)).imported, 1);
});
test('detecta reemplazo de mismo tamaño con el mismo encabezado', async t => {
  const c = await setup(t), file = path.join(c.sessions, 'a.jsonl');
  const header = JSON.stringify({ type: 'session_meta', payload: { id: 'estable', cwd: 'C:/proyecto', padding: 'a'.repeat(160) } }) + '\n';
  await fs.writeFile(file, header + codex('Recordar decisión alfa') + '\n'); assert.equal((await sync(c)).imported, 1);
  await fs.writeFile(file, header + codex('Recordar decisión beta') + '\n'); assert.equal((await sync(c)).imported, 1);
});
test('redacta PEM antes de truncar mensajes largos y descarta confirmaciones vacías', async t => {
  const c = await setup(t), file = path.join(c.sessions, 'a.jsonl');
  const text = 'Datos de proyecto '.repeat(80) + '\n-----BEGIN PRIVATE KEY-----\n' + 'DATOPRIVADOSINTETICO'.repeat(500) + '\n-----END PRIVATE KEY-----\n';
  await fs.writeFile(file, [codex(text), codex('si')].join('\n') + '\n'); assert.equal((await sync(c)).imported, 1);
  const { readMemories } = require('../src/memory/store'); const notes = await readMemories(c.vault);
  assert.ok(notes.every(x => !x.content.includes('DATOPRIVADOSINTETICO')));
});
test('proyectos en rutas distintas conservan identidades distintas', () => {
  const { projectFromCwd } = require('../src/adapters/common');
  assert.notEqual(projectFromCwd('C:/clientA/api'), projectFromCwd('C:/clientB/api'));
  assert.notEqual(projectFromCwd('C:/clientA/packages/api'), projectFromCwd('C:/clientB/packages/api'));
});
test('rechaza reutilizar estado de una bóveda para otra', async t => {
  const c = await setup(t); await sync(c); const other = path.join(c.root, 'other'); await fs.mkdir(other);
  await assert.rejects(sync({ ...c, vault: other }), /otra bóveda/i);
});
