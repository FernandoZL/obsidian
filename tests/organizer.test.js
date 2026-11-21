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

test('si otra consola guarda una nota mientras la IA responde, aplica el plan y conserva la nota nueva', async t => {
  const { organize } = require('../src/organizer/run');
  const vault = await temp(t), state = await temp(t);
  const a = await store.saveMemory(vault, { id: 'a', type: 'learning', content: 'Aprender Neuronas' });
  const b = await store.saveMemory(vault, { id: 'b', type: 'learning', content: 'Mejorar Neuronas' });
  const names = [a.path, b.path].map(file => path.relative(vault, file).replaceAll('\\', '/'));
  const proposal = { summary: 'Aprendizajes sobre Neuronas', groups: [{ title: 'Neuronas', files: names }] };
  const late = path.join(vault, 'Nota simultánea.md');
  const script = `require('node:fs').writeFileSync(${JSON.stringify(late)},'Escrita durante la consulta');console.log(${JSON.stringify(JSON.stringify(proposal))})`;
  const result = await organize({ vault, state }, { providers: [{ name: 'concurrente', command: process.execPath, args: ['-e', script] }], capture: false });
  assert.equal(result.success, true); assert.equal(result.changed, true);
  assert.equal(await fs.readFile(late, 'utf8'), 'Escrita durante la consulta');
  assert.equal((await store.readMemories(vault)).length, 2);
});

test('rellena Inicio sin Obsidian abierto, conserva lo escrito a mano y no cambia en la segunda pasada', async t => {
  const { refreshPages } = require('../src/organizer/refresh');
  const vault = await temp(t);
  await fs.mkdir(path.join(vault, '00 - Inbox'), { recursive: true });
  await fs.writeFile(path.join(vault, 'Inicio.md'), '# Mi espacio\n\nEscrito a mano\n');
  await fs.writeFile(path.join(vault, '00 - Inbox/Idea nueva.md'), '# Idea nueva\n\nContenido\n');
  const first = await refreshPages(vault);
  assert.deepEqual(first.errors, []);
  const home = await fs.readFile(path.join(vault, 'Inicio.md'), 'utf8');
  assert.match(home, /Escrito a mano/); assert.match(home, /Notas recientes/); assert.match(home, /Idea nueva/);
  const network = await fs.readFile(path.join(vault, '05 - Conocimiento/Red automática/Red automática.md'), 'utf8');
  assert.match(network, /Idea nueva/);
  await refreshPages(vault);
  assert.equal(await fs.readFile(path.join(vault, 'Inicio.md'), 'utf8'), home);
});

test('quita del grafo las copias sin contenido propio, redirige enlaces y conserva lo que sea distinto', async t => {
  const { removeCopies } = require('../src/organizer/duplicates');
  const vault = await temp(t), state = await temp(t), write = (name, text) => fs.writeFile(path.join(vault, name), text);
  await write('Guía.md', '# Guía\n\nTexto completo\n\nMás texto\n');
  await write('Guía(1).md', '# Guía\n\nTexto completo\n');
  await write('Plan.md', '# Plan\n\nOriginal\n');
  await write('Plan 2.md', '# Plan\n\nIdea que solo está aquí\n');
  await write('Semana.md', '# Semana\n');
  await write('Semana 2.md', '# Semana 2\n\nOtro tema\n');
  await write('Índice.md', '[[Guía(1)|Abrir guía]]\n');
  const result = await removeCopies(vault, state);
  assert.deepEqual(result.removed, ['Guía(1).md']);
  await assert.rejects(fs.access(path.join(vault, 'Guía(1).md')));
  assert.match(await fs.readFile(path.join(vault, 'Índice.md'), 'utf8'), /\[\[Guía\|Abrir guía\]\]/);
  assert.match(await fs.readFile(path.join(vault, 'Plan 2.md'), 'utf8'), /solo está aquí/);
  await fs.access(path.join(vault, 'Semana 2.md'));
  assert.ok(result.backup);
  assert.deepEqual((await removeCopies(vault, state)).removed, []);
});

test('un proyecto escrito con otras mayúsculas usa la misma nota y no crea un nodo repetido', async t => {
  const vault = await temp(t);
  await store.saveMemory(vault, { id: 'a', type: 'learning', project: 'obsidian', content: 'Primero' });
  await store.saveMemory(vault, { id: 'b', type: 'learning', project: 'Obsidian', content: 'Segundo' });
  const hubs = (await fs.readdir(path.join(vault, '09 - Memoria IA/Proyectos'))).filter(name => /^Recuerdos de obsidian/i.test(name));
  assert.deepEqual(hubs, ['Recuerdos de obsidian.md']);
});

test('un tema que solo cambia en mayúsculas no pisa la nota existente y reutiliza la propia si está en el grupo', () => {
  const { planOrganization } = require('../src/organizer/vault');
  const folder = '09 - Memoria IA/Decisiones/', record = { neuronas: 1, type: 'decision', source: 'codex' };
  const note = (id, title) => Buffer.from(renderBundle([{ ...record, id, content: 'Contenido ' + id }], title));
  const existing = folder + 'Decisiones · obsidian.md', a = folder + 'A.md', b = folder + 'B.md';
  const files = new Map([[existing, note('e', 'Existente')], [a, note('a', 'A')], [b, note('b', 'B')]]);
  assert.throws(() => planOrganization(files, { summary: '', groups: [{ title: 'Proyecto Obsidian', files: [a, b] }] }), /destino ya existe/i);
  const plan = planOrganization(files, { summary: '', groups: [{ title: 'Proyecto Obsidian', files: [existing, a] }] });
  assert.ok(plan.output.has(existing)); assert.ok(!plan.remove.has(existing)); assert.ok(plan.remove.has(a));
  assert.ok(![...plan.output.keys()].includes(folder + 'Decisiones · Obsidian.md'));
});

test('el mismo tema en dos categorías produce nombres distintos en el grafo', () => {
  const { topicPath } = require('../src/organizer/vault');
  assert.equal(topicPath('09 - Memoria IA/Aprendizajes', 'Proyecto Orca (Neuronas)'), '09 - Memoria IA/Aprendizajes/Aprendizajes · Orca.md');
  assert.equal(topicPath('09 - Memoria IA/Decisiones', 'Proyecto Orca (Neuronas)'), '09 - Memoria IA/Decisiones/Decisiones · Orca.md');
});

test('conserva los grupos válidos de un plan de IA y descarta solo el inválido', () => {
  const { salvageProposal } = require('../src/organizer/vault');
  const folder = '09 - Memoria IA/Decisiones/', record = { neuronas: 1, type: 'decision', source: 'codex' };
  const note = id => Buffer.from(renderBundle([{ ...record, id, content: 'Contenido ' + id }], id));
  const [a, b, c] = ['A', 'B', 'C'].map(name => folder + name + '.md');
  const files = new Map([[a, note('a')], [b, note('b')], [c, note('c')]]);
  const safe = salvageProposal(files, { summary: 'Plan', groups: [{ title: 'Bueno', files: [a, b] }, { title: 'Repite', files: [b, c] }] });
  assert.deepEqual(safe.groups.map(group => group.title), ['Bueno']);
  assert.throws(() => salvageProposal(files, { summary: 'Plan', groups: [{ title: 'Malo', files: [a, 'no-existe.md'] }] }), /Ningún grupo/);
});

test('restaura la configuración renombrada por iCloud y saca los conflictos de la bóveda', async t => {
  const { repairConfig } = require('../src/organizer/config-repair');
  const vault = await temp(t), state = await temp(t), config = path.join(vault, '.obsidian');
  await fs.mkdir(path.join(config, 'plugins/neuronas'), { recursive: true });
  await fs.writeFile(path.join(config, 'graph(1).json'), '{"version":"vieja"}');
  await fs.utimes(path.join(config, 'graph(1).json'), new Date(1000), new Date(1000));
  await fs.writeFile(path.join(config, 'graph 2.json'), '{"version":"nueva"}');
  await fs.writeFile(path.join(config, 'graph 3.json'), '{dañado');
  await fs.writeFile(path.join(config, 'app.json'), '{"propio":true}');
  await fs.writeFile(path.join(config, 'app 2.json'), '{"propio":false}');
  await fs.writeFile(path.join(config, 'mi nota 2.json'), '{}');
  const result = await repairConfig(vault, state);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.restored, ['.obsidian/graph.json']); assert.equal(result.moved, 4);
  assert.equal(await fs.readFile(path.join(config, 'graph.json'), 'utf8'), '{"version":"nueva"}');
  assert.equal(await fs.readFile(path.join(config, 'app.json'), 'utf8'), '{"propio":true}');
  assert.deepEqual((await fs.readdir(config)).filter(name => name.endsWith('.json')).sort(), ['app.json', 'graph.json', 'mi nota 2.json']);
  assert.equal(await fs.readFile(path.join(result.backup, '.obsidian/app 2.json'), 'utf8'), '{"propio":false}');
});

test('recupera el mapa renombrado por iCloud sin Obsidian abierto y corrige sus enlaces', async t => {
  const { refreshPages } = require('../src/organizer/refresh');
  const vault = await temp(t), folder = '05 - Conocimiento/Red automática';
  await fs.mkdir(path.join(vault, folder), { recursive: true });
  await fs.mkdir(path.join(vault, '00 - Inbox'), { recursive: true });
  await fs.writeFile(path.join(vault, folder, 'Red automática(1).md'), 'Escrito a mano\n\n<!-- NEURONAS AUTO NETWORK -->\nviejo\n<!-- /NEURONAS AUTO NETWORK -->\n');
  await fs.writeFile(path.join(vault, '00 - Inbox/Idea.md'), `# Idea\n\n[[${folder}/Red automática(1)|Mapa]]\n`);
  const result = await refreshPages(vault);
  assert.deepEqual(result.errors, []);
  await assert.rejects(fs.access(path.join(vault, folder, 'Red automática(1).md')));
  const map = await fs.readFile(path.join(vault, folder, 'Red automática.md'), 'utf8');
  assert.match(map, /Escrito a mano/); assert.match(map, /Idea/); assert.doesNotMatch(map, /viejo/);
  assert.ok((await fs.readFile(path.join(vault, '00 - Inbox/Idea.md'), 'utf8')).includes(`[[${folder}/Red automática|Mapa]]`));
});

test('une varias copias del mapa sin original y no toca las que tienen texto propio distinto', async t => {
  const { removeCopies } = require('../src/organizer/duplicates');
  const block = text => `<!-- NEURONAS AUTO NETWORK -->\n${text}\n<!-- /NEURONAS AUTO NETWORK -->\n`;
  const vault = await temp(t), state = await temp(t), folder = path.join(vault, '05 - Conocimiento/Red automática');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'Red automática 2.md'), 'Mi nota\n\n' + block('uno'));
  await fs.writeFile(path.join(folder, 'Red automática(1).md'), block('dos'));
  await fs.writeFile(path.join(vault, 'Índice.md'), '[[05 - Conocimiento/Red automática/Red automática(1)|Mapa]]\n');
  const result = await removeCopies(vault, state);
  assert.equal(result.error, undefined); assert.equal(result.removed.length, 2);
  assert.deepEqual(await fs.readdir(folder), ['Red automática.md']);
  assert.match(await fs.readFile(path.join(folder, 'Red automática.md'), 'utf8'), /Mi nota/);
  assert.match(await fs.readFile(path.join(vault, 'Índice.md'), 'utf8'), /\[\[05 - Conocimiento\/Red automática\/Red automática\|Mapa\]\]/);
  await fs.rm(path.join(folder, 'Red automática.md'));
  await fs.writeFile(path.join(folder, 'Red automática 2.md'), 'Texto A\n\n' + block('uno'));
  await fs.writeFile(path.join(folder, 'Red automática(1).md'), 'Texto B\n\n' + block('dos'));
  assert.deepEqual((await removeCopies(vault, state)).removed, []);
  assert.equal((await fs.readdir(folder)).length, 2);
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
