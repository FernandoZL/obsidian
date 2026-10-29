const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const store = require('../src/memory/store');
const { renderBundle } = require('../src/memory/format');

async function temp(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-ai-')); t.after(() => fs.rm(dir, { recursive: true, force: true })); return fs.realpath(dir); }

test('usa el siguiente asistente ante ausente, error, JSON inválido o timeout', async t => {
  const { requestWithFallback } = require('../src/organizer/providers');
  const cwd = await temp(t);
  const providers = [
    { name: 'missing', command: path.join(cwd, 'ausente.exe'), args: [] },
    { name: 'invalid', command: process.execPath, args: ['-e', 'console.log("no es JSON")'] },
    { name: 'slow', command: process.execPath, args: ['-e', 'setTimeout(()=>{},10000)'], timeoutMs: 100 },
    { name: 'working', command: process.execPath, args: ['-e', 'console.log(JSON.stringify({summary:"Plan válido",groups:[]}))'] }
  ];
  const result = await requestWithFallback(providers, 'Inventario', { cwd, validate: plan => { assert.ok(Array.isArray(plan.groups)); return plan; } });
  assert.equal(result.provider, 'working'); assert.equal(result.failures.length, 3);
  assert.equal(result.plan.summary, 'Plan válido');
});

test('un plan inválido también pasa al siguiente asistente', async t => {
  const { requestWithFallback } = require('../src/organizer/providers');
  const cwd = await temp(t);
  const provider = (name, valid) => ({ name, command: process.execPath, args: ['-e', `console.log(JSON.stringify({valid:${valid}}))`] });
  const result = await requestWithFallback([provider('bad', false), provider('good', true)], 'Prompt', { cwd, validate: plan => { if (!plan.valid) throw new Error('Plan no permitido'); return plan; } });
  assert.equal(result.provider, 'good'); assert.equal(result.failures.length, 1);
});

test('fusiona recuerdos por tema, conserva anotaciones y referencias a bloques, y protege las materias', async t => {
  const { snapshotVault, planOrganization, applyOrganization } = require('../src/organizer/vault');
  const vault = await temp(t), state = await temp(t), folder = '09 - Memoria IA/Sesiones';
  await fs.mkdir(path.join(vault, folder), { recursive: true });
  const a = folder + '/Uno.md', b = folder + '/Dos.md';
  const record = { neuronas: 1, type: 'session', source: 'codex', session: 'chat', attribution: 'user' };
  await fs.writeFile(path.join(vault, a), renderBundle([{ ...record, id: 'a', content: 'Aprender Neuronas' }], 'Uno') + '\nMis notas personales.\n');
  await fs.writeFile(path.join(vault, b), renderBundle([{ ...record, id: 'b', content: 'Ordenar Obsidian' }], 'Dos'));
  await fs.writeFile(path.join(vault, 'Inicio.md'), `[[${a}#^neuronas-a|Origen]]\n[Otro](<${b.split('/').map(encodeURIComponent).join('/')}#%5Eneuronas-b>)`);
  await fs.mkdir(path.join(vault, '02 - Universidad'), { recursive: true });
  await fs.writeFile(path.join(vault, '02 - Universidad/Apunte.md'), '# Apunte\nNo alterar');
  const files = await snapshotVault(vault);
  const plan = planOrganization(files, { summary: 'Recuerdos sobre Neuronas', groups: [{ title: 'Neuronas y Obsidian', files: [a, b] }] });
  await applyOrganization(vault, files, plan, state);
  const memories = await store.readMemories(vault);
  assert.deepEqual(memories.map(r => [r.id, r.content]), [['a', 'Aprender Neuronas'], ['b', 'Ordenar Obsidian']]);
  assert.equal(new Set(memories.map(r => r.bundlePath)).size, 1);
  const target = memories[0].bundlePath;
  assert.match(await fs.readFile(path.join(vault, target), 'utf8'), /Mis notas personales/);
  const home = await fs.readFile(path.join(vault, 'Inicio.md'), 'utf8');
  assert.ok(home.includes(target.slice(0, -3) + '#^neuronas-a'));
  assert.ok(home.includes('#%5Eneuronas-b'));
  assert.equal(await fs.readFile(path.join(vault, '02 - Universidad/Apunte.md'), 'utf8'), '# Apunte\nNo alterar');
  assert.throws(() => planOrganization(files, { summary: '', groups: [{ title: 'Salir', files: [a, '../fuera.md'] }] }), /permitid|ruta|archivo/i);
  assert.throws(() => planOrganization(files, { summary: '', groups: [{ title: 'Curso', files: [a, '02 - Universidad/Apunte.md'] }] }), /permitid|categor|archivo/i);
});

test('el trabajo completo registra el asistente, aplica el plan y omite IA cuando no hay cambios', async t => {
  const { organize } = require('../src/organizer/run');
  const vault = await temp(t), state = await temp(t);
  const a = await store.saveMemory(vault, { id: 'a', type: 'learning', content: 'Aprender Neuronas' });
  const b = await store.saveMemory(vault, { id: 'b', type: 'learning', content: 'Mejorar Neuronas' });
  const names = [a.path, b.path].map(file => path.relative(vault, file).replaceAll('\\', '/'));
  const proposal = { summary: 'Aprendizajes sobre Neuronas', groups: [{ title: 'Neuronas', files: names }] };
  const providers = [{ name: 'real-child', command: process.execPath, args: ['-e', 'console.log(' + JSON.stringify(JSON.stringify(proposal)) + ')'] }];
  const result = await organize({ vault, state }, { providers, capture: false });
  assert.equal(result.provider, 'real-child'); assert.equal(result.groups, 1); assert.equal(result.changed, true);
  const second = await organize({ vault, state }, { providers: [], capture: false });
  assert.equal(second.skipped, 'unchanged');
  assert.equal((await store.readMemories(vault)).length, 2);
});

test('no fusiona encabezados iguales si las referencias dejarían de distinguir sus fuentes', () => {
  const { planOrganization } = require('../src/organizer/vault');
  const a = '09 - Memoria IA/Sesiones/A.md', b = '09 - Memoria IA/Sesiones/B.md';
  const r = { neuronas: 1, type: 'session', source: 'codex' };
  const files = new Map([[a, Buffer.from(renderBundle([{ ...r, id: 'a', content: '## Compartido\nPrimero' }], 'A'))], [b, Buffer.from(renderBundle([{ ...r, id: 'b', content: '## Compartido\nSegundo' }], 'B'))], ['Inicio.md', Buffer.from(`[[${a}#Compartido|A]] [[${b}#Compartido|B]]`)]]);
  assert.throws(() => planOrganization(files, { summary: '', groups: [{ title: 'Tema', files: [a, b] }] }), /encabezad|secci[oó]n|ambigu/i);
  files.set('Inicio.md', Buffer.from('# Inicio sin enlaces'));
  files.set('Mapa.canvas', Buffer.from(JSON.stringify({ nodes: [{ file: a, subpath: '#Compartido' }, { file: b, subpath: '#Compartido' }], edges: [] })));
  assert.throws(() => planOrganization(files, { summary: '', groups: [{ title: 'Tema', files: [a, b] }] }), /encabezad|secci[oó]n|ambigu/i);
  files.delete('Mapa.canvas');
  files.set('Inicio.md', Buffer.from(`[Fuente][a]\n\n[a]: <${a.split('/').map(encodeURIComponent).join('/')}#Compartido>`));
  assert.throws(() => planOrganization(files, { summary: '', groups: [{ title: 'Tema', files: [a, b] }] }), /encabezad|secci[oó]n|ambigu/i);
});

test('el protocolo AGY entrega el inventario solo después de confirmar herramientas vacías y lee su resultado anidado', async t => {
  const { requestWithFallback } = require('../src/organizer/providers');
  const cwd = await temp(t);
  const script = 'console.log(JSON.stringify({event:"init",init:{tools:[]}}));let text="";process.stdin.on("data",c=>text+=c);process.stdin.on("end",()=>{const e=JSON.parse(text);if(e.event!=="user")process.exit(2);console.log(JSON.stringify({event:"result",result:{status:"SUCCESS",structured_output:{summary:"Correcto",groups:[]}}}));});';
  const result = await requestWithFallback([{ name: 'AGY-fixture', command: process.execPath, args: ['-e', script], streamInput: true, requireEmptyTools: true }], 'Inventario privado', { cwd, validate: x => { assert.equal(x.summary, 'Correcto'); return x; } });
  assert.equal(result.provider, 'AGY-fixture');
});
