'use strict';
const { textContent, normalized } = require('./common');
function adaptSession(event, state, file, index) {
  if (event.$set) Object.assign(state, { session: event.$set.sessionId || state.session, date: event.$set.startTime || state.date });
  if (!['user', 'gemini'].includes(event.type)) return null;
  return normalized('gemini', event, state, file, index, event.type === 'gemini' ? 'assistant' : 'user', textContent(event.content), event.id);
}
module.exports = { adaptSession };
