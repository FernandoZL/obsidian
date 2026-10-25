'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

test('Linux instala servicios y conectores compartidos sin escribir configuración Windows', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-linux-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const vault = path.join(home, 'Mis notas'), repo = path.resolve(__dirname, '..');
  const { installLinux } = require('../src/linux');
  const original = { mcpServers: { personal: { command: 'personal' } }, preference: 'KEEP' };
  await fs.mkdir(path.join(home, '.gemini/config'), { recursive: true });
  await fs.writeFile(path.join(home, '.gemini/config/mcp_config.json'), JSON.stringify(original));
  const result = await installLinux({ home, vault, repo });
  assert.equal(result.config, path.join(home, '.config/neuronas/config.json'));
  const settings = JSON.parse(await fs.readFile(path.join(home, '.gemini/config/mcp_config.json')));
  assert.equal(settings.mcpServers.personal.command, 'personal');
  assert.equal(settings.preference, 'KEEP');
  assert.equal(settings.mcpServers.neuronas.args.at(-1), result.config);
  if (process.platform === 'linux') assert.equal((await fs.stat(path.join(home, '.claude.json'))).mode & 0o777, 0o600);
  const agents = await fs.readFile(path.join(home, '.codex/AGENTS.md'), 'utf8');
  assert.match(agents, /Codex, Claude, Gemini y Antigravity/);
  assert.match(agents, /notas completas/);
  assert.match(await fs.readFile(path.join(home, '.config/systemd/user/neuronas-memory.timer'), 'utf8'), /OnUnitInactiveSec=60/);
  assert.match(await fs.readFile(path.join(home, '.config/systemd/user/neuronas-icloud.timer'), 'utf8'), /OnUnitInactiveSec=180/);
  await assert.rejects(fs.access(path.join(home, 'AppData')), /ENOENT/);
  await assert.rejects(fs.access(path.join(result.state, 'sync-hidden.vbs')), /ENOENT/);
  await assert.rejects(fs.access(path.join(result.state, 'backups')), /ENOENT/);
  assert.equal(JSON.parse(await fs.readFile(path.join(home, '.config/neuronas/icloud-policy.json'))).backups, false);
  await installLinux({ home, vault, repo });
  const rules = await fs.readFile(path.join(home, '.codex/AGENTS.md'), 'utf8');
  assert.equal((rules.match(/NEURONAS START/g) || []).length, 1);
  const { uninstall } = require('../src/install');
  await uninstall({ state: result.state });
  assert.equal(JSON.parse(await fs.readFile(path.join(home, '.gemini/config/mcp_config.json'))).preference, 'KEEP');
  await fs.access(vault);
});

test('Linux sin conectores no redirige la configuración global de otra bóveda', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-linux-isolated-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const { installLinux } = require('../src/linux');
  const repo = path.resolve(__dirname, '..');
  const first = await installLinux({ home, repo, vault: path.join(home, 'primera') });
  const original = await fs.readFile(first.config, 'utf8');
  const second = await installLinux({ home, repo, vault: path.join(home, 'segunda'), connectors: false });
  assert.equal(await fs.readFile(first.config, 'utf8'), original);
  assert.notEqual(second.config, first.config);
  assert.equal(JSON.parse(await fs.readFile(second.config)).vault, path.join(home, 'segunda'));
});

test('instalación Windows conserva rutas y VBS e instala la regla de acceso cruzado', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-win-rule-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const { install } = require('../src/install');
  const state = path.join(home, 'state');
  const result = await install({ home, state, vault: path.join(home, 'vault'), repo: path.resolve(__dirname, '..') });
  assert.equal(result.config, path.join(home, 'AppData/Local/ObsidianNeuronas/config.json'));
  assert.match(await fs.readFile(path.join(state, 'sync-hidden.vbs'), 'utf8'), /WScript.Shell/);
  const rules = await fs.readFile(path.join(home, '.claude/CLAUDE.md'), 'utf8');
  assert.match(rules, /Codex, Claude, Gemini y Antigravity/);
  assert.match(rules, /notas completas/);
});

test('Linux retira solo sus conectores y conserva las notas y las preferencias del usuario', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-linux-remove-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const { installLinux, uninstallLinux } = require('../src/linux');
  await fs.mkdir(path.join(home, '.claude'), { recursive: true });
  await fs.writeFile(path.join(home, '.claude/settings.json'), JSON.stringify({ preference: 'KEEP' }));
  const result = await installLinux({ home, repo: path.resolve(__dirname, '..'), vault: path.join(home, 'vault') });
  await fs.writeFile(path.join(home, 'vault', 'Mi nota.md'), 'Nota personal');
  await uninstallLinux({ home, state: result.state });
  const settings = JSON.parse(await fs.readFile(path.join(home, '.claude/settings.json')));
  assert.equal(settings.preference, 'KEEP');
  assert.equal(settings.hooks, undefined);
  assert.equal(await fs.readFile(path.join(home, 'vault/Mi nota.md'), 'utf8'), 'Nota personal');
  const claude = JSON.parse(await fs.readFile(path.join(home, '.claude.json')));
  assert.equal(claude.mcpServers?.neuronas, undefined);
  assert.doesNotMatch(await fs.readFile(path.join(home, '.codex/config.toml'), 'utf8'), /mcp_servers.neuronas/);
  await assert.rejects(fs.access(path.join(home, '.config/systemd/user/neuronas-memory.timer')), /ENOENT/);
});

test('Linux genera comandos ejecutables con espacios y metacaracteres sin ejecutar texto de las rutas', { skip: process.platform !== 'linux' }, async t => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-shell-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const home = path.join(base, "Perfil O'Brien $literal %");
  const { installLinux } = require('../src/linux');
  await installLinux({ home, repo: path.resolve(__dirname, '..'), vault: path.join(home, 'Mis notas') });
  const { spawnSync } = require('node:child_process');
  const response = spawnSync(path.join(home, '.local/bin/neuronas'), ['status'], { encoding: 'utf8' });
  assert.equal(response.status, 0, response.stderr);
  assert.equal(JSON.parse(response.stdout).vault, path.join(home, 'Mis notas'));
  const verify = spawnSync('systemd-analyze', ['--user', 'verify', ...['neuronas-memory.service', 'neuronas-icloud.service'].map(name => path.join(home, '.config/systemd/user', name))], { encoding: 'utf8' });
  if (!verify.error) assert.equal(verify.status, 0, verify.stderr);
});
