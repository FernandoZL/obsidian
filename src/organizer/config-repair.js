'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const COPY = /^(.+?)(?: ?\(\d+\)| \d+)(\.(?:json|js))$/;
const TARGETS = [
  ['.obsidian', new Set(['app.json', 'appearance.json', 'community-plugins.json', 'core-plugins.json', 'graph.json', 'hotkeys.json', 'types.json', 'workspace.json', 'workspace-mobile.json'])],
  ['.obsidian/plugins/neuronas', new Set(['data.json', 'main.js', 'manifest.json'])]
];
async function usable(file) {
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  if (!text.trim()) return false;
  if (!file.endsWith('.json')) return true;
  try { JSON.parse(text); return true; } catch { return false; }
}
async function exists(file) { return fs.access(file).then(() => true, () => false); }
// iCloud renombra la configuración de Obsidian al detectar conflictos. Se restaura la copia
// válida más reciente y las demás salen de la bóveda hacia un respaldo local.
async function repairConfig(vault, state, now = new Date()) {
  const backup = path.join(state, 'backups', 'config-conflictos', now.toISOString().replace(/[:.]/g, '-'));
  const result = { restored: [], moved: 0, errors: [] };
  for (const [folder, names] of TARGETS) {
    const directory = path.join(vault, folder);
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    const groups = new Map();
    for (const entry of entries) {
      const match = entry.isFile() && entry.name.match(COPY), canonical = match && match[1] + match[2];
      if (!canonical || !names.has(canonical)) continue;
      if (!groups.has(canonical)) groups.set(canonical, []);
      groups.get(canonical).push(entry.name);
    }
    for (const [canonical, copies] of groups) {
      try {
        const target = path.join(directory, canonical);
        if (!(await exists(target))) {
          const dated = await Promise.all(copies.map(async name => ({ name, time: (await fs.stat(path.join(directory, name))).mtimeMs })));
          dated.sort((a, b) => b.time - a.time);
          let source;
          for (const item of dated) if (await usable(path.join(directory, item.name))) { source = item.name; break; }
          if (!source) { result.errors.push(folder + '/' + canonical + ': sin copia válida'); continue; }
          await fs.copyFile(path.join(directory, source), target, fs.constants.COPYFILE_EXCL);
          result.restored.push(folder + '/' + canonical);
        }
        const destination = path.join(backup, folder);
        await fs.mkdir(destination, { recursive: true });
        for (const name of copies) {
          await fs.copyFile(path.join(directory, name), path.join(destination, name));
          await fs.unlink(path.join(directory, name));
          result.moved++;
        }
      } catch (error) { result.errors.push(folder + '/' + canonical + ': ' + error.message); }
    }
  }
  if (result.moved) result.backup = backup;
  return result;
}
module.exports = { repairConfig };
