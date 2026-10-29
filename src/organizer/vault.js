'use strict';
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { snapshotVault, linkRewriter, consolidateVault } = require('../memory/consolidate');
const { parseMemories, renderBundle, renderRecord, headerOf } = require('../memory/format');
const { safeTitle } = require('../memory/names');
const { redact } = require('../memory/redact');
const ROOT = '09 - Memoria IA';
const TYPES = { Sesiones: 'session', Aprendizajes: 'learning', Decisiones: 'decision', Perfil: 'profile' };
function recordsFor(file, text) {
  const parts = file.split('/');
  if (parts.length !== 3 || parts[0] !== ROOT || !TYPES[parts[1]] || !file.endsWith('.md')) return [];
  const records = parseMemories(text, file);
  return records.length && records.every(r => r.type === TYPES[parts[1]]) ? records : [];
}
function inventoryOf(files) {
  return [...files].filter(([file]) => file.endsWith('.md')).map(([file, data]) => {
    const text = data.toString('utf8'), records = recordsFor(file, text);
    return { file, mergeable: !!records.length, category: path.posix.dirname(file), count: records.length, excerpt: redact(records.length ? records.slice(0, 8).map(r => [r.title, r.project, r.content.slice(0, 180)].filter(Boolean).join(' · ')).join('\n') : text.slice(0, 300)).slice(0, 1700) };
  });
}
function comparable(records) { return records.map(({ path, bundlePath, ...r }) => r).sort((a,b) => a.id.localeCompare(b.id) || a.content.localeCompare(b.content)); }
function checkHeadings(files, sources) {
  const key = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const headings = new Map();
  for (const source of sources) for (const match of source.text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const name = key(match[1]); if (!headings.has(name)) headings.set(name, new Set()); headings.get(name).add(source.file);
  }
  const ambiguous = new Set([...headings].filter(([, origins]) => origins.size > 1).map(([name]) => name));
  if (!ambiguous.size) return;
  for (const [origin, data] of files) {
    const text = data.toString('utf8');
    const targets = [...text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(m => m[1]);
    targets.push(...[...text.matchAll(/\]\((<[^>]+>|[^\s)]+)/g)].map(m => m[1].replace(/^<|>$/g, '')));
    targets.push(...[...text.matchAll(/^\s*\[[^\]\n]+\]:\s*(<[^>]+>|[^\s]+)/gm)].map(m => m[1].replace(/^<|>$/g, '')));
    if (origin.endsWith('.canvas')) for (const node of JSON.parse(text).nodes || []) if (node.file && node.subpath) targets.push(node.file + node.subpath);
    for (const raw of targets) {
      let target; try { target = decodeURIComponent(raw); } catch { target = raw; }
      const i = target.indexOf('#'); if (i < 0 || target[i + 1] === '^' || !ambiguous.has(key(target.slice(i + 1)))) continue;
      const file = target.slice(0, i), candidates = [file, file + '.md', path.posix.normalize(path.posix.join(path.posix.dirname(origin), file))];
      const pointsToSource = sources.some(s => file ? candidates.includes(s.file) || candidates.includes(s.file.slice(0, -3)) || file.replace(/\.md$/, '') === path.posix.basename(s.file, '.md') : s.file === origin);
      if (pointsToSource) throw new Error('Encabezado ambiguo después de fusionar: ' + target);
    }
  }
}
function planOrganization(files, proposal) {
  if (!proposal || typeof proposal.summary !== 'string' || proposal.summary.length > 5000 || !Array.isArray(proposal.groups) || proposal.groups.length > 100) throw new Error('Plan de organización inválido');
  const used = new Set(), output = new Map(), remove = new Set(), replacements = new Map();
  for (const group of proposal.groups) {
    if (typeof group.title !== 'string' || !group.title.trim() || group.title.length > 150 || !Array.isArray(group.files) || group.files.length < 2) throw new Error('Grupo inválido');
    let directory; const sources = [];
    for (const file of group.files) {
      if (typeof file !== 'string' || !files.has(file) || used.has(file)) throw new Error('Archivo no permitido o repetido: ' + file);
      const text = files.get(file).toString('utf8'), records = recordsFor(file, text);
      if (!records.length) throw new Error('Archivo no permitido para fusionar: ' + file);
      const parent = path.posix.dirname(file); if (directory && directory !== parent) throw new Error('No se mezclan categorías'); directory = parent;
      used.add(file); sources.push({ file, text, records });
    }
    const destination = directory + '/' + safeTitle('Tema · ' + group.title) + '.md';
    checkHeadings(files, sources);
    if ((files.has(destination) && !group.files.includes(destination)) || output.has(destination)) throw new Error('El destino ya existe: ' + destination);
    let text = renderBundle([], group.title);
    const blockIds = new Set();
    for (const source of sources) {
      for (const match of source.text.matchAll(/(?:^|\s)\^([A-Za-z0-9-]+)\s*$/gm)) { if (blockIds.has(match[1])) throw new Error('Bloques repetidos en el grupo'); blockIds.add(match[1]); }
      const body = headerOf(source.text.replaceAll('\r\n', '\n')).body;
      text += source.records[0].bundlePath ? body + '\n\n' : renderRecord(source.records[0], body) + '\n';
      replacements.set(source.file, destination + '#^neuronas-' + source.records[0].id);
      if (source.file !== destination) remove.add(source.file);
    }
    output.set(destination, text);
  }
  const rewrite = linkRewriter(files, replacements, { preserveFragments: true });
  for (const [file, buffer] of files) {
    if (remove.has(file) || output.has(file) || !/\.(md|canvas)$/.test(file)) continue;
    const original = buffer.toString('utf8'); let text = original;
    if (file.endsWith('.canvas')) {
      const data = JSON.parse(text); let changed = false;
      for (const node of data.nodes || []) {
        const replacement = replacements.get(node.file);
        if (replacement) { const [destination, anchor] = replacement.split(/(?=#)/); node.file = destination; node.subpath ||= anchor; changed = true; }
        if (typeof node.text === 'string') { const next = rewrite(node.text, file); if (next !== node.text) { node.text = next; changed = true; } }
      }
      if (changed) text = JSON.stringify(data, null, 2) + '\n';
    } else text = rewrite(text, file);
    if (text !== original) output.set(file, text);
  }
  for (const [file, text] of output) if (file.endsWith('.md')) output.set(file, rewrite(text, file));
  const index = ROOT + '/Memoria IA.md';
  if (files.has(index)) {
    const start = '<!-- NEURONAS AI TOPICS -->', end = '<!-- /NEURONAS AI TOPICS -->';
    const block = start + '\n## Organización por temas\n\n' + proposal.summary.replace(/<!--|-->/g, '') + '\n\n' + [...output.keys()].filter(file => used.has(file) || (file.startsWith(ROOT + '/') && file.includes('/Tema · '))).map(file => '- [[' + file.slice(0,-3) + '|' + path.posix.basename(file, '.md') + ']]').join('\n') + '\n' + end;
    const previous = output.get(index) || files.get(index).toString('utf8');
    const next = previous.includes(start) && previous.includes(end) ? previous.slice(0, previous.indexOf(start)) + block + previous.slice(previous.indexOf(end) + end.length) : previous + '\n\n' + block + '\n';
    if (next !== previous) output.set(index, next);
  }
  const expected = [], actual = [];
  for (const [file, data] of files) if (file.endsWith('.md')) {
    expected.push(...parseMemories(rewrite(data.toString('utf8'), file), file));
    if (!remove.has(file) && !output.has(file)) actual.push(...parseMemories(data.toString('utf8'), file));
  }
  for (const [file, text] of output) if (file.endsWith('.md')) actual.push(...parseMemories(text, file));
  if (!isDeepStrictEqual(comparable(expected), comparable(actual))) throw new Error('El plan alteraría recuerdos; se conservan las fuentes');
  return { output, remove, replacements, groups: proposal.groups.length };
}
async function applyOrganization(vault, files, plan, state) {
  return consolidateVault(vault, { preparedPlan: plan, expectedSnapshot: files, backupDirectory: path.join(state, 'backups') });
}
module.exports = { snapshotVault, inventoryOf, planOrganization, applyOrganization };
