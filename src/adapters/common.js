'use strict';
const path = require('node:path');
const { hash } = require('../memory/store');
const { redact } = require('../memory/redact');
function textContent(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.filter(x => x && (!x.type || ['text', 'input_text', 'output_text'].includes(x.type))).map(x => x.text || '').join('\n');
}
function normalized(app, event, state, file, index, role, text, eventId) {
  if (!['user', 'assistant'].includes(role) || !text.trim()) return null;
  if (text.trim().length < 10 || text.includes('<!-- NEURONAS START -->')) return null;
  if (/^\s*<(?:environment_context|system-reminder|local-command|command-name|permissions|skills_instructions|turn_aborted)/i.test(text)) return null;
  const session = state.session || path.basename(file, path.extname(file));
  const clean = redact(text);
  return { id: hash(`${app}:${session}:${eventId || index}:${text}`), type: 'session', title: `${app} · ${role === 'user' ? 'Usuario' : 'Asistente'} · ${String(event.timestamp || '').slice(0, 16)}`, date: event.timestamp || state.date || new Date().toISOString(), source: app, session, project: state.project || 'General', attribution: role, status: 'extract', sourcePath: file, content: clean.slice(0, 6000) + (clean.length > 6000 ? '\n[Extracto truncado a 6000 caracteres; consultar fuente local.]' : '') };
}
function projectFromCwd(cwd) {
  const name = String(cwd || '').split(/[\\/]/).filter(Boolean).pop();
  const parts = String(cwd || '').split(/[\\/]/).filter(Boolean);
  return !name || /^(system32|windows)$/i.test(name) ? 'General' : `${name} · ${parts.slice(0, -1).join(' / ')}`;
}
module.exports = { textContent, normalized, projectFromCwd };
