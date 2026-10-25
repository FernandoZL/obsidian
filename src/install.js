'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { hash, atomicWrite } = require('./memory/store');
const { initVault } = require('./init');
const { configPath } = require('./config');
const START = '<!-- NEURONAS START -->', END = '<!-- NEURONAS END -->';
const shellPath = value => '"' + value.replaceAll('\\', '/').replaceAll('"', '') + '"';
async function exists(p) { return !!(await fs.stat(p).catch(e => { if (e.code !== 'ENOENT') throw e; return null; })); }
async function install({ home = os.homedir(), vault, state, repo, previousVault, connectors = true, platform = 'win32', configFile, backups = true, configure }) {
  const shellPath = platform === 'linux' ? value => "'" + String(value).replaceAll("'", "'\\''") + "'" : value => '"' + value.replaceAll('\\', '/').replaceAll('"', '') + '"';
  if (!vault || !state || !repo) throw new Error('Rutas vault, state y repo requeridas');
  vault = path.resolve(vault); state = path.resolve(state); repo = path.resolve(repo);
  if (!(await exists(path.join(repo, 'dist/main.js')))) throw new Error('Ejecuta npm run build antes de instalar');
  if (state === vault || state.startsWith(vault + path.sep)) throw new Error('El estado debe quedar fuera de la bóveda');
  await fs.mkdir(state, { recursive: true });
  const manifestPath = path.join(state, 'installation.json');
  const manifest = await exists(manifestPath) ? JSON.parse(await fs.readFile(manifestPath, 'utf8')) : { version: 1, files: {} };
  const preserved = [];
  async function managed(file, content) {
    file = path.resolve(file);
    const present = await fs.readFile(file).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    const entry = manifest.files[file];
    if (entry?.digest && present && hash(present) !== entry.digest && !(entry.pending && hash(present) === entry.previousDigest)) {
      preserved.push(file); return false;
    }
    if (!manifest.files[file]) {
      const original = await fs.readFile(file).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
      const backup = backups && original ? path.join(state, 'backups', hash(file)) : null;
      if (backup) { await fs.mkdir(path.dirname(backup), { recursive: true }); await fs.writeFile(backup, original); }
      manifest.files[file] = { backup, digest: null, existed: original !== null };
    }
    manifest.files[file].previousDigest = present ? hash(present) : null;
    manifest.files[file].digest = hash(content);
    manifest.files[file].pending = true;
    // Write intent before touching the target. Failed manifest writes leave targets intact.
    await atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
    await fs.mkdir(path.dirname(file), { recursive: true }); await atomicWrite(file, content);
    if (platform === 'linux') await fs.chmod(file, 0o600);
    manifest.files[file].pending = false;
    await atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
  }
  async function json(file, transform) {
    let value = {}; if (await exists(file)) { const text = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''); if (text.trim()) value = JSON.parse(text); }
    await managed(file, JSON.stringify(transform(value), null, 2) + '\n');
  }
  async function copyTree(source, destination) {
    if (!(await exists(source))) return;
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const src = path.join(source, entry.name), dest = path.join(destination, entry.name);
      if (entry.isDirectory()) await copyTree(src, dest);
      else if (entry.isFile() && entry.name !== 'data.json') await managed(dest, await fs.readFile(src));
    }
  }
  await initVault(vault);
  await copyTree(path.join(repo, 'dist'), path.join(vault, '.obsidian/plugins/neuronas'));
  await json(path.join(vault, '.obsidian/plugins/neuronas/data.json'), old => ({ ...old, state, repo, openOnStart: old.openOnStart ?? true }));
  const enabled = ['neuronas'];
  for (const name of ['vault-ai', 'obsidian-tasks-plugin', 'obsidian-kanban', 'dataview', 'obsidian-excalidraw-plugin']) {
    const local = previousVault && path.join(previousVault, '.obsidian/plugins', name);
    const shipped = path.join(repo, 'vendor/obsidian', name);
    const legacy = path.join(repo, 'installer/payload/.obsidian/plugins', name);
    const source = local && await exists(local) ? local : await exists(shipped) ? shipped : legacy;
    if (!(await exists(source))) continue;
    await copyTree(source, path.join(vault, '.obsidian/plugins', name)); enabled.push(name);
    const localSettings = local && path.join(local, 'data.json');
    if (localSettings && await exists(localSettings) && !(await exists(path.join(vault, '.obsidian/plugins', name, 'data.json')))) {
      let value = JSON.parse((await fs.readFile(localSettings, 'utf8')).replace(/^\uFEFF/, ''));
      if (name === 'vault-ai') value = { ...value, autoProcess: false, initialized: true, processed: {} };
      await managed(path.join(vault, '.obsidian/plugins', name, 'data.json'), JSON.stringify(value, null, 2));
    }
  }
  await json(path.join(vault, '.obsidian/community-plugins.json'), old => [...new Set([...(Array.isArray(old) ? old : []), ...enabled])]);
  await json(path.join(vault, '.obsidian/core-plugins.json'), old => {
    const defaults = ['file-explorer', 'global-search', 'switcher', 'graph', 'backlink', 'outgoing-link', 'tag-pane', 'properties', 'page-preview', 'daily-notes', 'templates', 'note-composer', 'command-palette', 'bookmarks', 'outline', 'word-count', 'file-recovery'];
    return [...new Set([...(Array.isArray(old) ? old : Object.entries(old).filter(([, v]) => v).map(([k]) => k)), ...defaults])];
  });
  await json(path.join(vault, '.obsidian/app.json'), old => ({ ...old, defaultViewMode: 'preview', newFileLocation: 'folder', newFileFolderPath: '00 - Inbox', attachmentFolderPath: '07 - Recursos/Adjuntos', showUnsupportedFiles: false }));
  await json(path.join(vault, '.obsidian/appearance.json'), old => ({ ...old, theme: 'obsidian', accentColor: '#87d9ad', baseFontSize: 16 }));
  if (!(await exists(path.join(vault, '.obsidian/graph.json')))) await managed(path.join(vault, '.obsidian/graph.json'), JSON.stringify({ search: '-path:"07 - Recursos"', showTags: false, showAttachments: false, hideUnresolved: true, showOrphans: false, colorGroups: [{ query: 'path:"09 - Memoria IA/Sesiones"', color: { a: 1, rgb: 8492477 } }, { query: 'path:"09 - Memoria IA/Decisiones"', color: { a: 1, rgb: 8903085 } }, { query: 'path:"09 - Memoria IA/Proyectos"', color: { a: 1, rgb: 15647901 } }], nodeSizeMultiplier: 1.2, lineSizeMultiplier: 1, centerStrength: .5, repelStrength: 12, linkStrength: 1, linkDistance: 180 }, null, 2));
  const globalConfig = configFile || configPath(home);
  const cfg = connectors ? globalConfig : path.join(state,'config.json');
  await managed(cfg, JSON.stringify({ vault, state, repo,connectors }, null, 2));
  await managed(path.join(path.dirname(globalConfig),'last-setup.json'),JSON.stringify({vault,state,repo,connectors},null,2));
  const instruction = require('./instructions').sharedInstructions({ vault, repo, config: cfg, quote: shellPath });
  if (connectors) {
    for (const relative of ['.codex/AGENTS.md', '.claude/CLAUDE.md', '.gemini/GEMINI.md']) {
      const file = path.join(home, relative);
      const original = await fs.readFile(file, 'utf8').catch(e => { if (e.code !== 'ENOENT') throw e; return ''; });
      const stripped = original.replace(/<!-- NEURONAS START -->[\s\S]*?<!-- NEURONAS END -->\s*/g, '').trimEnd();
      await managed(file, (stripped ? stripped + '\n\n' : '') + instruction + '\n');
    }
    const mcp = { command: process.execPath, args: [path.join(repo, 'bin/mcp.js'), '--config', cfg] };
    for (const relative of ['.cursor/mcp.json', '.copilot/mcp-config.json', '.claude.json']) {
      await json(path.join(home, relative), old => ({ ...old, mcpServers: { ...old.mcpServers, neuronas: mcp } }));
    }
    const windsurf = path.join(home, '.codeium/windsurf/mcp_config.json');
    if (await exists(windsurf)) await json(windsurf, old => ({ ...old, mcpServers: { ...old.mcpServers, neuronas: mcp } }));
    for (const app of ['claude', 'gemini']) {
      await json(path.join(home, '.' + app, 'settings.json'), old => {
        const hooks = { ...old.hooks };
        for (const [event, action] of [['SessionStart', 'start'], [app === 'claude' ? 'Stop' : 'AfterAgent', 'end']]) {
          const existing = (hooks[event] || []).map(group => ({ ...group, hooks: (group.hooks || []).filter(h => !String(h.command).includes('/bin/hook.js') && !String(h.command).includes('\\bin\\hook.js')) })).filter(g => g.hooks.length);
          const command = `${shellPath(process.execPath)} ${shellPath(path.join(repo, 'bin/hook.js'))} ${action} ${app} --config ${shellPath(cfg)}`;
          hooks[event] = [...existing, { matcher: '', hooks: [{ type: 'command', command, timeout: app === 'gemini' ? 10000 : 10 }] }];
        }
        return { ...old, hooks, ...(app === 'gemini' ? { mcpServers: { ...old.mcpServers, neuronas: mcp } } : {}) };
      });
    }
    await json(path.join(home, '.gemini/config/mcp_config.json'), old => ({ ...old, mcpServers: { ...old.mcpServers, neuronas: mcp } }));
    await json(path.join(home, '.gemini/config/hooks.json'), old => ({
      ...old,
      neuronas: {
        enabled: true,
        SessionStart: [{ type: 'command', command: require('./antigravity').buildAntigravityCommand(repo, cfg, 'start'), timeout: 10 }],
        Stop: [{ type: 'command', command: require('./antigravity').buildAntigravityCommand(repo, cfg, 'end'), timeout: 20 }]
      }
    }));
    const toml = path.join(home, '.codex/config.toml');
    const current = await fs.readFile(toml, 'utf8').catch(e => { if (e.code !== 'ENOENT') throw e; return ''; });
    const stripped = current.replace(/\[mcp_servers\.neuronas\][\s\S]*?(?=\n\[|$)/g, '').trimEnd();
    await managed(toml, `${stripped}\n\n[mcp_servers.neuronas]\ncommand = ${JSON.stringify(process.execPath)}\nargs = ${JSON.stringify(mcp.args)}\nstartup_timeout_sec = 10\n`);
  }
  const syncCommand = `${shellPath(process.execPath)} ${shellPath(path.join(repo, 'bin/memory.js'))} sync --quiet --config ${shellPath(cfg)}`;
  if (platform === 'win32') await managed(path.join(state, 'sync-hidden.vbs'), `Set shell = CreateObject("WScript.Shell")\nshell.Run "${syncCommand.replaceAll('"', '""')}", 0, True\n`);
  if (configure) await configure({ managed, json, config: cfg, instruction, quote: shellPath });
  manifest.vault = vault; manifest.repo = repo; manifest.config = cfg;
  await atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
  return { vault, state, config: cfg, managed: Object.keys(manifest.files).length, enabled, preserved };
}
async function uninstall({ state }) {
  const file = path.join(state, 'installation.json'); const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  const conflicts = [], restored = [];
  for (const [target, entry] of Object.entries(manifest.files).reverse()) {
    const current = await fs.readFile(target).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    if (current && hash(current) !== entry.digest && !(entry.pending && hash(current) === entry.previousDigest)) { conflicts.push(target); continue; }
    if (entry.existed && !entry.backup) { conflicts.push(target); continue; }
    if (entry.backup) await atomicWrite(target, await fs.readFile(entry.backup));
    else await fs.unlink(target).catch(e => { if (e.code !== 'ENOENT') throw e; });
    delete manifest.files[target]; restored.push(target);
  }
  await atomicWrite(file, JSON.stringify(manifest, null, 2));
  return { restored: restored.length, conflicts };
}
module.exports = { install, uninstall };
