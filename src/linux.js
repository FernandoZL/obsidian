'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { install, uninstall } = require('./install');
const { hash } = require('./memory/store');

function systemdArg(value) {
  if (/[\r\n\0]/.test(value)) throw new Error('Las rutas no pueden contener saltos de línea ni NUL');
  return '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%').replaceAll('$', '$$') + '"';
}
async function installLinux({ home = os.homedir(), vault, repo = path.resolve(__dirname, '..'), state, connectors = true } = {}) {
  home = path.resolve(home);
  if (!vault) throw new Error('Indica --vault <carpeta de tu bóveda>');
  vault = path.resolve(vault); repo = path.resolve(repo);
  state = path.resolve(state || path.join(home, '.local/state/neuronas', hash(vault)));
  for (const value of [home, vault, repo, state, process.execPath]) systemdArg(value);
  const directory = path.join(home, '.config/neuronas');
  const configFile = path.join(directory, 'config.json');
  const runtime = path.join(home, '.local/share/neuronas-linux');
  return install({ home, vault, state, repo, connectors, platform: 'linux', configFile, backups: false,
    configure: async ({ managed, json, config, instruction, quote }) => {
      // A plugin-only installation in a second vault must not redirect global services.
      if (!connectors) return;
      await managed(path.join(home, '.gemini/config/rules/neuronas.md'), instruction + '\n');
      for (const name of ['icloud_sync.py', 'icloud_connect.py']) {
        await managed(path.join(runtime, name), await fs.readFile(path.join(repo, 'scripts/linux', name)));
      }
      await managed(path.join(directory, 'icloud-filters.txt'), await fs.readFile(path.join(repo, 'scripts/linux/icloud-filters.txt')));
      await json(path.join(directory, 'icloud-policy.json'), old => ({ ...old, backups: false, conflictResolve: 'newer', conflictLoser: 'delete' }));
      for (const [name, script] of [['icloud-conectar', 'icloud_connect.py'], ['icloud-sincronizar', 'icloud_sync.py']]) {
        const file = path.join(home, '.local/bin', name);
        await managed(file, `#!/bin/sh\nexec python3 ${quote(path.join(runtime, script))} "$@"\n`);
        await fs.chmod(file, 0o700);
      }
      const renew = path.join(home, '.local/bin/icloud-renovar');
      await managed(renew, '#!/bin/sh\nexec rclone config reconnect neuronas-icloud:\n'); await fs.chmod(renew, 0o700);
      const memory = path.join(home, '.local/bin/neuronas');
      await managed(memory, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(path.join(repo, 'bin/memory.js'))} --config ${quote(config)} "$@"\n`);
      await fs.chmod(memory, 0o700);
      const units = path.join(home, '.config/systemd/user');
      const unit = name => path.join(units, name);
      await managed(unit('neuronas-memory.service'), `[Unit]\nDescription=Captura de memoria compartida de consolas\n\n[Service]\nType=oneshot\nUMask=0077\nExecStart=${[process.execPath, path.join(repo, 'bin/memory.js'), 'sync', '--quiet', '--config', config].map(systemdArg).join(' ')}\nTimeoutStartSec=300\nNice=10\n`);
      await managed(unit('neuronas-memory.timer'), '[Unit]\nDescription=Capturar memoria cada minuto\n\n[Timer]\nOnStartupSec=20\nOnUnitInactiveSec=60\nAccuracySec=5\nUnit=neuronas-memory.service\n\n[Install]\nWantedBy=timers.target\n');
      await managed(unit('neuronas-icloud.service'), `[Unit]\nDescription=Sincronizar Obsidian con iCloud\nConditionPathExists=${systemdArg(path.join(directory, 'icloud.json'))}\nConditionPathExists=${systemdArg(path.join(home, '.local/state/neuronas/icloud/initialized.json'))}\n\n[Service]\nType=oneshot\nUMask=0077\nExecStart=/usr/bin/env python3 ${systemdArg(path.join(runtime, 'icloud_sync.py'))}\nTimeoutStartSec=2h\nNice=10\n`);
      await managed(unit('neuronas-icloud.timer'), '[Unit]\nDescription=Sincronizar Obsidian con iCloud cada tres minutos\n\n[Timer]\nOnStartupSec=90\nOnUnitInactiveSec=180\nAccuracySec=10\nUnit=neuronas-icloud.service\n\n[Install]\nWantedBy=timers.target\n');
    } });
}
async function uninstallLinux({ home = os.homedir(), state, beforeRemove } = {}) {
  if (!state) throw new Error('Falta el directorio de estado de la instalación');
  const manifest = JSON.parse(await fs.readFile(path.join(state, 'installation.json'), 'utf8'));
  let current;
  try { current = JSON.parse(await fs.readFile(manifest.config, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current && path.resolve(current.vault) !== path.resolve(manifest.vault)) throw new Error('Otra bóveda utiliza ahora los conectores; no se desinstala la instalación anterior automáticamente.');
  if (beforeRemove) await beforeRemove();
  const config = manifest.config;
  const owned = mcp => mcp?.args?.includes(config);
  for (const relative of ['.claude.json', '.gemini/settings.json', '.gemini/config/mcp_config.json', '.cursor/mcp.json', '.copilot/mcp-config.json', '.codeium/windsurf/mcp_config.json']) {
    const file = path.join(home, relative);
    let text; try { text = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!text.trim()) continue;
    const data = JSON.parse(text);
    if (owned(data.mcpServers?.neuronas)) { delete data.mcpServers.neuronas; await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n'); }
  }
  for (const relative of ['.claude/settings.json', '.gemini/settings.json']) {
    const file = path.join(home, relative);
    let text; try { text = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!text.trim()) continue;
    const data = JSON.parse(text);
    for (const [event, groups] of Object.entries(data.hooks || {})) {
      if (!Array.isArray(groups)) continue;
      data.hooks[event] = groups.map(group => ({ ...group, hooks: (group.hooks || []).filter(hook => !String(hook.command).includes(config)) })).filter(group => group.hooks.length);
      if (!data.hooks[event].length) delete data.hooks[event];
    }
    if (data.hooks && !Object.keys(data.hooks).length) delete data.hooks;
    await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
  }
  const agyHooks = path.join(home, '.gemini/config/hooks.json');
  try {
    const data = JSON.parse(await fs.readFile(agyHooks, 'utf8'));
    if ((data.neuronas?.SessionStart || []).some(hook => String(hook.command).includes(config))) {
      delete data.neuronas; await fs.writeFile(agyHooks, JSON.stringify(data, null, 2) + '\n');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const toml = path.join(home, '.codex/config.toml');
  try {
    const text = await fs.readFile(toml, 'utf8');
    const next = text.replace(/\[mcp_servers\.neuronas\][\s\S]*?(?=\n\[|$)/g, block => block.includes(JSON.stringify(config)) ? '' : block);
    if (text !== next) await fs.writeFile(toml, next);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const relative of ['.codex/AGENTS.md', '.claude/CLAUDE.md', '.gemini/GEMINI.md', '.gemini/config/rules/neuronas.md']) {
    const file = path.join(home, relative);
    try {
      const text = await fs.readFile(file, 'utf8');
      const next = text.replace(/<!-- NEURONAS START -->[\s\S]*?<!-- NEURONAS END -->\s*/g, block => block.includes(manifest.vault) ? '' : block);
      if (next !== text) await fs.writeFile(file, next);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return uninstall({ state });
}
module.exports = { installLinux, uninstallLinux, systemdArg };
