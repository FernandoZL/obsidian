'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { hash } = require('../memory/store');
const { redact } = require('../memory/redact');
const { isCaptureNoise } = require('../memory/capture-policy');
function textContent(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.filter(x => x && (!x.type || ['text', 'input_text', 'output_text'].includes(x.type))).map(x => x.text || '').join('\n');
}
function normalized(app, event, state, file, index, role, text, eventId) {
  if (text.startsWith('NEURONAS_ORGANIZER_JOB\n')) state.internalOrganizer = true;
  if (state.internalOrganizer) return null;
  if (!['user', 'assistant'].includes(role) || !text.trim()) return null;
  if (isCaptureNoise(text, role)) return null;
  if (text.trim().length < 10 || text.includes('<!-- NEURONAS START -->')) return null;
  if (/^\s*<(?:environment_context|system-reminder|local-command|command-name|permissions|skills_instructions|turn_aborted)/i.test(text)) return null;
  const session = state.session || path.basename(file, path.extname(file));
  const clean = redact(text);
  return { id: hash(`${app}:${session}:${eventId || index}:${text}`), type: 'session', title: `${app} · ${role === 'user' ? 'Usuario' : 'Asistente'} · ${String(event.timestamp || '').slice(0, 16)}`, date: event.timestamp || state.date || new Date().toISOString(), source: app, session, project: state.project || 'General', attribution: role, status: 'extract', sourcePath: file, contentHash: hash(clean), content: clean.slice(0, 6000) + (clean.length > 6000 ? '\n[Extracto truncado a 6000 caracteres; consultar fuente local.]' : '') };
}
// Una copia de trabajo de Git (como las tareas de Orca) se registra con el proyecto original.
const checkoutCache = new Map();
function mainCheckoutPath(cwd) {
  const key = String(cwd || '');
  if (!checkoutCache.has(key)) { if (checkoutCache.size > 500) checkoutCache.clear(); checkoutCache.set(key, findMainCheckout(key)); }
  return checkoutCache.get(key);
}
function findMainCheckout(cwd) {
  let dir = cwd;
  if (!dir) return null;
  for (let depth = 0; depth < 8; depth++) {
    let content = null;
    try { content = fs.readFileSync(path.join(dir, '.git'), 'utf8'); } catch (e) { if (e.code === 'EISDIR') return null; }
    if (content !== null) {
      const match = /^gitdir:\s*(.+?)[\\/]\.git[\\/]worktrees[\\/][^\\/]+\s*$/m.exec(content);
      // Git puede guardar gitdir como ruta relativa a la copia (worktree.useRelativePaths).
      return match ? path.join(path.resolve(dir, match[1]), path.relative(dir, String(cwd))) : null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}
function projectFromCwd(cwd) {
  const resolved = mainCheckoutPath(cwd) || String(cwd || '');
  const parts = resolved.split(/[\\/]/).filter(Boolean);
  const orca = parts.findIndex((p, i) => p.toLowerCase() === 'orca' && (parts[i + 1] || '').toLowerCase() === 'workspaces');
  // Tarea de Orca ya borrada: orca/workspaces/<proyecto>/<tarea>/...
  if (orca >= 0 && parts.length >= orca + 4 && resolved === String(cwd || '')) return `${parts[orca + 2]} · Orca`;
  const name = parts[parts.length - 1];
  return !name || /^(system32|windows)$/i.test(name) ? 'General' : `${name} · ${parts.slice(0, -1).join(' / ')}`;
}
module.exports = { textContent, normalized, projectFromCwd };
