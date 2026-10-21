'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { ROOT, readMemories, atomicWrite, withLock, hash } = require('./store');
const { memoryTitle, safeTitle } = require('./names');
async function destinationFor(current, title) {
  const directory = path.dirname(current); let index = 1;
  while (true) {
    const candidate = path.join(directory, safeTitle(title) + (index > 1 ? ` (${index})` : '') + '.md');
    if (candidate === current) return current;
    const exists = await fs.stat(candidate).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    if (!exists) return candidate; index++;
  }
}
async function renameMemories(vault) {
  vault = await fs.realpath(vault);
  return withLock(vault + ':notes', async () => {
    const journalDir = path.join(os.tmpdir(), 'obsidian-neuronas-migrations'); await fs.mkdir(journalDir, { recursive: true });
    const journalFile = path.join(journalDir, hash(vault) + '.json');
    let pending = [];
    try { pending = JSON.parse(await fs.readFile(journalFile, 'utf8')); } catch(e) { if (e.code !== 'ENOENT') throw e; }
    const map = new Map(pending); let renamed = 0;
    async function rememberRename(from, to) {
      map.set(path.relative(vault, from).replaceAll('\\', '/').slice(0, -3), path.relative(vault, to).replaceAll('\\', '/').slice(0, -3));
      await atomicWrite(journalFile, JSON.stringify([...map]));
    }
    for (const record of await readMemories(vault)) {
      const file = path.join(vault, record.path), title = memoryTitle(record);
      const original = await fs.readFile(file, 'utf8'); let content = original.replaceAll('\r\n', '\n');
      content = content.replace(/^title:.*$/m, 'title: ' + JSON.stringify(title)).replace(/(\n---\n\n)# [^\n]+/, '$1# ' + title);
      if (content !== original) await atomicWrite(file, content);
      const destination = await destinationFor(file, title);
      if (destination !== file) { await rememberRename(file, destination); await fs.rename(file, destination); renamed++; }
    }
    const projectDir = path.join(vault, ROOT, 'Proyectos');
    for (const entry of await fs.readdir(projectDir, { withFileTypes: true }).catch(e => { if (e.code !== 'ENOENT') throw e; return []; })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const file = path.join(projectDir, entry.name), text = await fs.readFile(file, 'utf8');
      const title = text.match(/^# (.+)/)?.[1]?.trim(); if (!title) continue;
      const destination = await destinationFor(file, safeTitle('Recuerdos de '+title));
      if (destination !== file) { await rememberRename(file, destination); await fs.rename(file, destination); renamed++; }
    }
    // Update only explicit wiki links, never free text or source references.
    async function links(directory) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || entry.name === '.obsidian') continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await links(file);
        else if (entry.name.endsWith('.md')) {
          const original = await fs.readFile(file, 'utf8'); let next = original;
          for (const [oldPath, newPath] of map) next = next.replaceAll('[[' + oldPath + '|', '[[' + newPath + '|').replaceAll('[[' + oldPath + ']]', '[[' + newPath + ']]');
          if (next !== original) await atomicWrite(file, next);
        }
      }
    }
    await links(vault); await fs.unlink(journalFile).catch(e => { if (e.code !== 'ENOENT') throw e; }); return { renamed };
  });
}
module.exports = { renameMemories };
