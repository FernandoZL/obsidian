'use strict';
const { textContent, normalized, projectFromCwd } = require('./common');
function adaptSession(event, state, file, index) {
  if (event.sessionId) state.session = event.sessionId;
  if (event.cwd) state.project = projectFromCwd(event.cwd);
  if (!['user', 'assistant'].includes(event.type) || event.isSidechain) return null;
  return normalized('claude', event, state, file, index, event.message?.role, textContent(event.message?.content), event.uuid);
}
module.exports = { adaptSession };
