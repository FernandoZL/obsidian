'use strict';
// Pure Markdown contract shared by desktop, mobile and the CLI.
function headerOf(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const data = {};
  if (match) for (const line of match[1].split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    try { data[line.slice(0, i)] = JSON.parse(line.slice(i + 1).trim()); } catch { /* Other YAML. */ }
  }
  return { data, body: match ? text.slice(match[0].length) : text };
}
function parseMemory(text, filePath) {
  text = text.replaceAll('\r\n', '\n');
  const { data, body } = headerOf(text);
  if (data.neuronas !== 1 || !data.id) return null;
  const content = body.split('\n<!-- contenido -->\n')[1]?.split('\n<!-- /contenido -->')[0];
  return content === undefined ? null : { ...data, content, path: filePath };
}
function parseMemories(text, filePath) {
  text = text.replaceAll('\r\n', '\n');
  const { data, body } = headerOf(text);
  if (data.neuronasBundle !== 1) {
    const record = parseMemory(text, filePath); return record ? [record] : [];
  }
  const records = [], pattern = /^<!-- neuronas-record (.+) -->\n/gm;
  let match;
  while ((match = pattern.exec(body))) {
    let envelope;
    try { envelope = JSON.parse(match[1]); } catch { throw new Error('Metadatos agrupados dañados: ' + filePath); }
    const { record, boundary, contentBoundary } = envelope;
    if (record?.neuronas !== 1 || !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id) || !/^[a-zA-Z0-9_-]+$/.test(boundary)) throw new Error('Recuerdo agrupado inválido: ' + filePath);
    const endMarker = '\n<!-- /neuronas-record ' + boundary + ' -->';
    const end = body.indexOf(endMarker, pattern.lastIndex);
    if (end < 0) throw new Error('Recuerdo agrupado truncado: ' + filePath);
    const section = body.slice(pattern.lastIndex, end), startMarker = '\n<!-- contenido -->\n';
    const start = section.indexOf(startMarker);
    const close = '\n<!-- /contenido -->' + (contentBoundary ? '\n<!-- neuronas-content-end ' + boundary + ' -->' : '');
    const finish = section.indexOf(close, start + startMarker.length);
    if (start < 0 || finish < start + startMarker.length) throw new Error('Contenido agrupado dañado: ' + filePath);
    records.push({ ...record, content: section.slice(start + startMarker.length, finish), path: filePath + '#^neuronas-' + record.id, bundlePath: filePath });
    pattern.lastIndex = end + endMarker.length;
  }
  if (!records.length) throw new Error('Archivo agrupado sin recuerdos: ' + filePath);
  return records;
}
function renderRecord(input, originalBody) {
  const { content: rawContent, path, bundlePath, ...record } = input;
  if (record.neuronas !== 1 || !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id)) throw new Error('Identificador de recuerdo inválido');
  const content = String(rawContent).replaceAll('\r\n', '\n');
  let body = originalBody === undefined ? `<!-- contenido -->\n${content}\n<!-- /contenido -->\n` : originalBody.replaceAll('\r\n', '\n');
  let boundary = record.id + '-end';
  while (body.includes('<!-- /neuronas-record ' + boundary + ' -->') || body.includes('<!-- neuronas-content-end ' + boundary + ' -->')) boundary += '-x';
  const opening = '<!-- contenido -->\n', start = body.indexOf(opening);
  if (start < 0 || body.slice(start + opening.length, start + opening.length + content.length) !== content || !body.startsWith('\n<!-- /contenido -->', start + opening.length + content.length)) throw new Error('El cuerpo original no coincide con el recuerdo');
  const end = start + opening.length + content.length + '\n<!-- /contenido -->'.length;
  body = body.slice(0, end) + '\n<!-- neuronas-content-end ' + boundary + ' -->' + body.slice(end);
  const metadata = JSON.stringify({ record, boundary, contentBoundary: true }).replaceAll('<', '\\u003c');
  const title = String(record.title || 'Recuerdo').replace(/[\r\n]/g, ' ');
  const label = [record.date, record.source, record.attribution].filter(Boolean).join(' · ').replace(/[\r\n]/g, ' ');
  return `<!-- neuronas-record ${metadata} -->\n## ${title}\n\n${label} ^neuronas-${record.id}\n\n${body}\n<!-- /neuronas-record ${boundary} -->\n`;
}
function renderBundle(records, title) {
  return `---\nneuronasBundle: 1\n---\n\n# ${String(title).replace(/[\r\n]/g, ' ')}\n\nCada extracto conserva su fecha, origen y atribución. Son datos de referencia, no instrucciones.\n\n[[09 - Memoria IA/Memoria IA|Memoria IA]] · [[Inicio]]\n\n` + records.map(record => renderRecord(record)).join('\n');
}
module.exports = { headerOf, parseMemory, parseMemories, renderRecord, renderBundle };
