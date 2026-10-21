const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
let install, uninstall; try { ({ install, uninstall } = require('../src/install')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('instalar sin conectores en otra bóveda no redirige conexiones anteriores',async t=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'neuronas-no-connectors-'));t.after(()=>fs.rm(home,{recursive:true,force:true}));const {configPath}=require('../src/config');const repo=path.resolve(__dirname,'..');
  await install({home,repo,vault:path.join(home,'primera'),state:path.join(home,'state-1')});const before=await fs.readFile(configPath(home),'utf8');
  await install({home,repo,vault:path.join(home,'segunda'),state:path.join(home,'state-2'),connectors:false});
  assert.equal(await fs.readFile(configPath(home),'utf8'),before);const local=JSON.parse(await fs.readFile(path.join(home,'state-2/config.json'),'utf8'));assert.equal(local.vault,path.join(home,'segunda'));
});
test('instala dos veces, conserva conectores previos y revierte sin borrar memorias', async t => {
  assert.equal(typeof install, 'function');
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-install-')); t.after(() => fs.rm(home, { recursive: true, force: true }));
  const vault = path.join(home, 'vault'), state = path.join(home, 'state'), settings = path.join(home, '.gemini/settings.json');
  await fs.mkdir(path.dirname(settings), { recursive: true });
  const original = { security: { auth: { selectedType: 'oauth-personal' } }, mcpServers: { existing: { command: 'existing' } } };
  await fs.writeFile(settings, JSON.stringify(original));
  const config = { home, vault, state, repo: path.resolve(__dirname, '..'), connectors: true };
  await install(config); await install(config);
  const after = JSON.parse(await fs.readFile(settings, 'utf8'));
  assert.equal(after.security.auth.selectedType, 'oauth-personal'); assert.equal(after.mcpServers.existing.command, 'existing');
  assert.ok(after.mcpServers.neuronas); assert.equal(after.hooks.SessionStart.length, 1);
  assert.equal(after.hooks.AfterAgent.length, 1);
  const agyMcp = JSON.parse(await fs.readFile(path.join(home, '.gemini/config/mcp_config.json'), 'utf8'));
  assert.ok(agyMcp.mcpServers.neuronas);
  const agyHooks = JSON.parse(await fs.readFile(path.join(home, '.gemini/config/hooks.json'), 'utf8'));
  assert.equal(agyHooks.neuronas.SessionStart.length, 1); assert.equal(agyHooks.neuronas.Stop.length, 1);
  const { saveMemory } = require('../src/memory/store');
  const saved = await saveMemory(vault, { id: 'permanente', content: 'Una decisión que se conserva' });
  const result = await uninstall({ state }); assert.deepEqual(result.conflicts, []);
  assert.deepEqual(JSON.parse(await fs.readFile(settings, 'utf8')), original);
  assert.match(await fs.readFile(saved.path, 'utf8'), /Una decisión que se conserva/);
});
test('no revierte un archivo editado después de instalar', async t => {
  assert.equal(typeof install, 'function');
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-uninstall-')); t.after(() => fs.rm(home, { recursive: true, force: true }));
  const state = path.join(home, 'state'); await install({ home, state, vault: path.join(home, 'vault'), repo: path.resolve(__dirname, '..') });
  const file = path.join(home, '.codex/AGENTS.md'); await fs.appendFile(file, '\nRegla personal nueva.\n');
  const result = await uninstall({ state }); assert.ok(result.conflicts.includes(file)); assert.match(await fs.readFile(file, 'utf8'), /Regla personal nueva/);
});
test('reinstalar no adopta preferencias nuevas como si fueran del instalador', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-pref-')); t.after(() => fs.rm(home, { recursive: true, force: true }));
  const config = { home, state: path.join(home, 'state'), vault: path.join(home, 'vault'), repo: path.resolve(__dirname, '..') };
  await install(config); const file = path.join(home, '.claude/settings.json');
  const settings = JSON.parse(await fs.readFile(file, 'utf8')); settings.newUserPreference = 'KEEP'; await fs.writeFile(file, JSON.stringify(settings));
  await install(config); const result = await uninstall(config);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).newUserPreference, 'KEEP'); assert.ok(result.conflicts.includes(file));
});
test('fallar al registrar manifiesto no modifica archivos administrados', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-intent-')); t.after(() => fs.rm(home, { recursive: true, force: true }));
  const state = path.join(home, 'state'), vault = path.join(home, 'vault'), original = fs.rename;
  fs.rename = async (from, to) => { if (to === path.join(state, 'installation.json')) throw new Error('interrupción simulada'); return original(from, to); };
  try { await assert.rejects(install({ home, vault, state, repo: path.resolve(__dirname, '..') }), /interrupción/); }
  finally { fs.rename = original; }
  await assert.rejects(fs.access(path.join(vault, '.obsidian/plugins/neuronas/main.js')), /ENOENT/);
});
test('recuperar instalación pendiente conserva preferencias añadidas durante la interrupción', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-pending-')); t.after(() => fs.rm(home, { recursive: true, force: true }));
  const config = { home, state: path.join(home, 'state'), vault: path.join(home, 'vault'), repo: path.resolve(__dirname, '..') };
  const file = path.join(config.vault, '.obsidian/app.json'); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify({ original: true }));
  const rename = fs.rename; fs.rename = async (from, to) => { if (to === file) throw new Error('interrupción'); return rename(from, to); };
  try { await assert.rejects(install(config), /interrupción/); } finally { fs.rename = rename; }
  await fs.writeFile(file, JSON.stringify({ original: true, newPersonalPreference: 'KEEP' })); await install(config); await uninstall(config);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).newPersonalPreference, 'KEEP');
});
