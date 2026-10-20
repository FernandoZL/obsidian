'use strict';
const { textContent, normalized, projectFromCwd } = require('./common');
function adaptSession(event, state, file, index) {
  const p = event.payload || {};
  if (event.type === 'session_meta') Object.assign(state, { session: p.session_id || p.id, project: projectFromCwd(p.cwd), date: p.timestamp });
  if (event.type !== 'response_item' || p.type !== 'message') return null;
  if (p.role === 'assistant' && p.phase && p.phase !== 'final_answer') return null;
  return normalized('codex', event, state, file, index, p.role, textContent(p.content), p.id);
}
module.exports = { adaptSession };
