'use strict';
const path = require('node:path');
const { parseMemories, headerOf, bundleRanges, withoutBundleHeaders, renderBundle, updateRecord } = require('./format');
const { sameCapture, isCaptureNoise, mergeOccurrences } = require('./capture-policy');
const { snapshotVault, consolidateVault, linkRewriter } = require('./consolidate');

function planRepair(files) {
  const notes = new Map(), records = [];
  for (const [file, data] of files) {
    if (!file.startsWith('09 - Memoria IA/') || !file.endsWith('.md')) continue;
    const text = data.toString('utf8').replaceAll('\r\n', '\n'), parsed = parseMemories(text, file);
    if (parsed.length) { notes.set(file, { text, parsed }); records.push(...parsed); }
  }
  const identities = new Map();
  for (const record of records) {
    if (identities.has(record.id)) throw new Error('Identidad repetida o conflictiva; revisar antes de reparar: ' + record.id);
    identities.set(record.id, record);
  }
  const canonical = [], updates = new Map(), duplicates = new Map(), noise = new Set(), replacements = new Map();
  records.sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')) || a.path.localeCompare(b.path));
  for (const record of records) {
    if (record.type === 'session' && isCaptureNoise(record.content, record.attribution)) { noise.add(record.id); continue; }
    const old = canonical.find(r => sameCapture(r, record, { legacy: true }));
    if (!old) { canonical.push(record); continue; }
    const merged = mergeOccurrences(updates.get(old.id) || old, record);
    updates.set(old.id, merged); duplicates.set(record.id, old);
    for (const entry of [record, ...(record.occurrences || [])]) {
      const origin = record.path.split('#')[0] + '#^neuronas-' + entry.id;
      const target = old.path.split('#')[0] + '#^neuronas-' + entry.id;
      replacements.set(origin, target); replacements.set(origin.replace(/\.md(?=#|$)/, ''), target);
    }
    if (!record.bundlePath) {
      const target = old.path.split('#')[0] + '#^neuronas-' + record.id;
      replacements.set(record.path, target); replacements.set(record.path.replace(/\.md$/, ''), target);
    }
  }
  const output = new Map(), emptyMemoryFiles = new Set();
  for (const [file, { text: original, parsed }] of notes) {
    let text = original;
    if (headerOf(text).data.neuronasBundle === 1) {
      for (const range of bundleRanges(text).reverse()) {
        const id = range.envelope.record.id;
        if (!duplicates.has(id) && !noise.has(id)) continue;
        const record = parsed.find(r => r.id === id);
        const section = text.slice(range.headerEnd, range.closeStart), opening = '\n<!-- contenido -->\n';
        const contentStart = section.indexOf(opening);
        const end = contentStart + opening.length + record.content.length + '\n<!-- /contenido -->'.length;
        const title = String(record.title || 'Recuerdo').replace(/[\r\n]/g, ' ');
        const label = [record.date, record.source, record.attribution].filter(Boolean).join(' · ').replace(/[\r\n]/g, ' ');
        const prefix = section.slice(0, contentStart).replace('## ' + title + '\n\n', '').replace(label + ' ^neuronas-' + id + '\n', '');
        // Preserve all text outside the captured content, including personal annotations.
        let tail = section.slice(end).replace(/^\n<!-- neuronas-content-end [^\n]+ -->/, '');
        tail = tail.replace(/\n<!-- neuronas-aliases -->\n[\s\S]*?<!-- \/neuronas-aliases -->\n/g, '');
        const notice = noise.has(id) ? [record, ...(record.occurrences || [])].map(r => '\nCaptura técnica archivada en respaldo. ^neuronas-' + r.id + '\n').join('') : '';
        text = text.slice(0, range.start) + notice + prefix + tail + text.slice(range.end);
      }
      for (const record of parsed) if (updates.has(record.id)) text = updateRecord(text, record.id, { occurrences: updates.get(record.id).occurrences });
      const { body } = headerOf(text), heading = /^# (.+)$/m.exec(original)?.[1] || path.posix.basename(file, '.md');
      const frontmatter = text.slice(0, text.length - body.length);
      const prefix = headerOf(renderBundle([], heading)).body;
      text = frontmatter + prefix + withoutBundleHeaders(body).replace(/^\n+/, '');
      if (!bundleRanges(text).length) { text = text.replace('neuronasBundle: 1', 'neuronasArchive: 1'); emptyMemoryFiles.add(file); }
    } else {
      const record = parsed[0];
      if (updates.has(record.id)) text = updateRecord(text, record.id, { occurrences: updates.get(record.id).occurrences });
      if (duplicates.has(record.id) || noise.has(record.id)) {
        const { body } = headerOf(text), opening = '<!-- contenido -->\n', start = body.indexOf(opening), end = start + opening.length + record.content.length + '\n<!-- /contenido -->'.length;
        const target = duplicates.get(record.id)?.path;
        text = body.slice(0, start) + (target ? 'Recuerdo reunido: [[' + target.replace(/\.md(?=#|$)/, '') + '|Abrir fuente conservada]]\n' : 'Captura técnica archivada en respaldo. ^neuronas-' + record.id + '\n') + body.slice(end);
        emptyMemoryFiles.add(file);
      }
    }
    if (text !== original) output.set(file, text);
  }
  const rewrite = linkRewriter(files, replacements, { preserveFragments: true });
  for (const [file, data] of files) {
    if (!/\.(md|canvas)$/.test(file)) continue;
    const original = output.get(file) || data.toString('utf8'); let next;
    if (file.endsWith('.canvas')) {
      const canvas = JSON.parse(original); let changed = false;
      for (const node of canvas.nodes || []) {
        const target = replacements.get((node.file || '') + (node.subpath || '')) || replacements.get(node.file);
        if (target) { [node.file, node.subpath] = target.split(/(?=#)/); changed = true; }
        if (typeof node.text === 'string') { const value = rewrite(node.text, file); if (value !== node.text) { node.text = value; changed = true; } }
      }
      next = changed ? JSON.stringify(canvas, null, 2) + '\n' : original;
    } else next = rewrite(original, file);
    if (next !== data.toString('utf8')) output.set(file, next);
  }
  // Every unique meaningful record must remain byte-for-byte identical in content.
  const after = [];
  for (const [file, data] of files) if (file.endsWith('.md')) after.push(...parseMemories(output.get(file) || data.toString('utf8'), file));
  const expected = records.filter(r => !duplicates.has(r.id) && !noise.has(r.id));
  if (expected.length !== after.length || expected.some(r => !after.some(a => a.id === r.id && a.content === r.content))) throw new Error('La reparación alteraría recuerdos únicos');
  for (const [id, old] of duplicates) {
    const saved = after.find(r => r.id === old.id);
    if (!saved?.occurrences?.some(r => r.id === id)) throw new Error('La reparación perdería procedencia');
  }
  return { output, remove: new Set(), replacements, emptyMemoryFiles, duplicates: duplicates.size, noise: noise.size, recordsBefore: records.length, recordsAfter: after.length };
}
async function repairVault(vault, options = {}) {
  const files = await snapshotVault(vault), plan = planRepair(files);
  const result = await consolidateVault(vault, { ...options, preparedPlan: plan, expectedSnapshot: files });
  return { ...result, duplicates: plan.duplicates, noise: plan.noise, recordsBefore: plan.recordsBefore, recordsAfter: plan.recordsAfter };
}
module.exports = { planRepair, repairVault };
