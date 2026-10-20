'use strict';
// This module intentionally has no Node imports: it also runs on iOS/Android.
const DEFAULT_URLS = { gemini: 'https://generativelanguage.googleapis.com/v1beta', anthropic: 'https://api.anthropic.com/v1', openai: 'https://api.openai.com/v1', ollama: 'http://127.0.0.1:11434' };
const PROVIDER_LABELS = { gemini: 'Google Gemini', anthropic: 'Claude (Anthropic)', openai: 'OpenAI u otro compatible', ollama: 'Ollama / servidor local' };
function buildRequest(provider, settings, prompt, system) {
  if (!DEFAULT_URLS[provider]) throw new Error('Proveedor no soportado');
  const model = String(settings.model || '').trim(); if (!model) throw new Error('Configura el modelo en Ajustes → Neuronas');
  const key = String(settings.apiKey || '').trim(); if (provider !== 'ollama' && !key) throw new Error('Configura la clave de API de este proveedor en Ajustes → Neuronas');
  let base = String(settings.baseUrl || DEFAULT_URLS[provider]).replace(/\/+$/, '');
  let parsed; try { parsed = new URL(base); } catch { throw new Error('URL de proveedor inválida'); }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('URL inválida: usa una dirección base sin credenciales ni parámetros');
  const headers = { 'Content-Type': 'application/json' };
  let body, endpoint;
  if (provider === 'gemini') {
    headers['x-goog-api-key'] = key; endpoint = `/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`;
    body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  } else if (provider === 'anthropic') {
    headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01'; endpoint = '/messages';
    body = { model, max_tokens: 2048, system, messages: [{ role: 'user', content: prompt }] };
  } else {
    endpoint = provider === 'ollama' ? '/api/chat' : '/chat/completions';
    if (key) headers.Authorization = 'Bearer ' + key;
    body = { model, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
  }
  return { url: base + endpoint, method: 'POST', headers, body: JSON.stringify(body), throw: false };
}
function responseText(provider, json) {
  let text;
  if (provider === 'gemini') {
    if (json.promptFeedback?.blockReason) throw new Error('Respuesta bloqueada por el proveedor');
    text = json.candidates?.[0]?.content?.parts?.filter(p => !p.thought && p.text).map(p => p.text).join('\n');
  } else if (provider === 'anthropic') text = json.content?.filter(p => p.type === 'text').map(p => p.text).join('\n');
  else if (provider === 'ollama') text = json.message?.content;
  else text = json.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('El proveedor no devolvió texto. Revisa el modelo, cuota o filtros.');
  return text;
}
async function askProvider(provider, settings, prompt, system, transport) {
  const request = buildRequest(provider, settings, prompt, system);
  let result;
  try { result = await transport(request); } catch { throw new Error('No se pudo conectar con el proveedor. Revisa la conexión y la dirección.'); }
  if (result.status < 200 || result.status >= 300) {
    const explanations = { 400: 'Solicitud o modelo no compatible', 401: 'Clave de API no válida', 403: 'Acceso no autorizado al modelo', 404: 'Modelo o dirección no encontrados', 429: 'Cuota o límite de solicitudes alcanzado' };
    throw new Error(`${explanations[result.status] || 'El proveedor devolvió un error'} (HTTP ${result.status}).`);
  }
  return responseText(provider, result.json);
}
module.exports = { DEFAULT_URLS, PROVIDER_LABELS, buildRequest, responseText, askProvider };
