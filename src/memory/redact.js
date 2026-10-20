'use strict';
function redact(text) {
  return String(text)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[CLAVE PRIVADA OMITIDA]')
    .replace(/\b(?:AIza[\w-]{30,}|github_pat_[\w]{20,}|gh[pousr]_[\w]{20,}|sk-[\w-]{20,}|xox[baprs]-[\w-]{20,}|AKIA[A-Z0-9]{16})\b/g, '[CREDENCIAL OMITIDA]')
    .replace(/\bBearer\s+[\w.\-+/=]{12,}/gi, 'Bearer [OMITIDO]')
    .replace(/((?:["']?)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)(?:["']?)\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;\n]+)/gi, '$1[OMITIDO]');
}
module.exports = { redact };
