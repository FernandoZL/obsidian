const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
let providers = {}; try { providers = require('../obsidian-plugin/providers'); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('construye solicitudes nativas Gemini, Claude, OpenAI compatible y Ollama', () => {
  assert.equal(typeof providers.buildRequest, 'function');
  const settings = { model: 'modelo-prueba', apiKey: 'synthetic-key', baseUrl: 'https://example.test/v1' };
  const openai = providers.buildRequest('openai', settings, 'Pregunta', 'Sistema');
  assert.equal(openai.url, 'https://example.test/v1/chat/completions'); assert.equal(openai.headers.Authorization, 'Bearer synthetic-key');
  assert.deepEqual(JSON.parse(openai.body).messages, [{ role: 'system', content: 'Sistema' }, { role: 'user', content: 'Pregunta' }]);
  const gemini = providers.buildRequest('gemini', settings, 'Pregunta', 'Sistema');
  assert.match(gemini.url, /models\/modelo-prueba:generateContent$/); assert.ok(!gemini.url.includes('synthetic-key')); assert.equal(gemini.headers['x-goog-api-key'], 'synthetic-key');
  const claude = providers.buildRequest('anthropic', settings, 'Pregunta', 'Sistema'); assert.equal(claude.headers['anthropic-version'], '2023-06-01'); assert.equal(JSON.parse(claude.body).system, 'Sistema');
  const ollama = providers.buildRequest('ollama', { ...settings, baseUrl: 'http://127.0.0.1:11434' }, 'Pregunta', 'Sistema'); assert.equal(ollama.url, 'http://127.0.0.1:11434/api/chat'); assert.equal(JSON.parse(ollama.body).stream, false);
});
test('no envía solicitudes con modelo ausente, proveedor desconocido o credenciales en URL', () => {
  assert.equal(typeof providers.buildRequest, 'function');
  assert.throws(() => providers.buildRequest('openai', { apiKey: 'x' }, 'hola', ''), /modelo/i);
  assert.throws(() => providers.buildRequest('unknown', { model: 'x', apiKey: 'x' }, 'hola', ''), /proveedor/i);
  assert.throws(() => providers.buildRequest('openai', { model: 'x', apiKey: 'x', baseUrl: 'https://key:secret@example.test' }, 'hola', ''), /URL/i);
});
test('extrae solo respuesta visible e informa bloqueos o respuestas vacías', () => {
  assert.equal(typeof providers.responseText, 'function');
  assert.equal(providers.responseText('gemini', { candidates: [{ content: { parts: [{ thought: true, text: 'razonamiento' }, { text: 'Respuesta' }] } }] }), 'Respuesta');
  assert.equal(providers.responseText('anthropic', { content: [{ type: 'thinking', thinking: 'privado' }, { type: 'text', text: 'Hola' }] }), 'Hola');
  assert.equal(providers.responseText('openai', { choices: [{ message: { content: 'Hola' } }] }), 'Hola');
  assert.equal(providers.responseText('ollama', { message: { content: 'Hola', thinking: 'privado' } }), 'Hola');
  assert.throws(() => providers.responseText('gemini', { promptFeedback: { blockReason: 'SAFETY' } }), /bloqueada/i);
});
test('consulta HTTP real a servidor local sin depender de Node en el módulo móvil', async t => {
  assert.equal(typeof providers.askProvider, 'function');
  let received;
  const server = http.createServer(async (req, res) => { let body = ''; for await (const chunk of req) body += chunk; received = { path: req.url, body: JSON.parse(body) }; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: 'Respuesta local comprobada' } }] })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const transport = async request => { const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body }); return { status: response.status, json: await response.json() }; };
  const answer = await providers.askProvider('openai', { model: 'prueba', apiKey: 'synthetic', baseUrl: `http://127.0.0.1:${server.address().port}/v1` }, 'Mi pregunta', 'Sistema', transport);
  assert.equal(answer, 'Respuesta local comprobada'); assert.equal(received.path, '/v1/chat/completions'); assert.equal(received.body.messages[1].content, 'Mi pregunta');
});
