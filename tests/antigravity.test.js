const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
let handleAntigravityHook;
try { ({ handleAntigravityHook } = require('../src/antigravity')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
async function setup(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-agy-')); t.after(() => fs.rm(home, { recursive: true, force: true }));
  const config = { vault: path.join(home, 'vault'), state: path.join(home, 'state'), sources: [] }; await fs.mkdir(config.vault);
  return { home, config };
}
test('Antigravity recibe contexto de arranque y registra solo metadatos de sesión', async t => {
  assert.equal(typeof handleAntigravityHook, 'function'); const { home, config } = await setup(t);
  const { saveMemory } = require('../src/memory/store'); await saveMemory(config.vault, { content: 'Usar Obsidian para mis tareas de universidad', type: 'profile', project: 'Universidad' });
  const transcriptPath = path.join(home, '.gemini/antigravity-cli/brain/session-a/.system_generated/logs/transcript.jsonl');
  const input = { conversationId: 'session-a', transcriptPath, workspacePaths: ['C:/Universidad'], modelName: 'modelo', irrelevantSecret: 'NO REGISTRAR' };
  const result = await handleAntigravityHook('start', input, config, home);
  const context = result.injectSteps[0].systemMessage.systemMessage;
  assert.match(context, /tareas de universidad/); assert.ok(context.length <= 3200);
  const metadata = await fs.readFile(path.join(config.state, 'antigravity-sessions.json'), 'utf8');
  assert.match(metadata, /session-a/); assert.ok(!metadata.includes('NO REGISTRAR'));
});
test('el comando Windows conserva rutas con espacios y el JSON Unicode de los eventos', { skip: process.platform !== 'win32' }, async t => {
  const { buildAntigravityCommand } = require('../src/antigravity'); assert.equal(typeof buildAntigravityCommand, 'function');
  const { home } = await setup(t), repo = path.join(home, 'proyecto con espacios'); await fs.mkdir(path.join(repo, 'bin'), { recursive: true });
  await fs.writeFile(path.join(repo, 'bin/agy-hook.js'), "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log(JSON.stringify({payload:JSON.parse(s),args:process.argv.slice(2)})));" );
  const config = path.join(home, 'config con espacios.json'), command = buildAntigravityCommand(repo, config, 'start');
  const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', command], { input: JSON.stringify({ tema: 'Álgebra y estadística' }), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr); const output = JSON.parse(result.stdout);
  assert.equal(output.payload.tema, 'Álgebra y estadística'); assert.equal(output.args[2], config);
});
test('un evento Antigravity nunca fuerza a continuar ni importa rutas ajenas', async t => {
  assert.equal(typeof handleAntigravityHook, 'function'); const { home, config } = await setup(t);
  const result = await handleAntigravityHook('end', { conversationId: 'x', transcriptPath: path.join(home, 'credenciales.jsonl') }, config, home);
  assert.notEqual(result.decision, 'continue');
  assert.equal(await fs.readFile(path.join(config.state, 'antigravity-sessions.json'), 'utf8').catch(e => e.code), 'ENOENT');
});
