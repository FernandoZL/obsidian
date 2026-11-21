'use strict';
const path = require('node:path');
const { snapshotVault, linkRewriter, consolidateVault } = require('../memory/consolidate');
const COPY = /^(.*?)(?: ?\(\d+\)| \d+)\.md$/;
const NETWORK = '05 - Conocimiento/Red automática/Red automática.md';
const key = text => text.normalize('NFC').toLocaleLowerCase('es');
const AUTOMATIC = /<!-- NEURONAS ([A-Z ]+) -->[\s\S]*?<!-- \/NEURONAS \1 -->/g;
const ownLines = text => text.replaceAll('\r\n', '\n').replace(AUTOMATIC, '').split('\n').map(line => key(line.trim())).filter(Boolean);
const holdsMemories = text => /^neuronas:\s*\d/m.test(text) || /\^neuronas-/.test(text);
// Una copia solo se quita si todo lo escrito en ella ya está en el original.
function isRedundant(copy, original) {
  if (holdsMemories(copy) || !copy.trim()) return false;
  if (copy === original) return true;
  const lines = ownLines(copy);
  if (!lines.length && !copy.includes('<!-- NEURONAS ')) return false;
  const known = new Set(ownLines(original));
  return lines.every(line => known.has(line));
}
// El mapa se regenera solo. Si iCloud dejó únicamente copias, se conserva la que contiene
// el texto manual de todas; si alguna tiene texto que las demás no tienen, no se toca.
function restoreNetworkMap(files) {
  if (findKey(files, NETWORK)) return null;
  const folder = path.posix.dirname(NETWORK) + '/';
  const copies = [...files.keys()].filter(file => file.startsWith(folder) && /^Red automática(?: \d+| ?\(\d+\))\.md$/.test(file.slice(folder.length))).sort();
  const maps = copies.map(file => ({ file, text: files.get(file).toString('utf8') }));
  if (!maps.length || maps.some(map => !map.text.includes('<!-- NEURONAS AUTO NETWORK -->') || !map.text.includes('<!-- /NEURONAS AUTO NETWORK -->'))) return null;
  const keeper = maps.reduce((best, map) => ownLines(map.text).length > ownLines(best.text).length ? map : best);
  const known = new Set(ownLines(keeper.text));
  if (maps.some(map => ownLines(map.text).some(line => !known.has(line)))) return null;
  return { text: keeper.text, copies };
}
function findKey(files, target) {
  const wanted = key(target);
  for (const file of files.keys()) if (key(file) === wanted) return file;
  return null;
}
function planCopyCleanup(files) {
  const byKey = new Map();
  for (const file of files.keys()) if (file.endsWith('.md') && !COPY.test(path.posix.basename(file))) byKey.set(key(file), file);
  const replacements = new Map(), remove = new Set();
  for (const [file, data] of files) {
    if (!file.endsWith('.md')) continue;
    const match = path.posix.basename(file).match(COPY); if (!match) continue;
    const folder = path.posix.dirname(file), original = byKey.get(key((folder === '.' ? '' : folder + '/') + match[1] + '.md'));
    if (!original || !isRedundant(data.toString('utf8'), files.get(original).toString('utf8'))) continue;
    remove.add(file); replacements.set(file, original);
  }
  const output = new Map(), restored = restoreNetworkMap(files);
  if (restored) {
    output.set(NETWORK, restored.text);
    for (const copy of restored.copies) { remove.add(copy); replacements.set(copy, NETWORK); }
  }
  if (!remove.size) return { output, remove, replacements };
  const rewrite = linkRewriter(files, replacements, { preserveFragments: true });
  for (const [file, buffer] of files) {
    if (remove.has(file) || !/\.(md|canvas)$/.test(file)) continue;
    const original = buffer.toString('utf8'); let text = original;
    if (file.endsWith('.canvas')) {
      const data = JSON.parse(text); let changed = false;
      for (const node of data.nodes || []) {
        if (replacements.has(node.file)) { node.file = replacements.get(node.file); changed = true; }
        if (typeof node.text === 'string') { const next = rewrite(node.text, file); if (next !== node.text) { node.text = next; changed = true; } }
      }
      if (changed) text = JSON.stringify(data, null, 2) + '\n';
    } else text = rewrite(text, file);
    if (text !== original) output.set(file, text);
  }
  return { output, remove, replacements };
}
// No debe impedir organizar: si la bóveda cambia a mitad de camino, se reintenta en la siguiente corrida.
async function removeCopies(vault, state) {
  try {
    const files = await snapshotVault(vault), plan = planCopyCleanup(files);
    if (!plan.remove.size) return { removed: [] };
    const applied = await consolidateVault(vault, { preparedPlan: plan, expectedSnapshot: files, backupDirectory: path.join(state, 'backups') });
    return { removed: [...plan.remove], backup: applied.backup };
  } catch (error) { return { removed: [], error: error.message }; }
}
module.exports = { planCopyCleanup, removeCopies };
