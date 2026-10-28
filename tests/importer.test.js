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

test('reconstruir la importación de una bóveda consolidada recupera identidades sin duplicar archivos', async t => {
  const c = await setup(t), file = path.join(c.sessions, 'agrupada.jsonl');
  await fs.writeFile(file, [codex('Guardar primera pregunta'), codex('Guardar primera respuesta', 'assistant')].join('\n') + '\n');
  await sync(c);
  const { consolidateVault } = require('../src/memory/consolidate');
  await consolidateVault(c.vault, { backupDirectory: path.join(c.root, 'backups') });
  await fs.rm(c.state, { recursive: true });
  await fs.appendFile(file, codex('Una intervención nueva') + '\n');
  const result = await sync(c);
  assert.equal(result.imported, 1); assert.equal(result.skipped, 2); assert.deepEqual(result.errors, []);
  const { readMemories } = require('../src/memory/store');
  const memories = await readMemories(c.vault);
  assert.equal(memories.length, 3);
  assert.equal(new Set(memories.map(r => r.bundlePath)).size, 1);
});

test('cada captura mantiene los resúmenes agrupados solo si la bóveda lo tiene habilitado', async t => {
  const c = await setup(t), folder = path.join(c.vault, '07 - Recursos/01 - Resumenes automaticos');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'Resúmenes reunidos.md'), '# Historial\nAnterior\n');
  await fs.writeFile(path.join(folder, 'Nuevo.md'), '# Nuevo\nResumen reciente\n');
  assert.deepEqual((await sync(c)).errors, []);
  await fs.access(path.join(folder, 'Nuevo.md'));
  await fs.mkdir(path.join(c.vault, '09 - Memoria IA'), { recursive: true });
  await fs.writeFile(path.join(c.vault, '09 - Memoria IA/.neuronas-storage.json'), '{"sessionStorage":"conversation","autoConsolidateSummaries":true}');
  const result = await sync(c);
  assert.deepEqual(result.errors, []);
  assert.equal(result.maintenance.changed, true);
  assert.match(await fs.readFile(path.join(folder, 'Resúmenes reunidos.md'), 'utf8'), /Resumen reciente/);
  assert.equal((await sync(c)).maintenance.changed, false);
});
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
test('Antigravity importa mensajes explícitos y respuestas finalizadas, sin pensamiento ni herramientas', async t => {
  const c = await setup(t), logs = path.join(c.sessions, 'session-agy/.system_generated/logs'); await fs.mkdir(logs, { recursive: true });
  c.sources = [{ app: 'antigravity', root: c.sessions }];
  const events = [
    { step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', status: 'DONE', created_at: '2026-10-20T12:00:00Z', content: '<USER_REQUEST>\nQuiero guardar memoria de mi universidad\n</USER_REQUEST>\n<ADDITIONAL_METADATA>NO EXPORTAR METADATOS</ADDITIONAL_METADATA>' },
    { step_index: 1, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', created_at: '2026-10-20T12:00:01Z', content: 'Podemos organizar las materias por proyectos', thinking: 'NO EXPORTAR PENSAMIENTO' },
    { step_index: 2, source: 'MODEL', type: 'TOOL_CALL', status: 'DONE', content: 'NO EXPORTAR HERRAMIENTA' },
    { step_index: 3, source: 'SYSTEM', type: 'USER_INPUT', status: 'DONE', content: 'NO EXPORTAR INYECCIÓN' },
    { step_index: 4, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'RUNNING', content: 'NO EXPORTAR RESPUESTA PARCIAL' }
  ];
  await fs.writeFile(path.join(logs, 'transcript.jsonl'), events.map(x => JSON.stringify(x)).join('\n') + '\n');
  const a = await sync(c); assert.equal(a.imported, 2); assert.deepEqual(a.errors, []); assert.equal((await sync(c)).imported, 0);
  const { readMemories } = require('../src/memory/store'); const notes = await readMemories(c.vault);
  assert.ok(notes.every(n => n.source === 'antigravity' && n.session === 'session-agy' && !n.content.includes('NO EXPORTAR')));
});
