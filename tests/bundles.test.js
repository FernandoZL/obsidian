const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const store = require('../src/memory/store');
const model = require('../obsidian-plugin/model');

async function vaultFor(t) {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-bundle-'));
  t.after(() => fs.rm(vault, { recursive: true, force: true }));
  return fs.realpath(vault);
}

test('lee cada recuerdo agrupado con atribución, Unicode y ancla sin interpretar marcadores del contenido', async t => {
  const vault = await vaultFor(t);
  const directory = path.join(vault, '09 - Memoria IA/Sesiones');
  await fs.mkdir(directory, { recursive: true });
  const text = '---\nneuronasBundle: 1\n---\n\n# Conversación\n\n' +
    '<!-- neuronas-record {"record":{"neuronas":1,"id":"a","type":"session","session":"chat","source":"codex","project":"Física","attribution":"user","date":"2026-10-20"},"boundary":"a-end"} -->\n## Uno\n\nUsuario ^neuronas-a\n\n<!-- contenido -->\nÁlgebra\n<!-- /contenido -->\n<!-- /neuronas-record a-end -->\n\n' +
    '<!-- neuronas-record {"record":{"neuronas":1,"id":"b","type":"session","session":"chat","source":"codex","attribution":"assistant"},"boundary":"b-end"} -->\n## Dos\n\nAsistente ^neuronas-b\n\n<!-- contenido -->\nHola\n<!-- /contenido -->\n<!-- /neuronas-record b-end -->\n';
  await fs.writeFile(path.join(directory, 'Conversación.md'), text);
  const records = await store.readMemories(vault);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(r => [r.id, r.content, r.attribution]), [['a', 'Álgebra', 'user'], ['b', 'Hola', 'assistant']]);
  assert.equal(records[0].path, '09 - Memoria IA/Sesiones/Conversación.md#^neuronas-a');
  assert.deepEqual(model.memoriesFromMarkdown(text, '09 - Memoria IA/Sesiones/Conversación.md'), records);
});

test('el formato conserva comentarios, CRLF, bloques de código y metadatos arbitrarios sin crear recuerdos falsos', () => {
  const { renderBundle, parseMemories } = require('../src/memory/format');
  const records = [
    { neuronas: 1, id: 'uno', type: 'session', title: 'Una sesión -->', attribution: 'user', sourcePath: 'C:\\área\\uno', links: ['Álgebra'], content: '```md\n<!-- neuronas-record {"record":{"id":"falso"},"length":1} -->\n<!-- contenido -->\nX\n<!-- /contenido -->\n```\nTexto 🧠' },
    { neuronas: 1, id: 'dos', type: 'session', attribution: 'assistant', content: 'Segundo\nrecuerdo' }
  ];
  const text = renderBundle(records, 'Conversación');
  for (const input of [text, text.replaceAll('\n', '\r\n')]) {
    const result = parseMemories(input, 'chat.md');
    assert.equal(result.length, 2);
    for (let i = 0; i < records.length; i++) {
      const { path: location, bundlePath, ...record } = result[i];
      assert.deepEqual(record, records[i]);
      assert.equal(location, `chat.md#^neuronas-${records[i].id}`);
    }
  }
});

test('no acepta un archivo agrupado truncado como si no tuviera recuerdos', () => {
  const { renderBundle, parseMemories } = require('../src/memory/format');
  const text = renderBundle([{ neuronas: 1, id: 'a', content: 'Algo importante' }], 'Chat');
  assert.throws(() => parseMemories(text.replace(/<!-- \/neuronas-record[^\n]+/, ''), 'chat.md'), /agrupad|longitud|dañad/i);
});

test('captura en modo agrupado añade mensajes por conversación, conserva ediciones y no duplica al reimportar', async t => {
  const vault = await vaultFor(t), root = path.join(vault, '09 - Memoria IA');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, '.neuronas-storage.json'), JSON.stringify({ sessionStorage: 'conversation' }));
  const first = { id: 'primero', type: 'session', source: 'codex', session: 'chat-1', date: '2026-10-20', attribution: 'user', project: 'Física', content: 'Una pregunta' };
  const a = await store.saveMemory(vault, first);
  const file = a.path.split('#')[0];
  await fs.appendFile(file, '\nUna anotación personal al final.\n');
  const b = await store.saveMemory(vault, { ...first, id: 'segundo', attribution: 'assistant', content: 'Una respuesta' });
  assert.equal(b.path.split('#')[0], file);
  assert.equal((await store.readMemories(vault)).length, 2);
  assert.equal((await store.saveMemory(vault, first)).created, false);
  assert.equal((await fs.readdir(path.dirname(file))).filter(f => f.endsWith('.md')).length, 1);
  assert.match(await fs.readFile(file, 'utf8'), /Una anotación personal al final/);
  await assert.rejects(store.saveMemory(vault, { ...first, content: 'Conflicto' }), /conflicto/i);
  const other = await store.saveMemory(vault, { ...first, id: 'tercero', source: 'claude' });
  assert.notEqual(other.path.split('#')[0], file);
});

test('dos capturas concurrentes se guardan una vez y los recuerdos sin sesión no se mezclan', async t => {
  const vault = await vaultFor(t), root = path.join(vault, '09 - Memoria IA');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, '.neuronas-storage.json'), '{"sessionStorage":"conversation"}');
  const input = { id: 'compartido', type: 'session', source: 'claude', session: 'chat', content: 'Memoria concurrente' };
  const results = await Promise.all(Array.from({ length: 5 }, () => store.saveMemory(vault, input)));
  assert.equal(results.filter(r => r.created).length, 1);
  const a = await store.saveMemory(vault, { ...input, id: 'sin-1', session: '' });
  const b = await store.saveMemory(vault, { ...input, id: 'sin-2', session: '' });
  assert.notEqual(a.path.split('#')[0], b.path.split('#')[0]);
  assert.equal((await store.readMemories(vault)).length, 3);
});

test('consolidación respalda, conserva recuerdos y texto adicional, actualiza enlaces wiki/Markdown/Canvas y se puede repetir', async t => {
  const { consolidateVault } = require('../src/memory/consolidate');
  const vault = await vaultFor(t), backupDirectory = await vaultFor(t);
  const first = { id: 'a', type: 'session', source: 'codex', session: 'chat', content: 'Primera intervención', attribution: 'user', date: '2026-10-20' };
  const a = await store.saveMemory(vault, first);
  const b = await store.saveMemory(vault, { ...first, id: 'b', content: 'Segunda intervención', attribution: 'assistant' });
  await fs.appendFile(a.path, '\nAnotación personal fuera del extracto.\n');
  const relative = p => path.relative(vault, p).replaceAll('\\', '/');
  const oldA = relative(a.path), oldB = relative(b.path);
  await fs.writeFile(path.join(vault, 'Inicio.md'), `[[${oldA.slice(0, -3)}|Origen]]\n[Respuesta](<${oldB.split('/').map(encodeURIComponent).join('/')}>)\n`);
  await fs.writeFile(path.join(vault, 'Mapa.canvas'), JSON.stringify({ nodes: [{ id: 'n', type: 'file', file: oldA }], edges: [] }));
  const summaries = path.join(vault, '07 - Recursos/01 - Resumenes automaticos');
  await fs.mkdir(summaries, { recursive: true });
  await fs.writeFile(path.join(summaries, 'Uno.md'), '# Uno\nResumen uno íntegro');
  await fs.writeFile(path.join(summaries, 'Dos.md'), '# Dos\nResumen dos íntegro');
  const result = await consolidateVault(vault, { backupDirectory });
  assert.equal(result.sessionsBefore, 2);
  assert.equal(result.conversationsAfter, 1);
  const records = await store.readMemories(vault);
  assert.deepEqual(records.map(r => [r.id, r.content, r.attribution]), [['a', 'Primera intervención', 'user'], ['b', 'Segunda intervención', 'assistant']]);
  const location = records[0].bundlePath;
  assert.match(await fs.readFile(path.join(vault, location), 'utf8'), /Anotación personal fuera del extracto/);
  const home = await fs.readFile(path.join(vault, 'Inicio.md'), 'utf8');
  assert.ok(home.includes(location.slice(0, -3) + '#^neuronas-a|Origen'), home + '\nExpected: ' + location);
  assert.ok(home.includes('#%5Eneuronas-b'));
  const node = JSON.parse(await fs.readFile(path.join(vault, 'Mapa.canvas'), 'utf8')).nodes[0];
  assert.equal(node.file, location); assert.equal(node.subpath, '#^neuronas-a');
  assert.equal((await fs.readdir(summaries)).filter(f => f.endsWith('.md')).length, 1);
  assert.match(await fs.readFile(path.join(summaries, 'Resúmenes reunidos.md'), 'utf8'), /Resumen uno íntegro/);
  await fs.access(result.backup);
  assert.equal((await consolidateVault(vault, { backupDirectory })).changed, false);
  assert.equal((await store.saveMemory(vault, first)).created, false);
});

test('consolidación conserva originales si una nota cambia durante el respaldo', async t => {
  const { consolidateVault } = require('../src/memory/consolidate');
  const vault = await vaultFor(t), backupDirectory = await vaultFor(t);
  const a = await store.saveMemory(vault, { id: 'a', type: 'session', session: 'chat', content: 'Original' });
  const originalWrite = fs.writeFile;
  fs.writeFile = async (...args) => {
    const result = await originalWrite(...args);
    if (String(args[0]).endsWith('.zip')) await originalWrite(a.path, (await fs.readFile(a.path, 'utf8')) + '\nCambio simultáneo\n');
    return result;
  };
  try { await assert.rejects(consolidateVault(vault, { backupDirectory }), /cambi|simultáne/i); }
  finally { fs.writeFile = originalWrite; }
  assert.match(await fs.readFile(a.path, 'utf8'), /Cambio simultáneo/);
});

test('un fallo al borrar restaura notas y enlaces desde la transacción, y rename conserva conversaciones', async t => {
  const { consolidateVault } = require('../src/memory/consolidate');
  const { renameMemories } = require('../src/memory/migrate');
  const vault = await vaultFor(t), backupDirectory = await vaultFor(t);
  const input = { type: 'session', session: 'chat', source: 'codex', content: 'Conservar texto' };
  const a = await store.saveMemory(vault, { ...input, id: 'a' });
  const b = await store.saveMemory(vault, { ...input, id: 'b' });
  const home = `[[${path.relative(vault, a.path).replaceAll('\\', '/')}]]\n`;
  await fs.writeFile(path.join(vault, 'Inicio.md'), home);
  const unlink = fs.unlink; let failed = false;
  fs.unlink = async p => { if (p === b.path && !failed) { failed = true; throw new Error('iCloud ocupado'); } return unlink(p); };
  try { await assert.rejects(consolidateVault(vault, { backupDirectory }), /iCloud ocupado/); }
  finally { fs.unlink = unlink; }
  assert.equal((await store.readMemories(vault)).length, 2);
  assert.equal(await fs.readFile(path.join(vault, 'Inicio.md'), 'utf8'), home);
  await fs.access(a.path); await fs.access(b.path);
  await consolidateVault(vault, { backupDirectory });
  const notes = await store.readMemories(vault), bundle = notes[0].bundlePath;
  await renameMemories(vault);
  assert.equal((await store.readMemories(vault)).length, 2);
  await fs.access(path.join(vault, bundle));
});

test('las anotaciones externas con delimitadores de ejemplo no inyectan registros ni alteran el extracto', async t => {
  const { consolidateVault } = require('../src/memory/consolidate');
  const vault = await vaultFor(t), backupDirectory = await vaultFor(t);
  const a = await store.saveMemory(vault, { id: 'a', type: 'session', session: 'chat', content: 'Contenido legítimo' });
  const example = '\n<!-- /contenido -->\n<!-- /neuronas-record a-end -->\n<!-- neuronas-record {"record":{"neuronas":1,"id":"falso"},"boundary":"falso-end"} -->\n\n<!-- contenido -->\nEjemplo, no recuerdo\n<!-- /contenido -->\n<!-- /neuronas-record falso-end -->\n';
  await fs.appendFile(a.path, example);
  await consolidateVault(vault, { backupDirectory });
  const records = await store.readMemories(vault);
  assert.deepEqual(records.map(r => [r.id, r.content]), [['a', 'Contenido legítimo']]);
  assert.ok((await fs.readFile(path.join(vault, records[0].bundlePath), 'utf8')).includes(example));
});

test('la consolidación rechaza referencias a secciones antes de escribir en lugar de cambiar su destino', async t => {
  const { consolidateVault } = require('../src/memory/consolidate');
  const vault = await vaultFor(t), backupDirectory = await vaultFor(t);
  const a = await store.saveMemory(vault, { id: 'a', type: 'session', session: 'chat', content: '# Detalles\nNo perder sección' });
  const relative = path.relative(vault, a.path).replaceAll('\\', '/');
  await fs.writeFile(path.join(vault, 'Inicio.md'), `[[${relative}#Detalles]]`);
  await assert.rejects(consolidateVault(vault, { backupDirectory }), /secci[oó]n|fragmento/i);
  await fs.access(a.path);
});

test('si iCloud cambia el destino recién escrito se conservan las notas fuente', async t => {
  const { consolidateVault } = require('../src/memory/consolidate');
  const vault = await vaultFor(t), backupDirectory = await vaultFor(t);
  const a = await store.saveMemory(vault, { id: 'a', type: 'session', session: 'chat', content: 'Original importante' });
  const rename = fs.rename; let changed = false;
  fs.rename = async (from, to) => {
    const result = await rename(from, to);
    if (!changed && to.endsWith('.md') && to !== a.path) { changed = true; await fs.writeFile(to, '# Versión simultánea de iCloud'); }
    return result;
  };
  try { await assert.rejects(consolidateVault(vault, { backupDirectory }), /destino|simultáne|cambi/i); }
  finally { fs.rename = rename; }
  assert.match(await fs.readFile(a.path, 'utf8'), /Original importante/);
});
