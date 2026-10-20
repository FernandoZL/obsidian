'use strict';
function safeTitle(text) {
  const title = String(text).replace(/#/g, ' Sharp ').replace(/[<>:"/\\|?*^\[\]\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim().slice(0, 100);
  return !title || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(title) ? 'Recuerdo ' + title : title;
}
function headline(content) {
  return String(content).replaceAll('\r\n', '\n').split('\n').map(s => s.trim()).find(s => s && !s.startsWith('```'))?.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/^[#>*\-\s]+/, '').replace(/[*`_]/g, '').trim().slice(0, 82) || 'Conversación guardada';
}
function memoryTitle(record) {
  if (record.type === 'session') return safeTitle(`${record.source === 'codex' ? 'Codex' : record.source === 'claude' ? 'Claude' : record.source === 'gemini' ? 'Gemini' : record.source || 'IA'} · ${headline(record.content)}`);
  if (record.title) return safeTitle(record.title);
  const label = { decision: 'Decisión', learning: 'Aprendizaje', profile: 'Perfil', project: 'Proyecto' }[record.type] || 'Recuerdo';
  return safeTitle(`${label} · ${headline(record.content)}`);
}
function uniqueMemories(records) {
  const selected = new Map();
  for (const record of records) {
    const key = record.id + '\0' + record.content, old = selected.get(key);
    if (!old || record.path.length < old.path.length) selected.set(key, record);
  }
  return [...selected.values()];
}
module.exports = { safeTitle, headline, memoryTitle, uniqueMemories };
