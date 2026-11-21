'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { atomicWrite } = require('../memory/store');
const { linkRewriter } = require('../memory/consolidate');
const { loadWorkspace } = require('../../obsidian-plugin/workbench-model');
const { updateMaterialIndexes } = require('../../obsidian-plugin/materials');
const { updateLivePages } = require('../../obsidian-plugin/live-pages');
const { updateNetworkIndex, attachmentsOf } = require('../../obsidian-plugin/network');

async function walk(vault, relative, files, folders) {
  for (const entry of await fs.readdir(path.join(vault, relative), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const item = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) { folders.set(item, { path: item, name: entry.name, children: [] }); await walk(vault, item, files, folders); continue; }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(path.join(vault, item)), extension = path.extname(entry.name).slice(1);
    files.set(item, { path: item, name: entry.name, basename: path.basename(entry.name, path.extname(entry.name)), extension, stat: { mtime: stat.mtimeMs, ctime: stat.ctimeMs, size: stat.size }, parent: folders.get(relative) || { path: relative || '/' } });
  }
}
// Expone lo mínimo de la API de Obsidian para reutilizar los generadores del plugin sin abrir la app.
async function headlessApp(vault) {
  const files = new Map(), folders = new Map();
  await walk(vault, '', files, folders);
  const full = file => path.join(vault, file.path);
  const add = async relative => {
    const stat = await fs.stat(path.join(vault, relative)), name = path.posix.basename(relative), extension = path.posix.extname(name).slice(1);
    const file = { path: relative, name, basename: path.posix.basename(name, path.posix.extname(name)), extension, stat: { mtime: stat.mtimeMs, ctime: stat.ctimeMs, size: stat.size }, parent: folders.get(path.posix.dirname(relative)) || { path: '/' } };
    files.set(relative, file); return file;
  };
  const fileManager = {
    // Igual que Obsidian: renombra sin pisar otro archivo y actualiza los enlaces que apuntan a la nota.
    async renameFile(file, target) {
      const from = file.path, destination = path.join(vault, target);
      if (files.has(target) || await fs.access(destination).then(() => true, () => false)) throw new Error('El destino ya existe: ' + target);
      await fs.rename(full(file), destination);
      const rewrite = linkRewriter(files, new Map([[from, target]]), { preserveFragments: true });
      files.delete(from);
      const renamed = await add(target);
      for (const note of files.values()) {
        if (note.extension !== 'md') continue;
        const text = await fs.readFile(full(note), 'utf8'), next = rewrite(text, note.path);
        if (next !== text) await atomicWrite(full(note), next);
      }
      return renamed;
    }
  };
  return { fileManager, vault: {
    getFiles: () => [...files.values()],
    getMarkdownFiles: () => [...files.values()].filter(file => file.extension === 'md'),
    getAbstractFileByPath: item => files.get(item) || folders.get(item) || null,
    cachedRead: file => fs.readFile(full(file), 'utf8'),
    async process(file, change) {
      const current = await fs.readFile(full(file), 'utf8'), next = change(current);
      if (next !== current) await atomicWrite(full(file), next);
      return next;
    },
    async create(relative, text) { await fs.writeFile(path.join(vault, relative), text, { flag: 'wx' }); return add(relative); },
    async createFolder(relative) { await fs.mkdir(path.join(vault, relative), { recursive: true }); folders.set(relative, { path: relative, name: path.posix.basename(relative), children: [] }); }
  } };
}
// Un fallo aquí no debe impedir organizar: las páginas se regeneran en la siguiente corrida.
async function refreshPages(vault) {
  try {
    const app = await headlessApp(vault), { documents, errors } = await loadWorkspace(app);
    const materials = await updateMaterialIndexes(app, documents);
    const pages = await updateLivePages(app, documents);
    await updateNetworkIndex(app, app.vault.getMarkdownFiles(), attachmentsOf(app));
    return { updated: pages.updated, errors: [...errors, ...materials.errors, ...pages.errors] };
  } catch (error) { return { updated: 0, errors: [error.message] }; }
}
module.exports = { refreshPages };
