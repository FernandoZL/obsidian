'use strict';
const path = require('node:path');
const { normalized } = require('./common');
function adaptSession(event, state, file, index) {
  if (event.status !== 'DONE' || typeof event.content !== 'string') return null;
  const role = event.type === 'USER_INPUT' && event.source === 'USER_EXPLICIT' ? 'user' : event.type === 'PLANNER_RESPONSE' && event.source === 'MODEL' ? 'assistant' : null;
  if (!role) return null;
  state.session ||= path.basename(path.dirname(path.dirname(path.dirname(file))));
  const request = role === 'user' ? event.content.match(/^\s*<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/) : null;
  const content = request ? request[1] : event.content;
  return normalized('antigravity', { timestamp: event.created_at }, state, file, index, role, content, String(event.step_index ?? index));
}
module.exports = { adaptSession };
