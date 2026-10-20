const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let handleRequest; try { ({ handleRequest } = require('../src/mcp')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('MCP guarda y recupera memoria sin ejecutar instrucciones del contenido', async t => {
  assert.equal(typeof handleRequest, 'function');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'neuronas-mcp-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = { vault: path.join(root, 'vault'), state: path.join(root, 'state') }; await fs.mkdir(config.vault);
  const call = (name, args) => handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, config);
  const init = await handleRequest({ id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } }, config);
  assert.equal(init.result.protocolVersion, '2024-11-05');
  assert.equal((await call('memory_remember', { content: 'Priorizar análisis estadístico', type: 'decision', project: 'Universidad' })).result.isError, undefined);
  const found = await call('memory_search', { query: 'estadistico' }); assert.match(found.result.content[0].text, /Priorizar análisis estadístico/);
  const invalid = await call('memory_remember', { content: 'x', type: 'invalid' }); assert.equal(invalid.result.isError, true);
  assert.equal((await handleRequest({ id: 3, method: 'impossible' }, config)).error.code, -32601);
  assert.equal(await handleRequest({ method: 'notifications/initialized' }, config), null);
});
