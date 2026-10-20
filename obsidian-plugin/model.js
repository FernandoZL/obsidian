'use strict';
function fromMarkdown(text, path) {
  text = text.replaceAll('\r\n', '\n');
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/); if (!header) return null;
  const record = {};
  for (const line of header[1].split(/\r?\n/)) {
    const i = line.indexOf(':'); if (i < 0) continue;
    try { record[line.slice(0, i)] = JSON.parse(line.slice(i + 1)); } catch { /* Not a Neuronas field. */ }
  }
  if (record.neuronas !== 1 || !record.id) return null;
  const content = text.slice(header[0].length).split('\n<!-- contenido -->\n')[1]?.split('\n<!-- /contenido -->')[0];
  return content === undefined ? null : { ...record, content, path };
}
function toggleTask(text, lineIndex, expected) {
  const separator = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/), match = lines[lineIndex]?.match(/^(\s*[-*] \[)([ xX])(\] )(.*)$/);
  if (!match || match[4] !== expected) throw new Error('La tarea cambió; actualiza el panel');
  lines[lineIndex] = match[1] + (match[2] === ' ' ? 'x' : ' ') + match[3] + match[4];
  return lines.join(separator);
}
module.exports = { fromMarkdown, toggleTask };
