'use strict';
// Luhn evita confundir tarjetas con otros números largos.
function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
function redact(text) {
  return String(text)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[CLAVE PRIVADA OMITIDA]')
    .replace(/\b(?:AIza[\w-]{30,}|github_pat_[\w]{20,}|gh[pousr]_[\w]{20,}|sk-[\w-]{20,}|xox[baprs]-[\w-]{20,}|AKIA[A-Z0-9]{16})\b/g, '[CREDENCIAL OMITIDA]')
    .replace(/\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g, '[TOKEN OMITIDO]')
    .replace(/\bBearer\s+[\w.\-+/=]{12,}/gi, 'Bearer [OMITIDO]')
    .replace(/\b([a-z][\w+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi, '$1[OMITIDO]@')
    .replace(/((?:["']?)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)(?:["']?)\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;\n]+)/gi, '$1[OMITIDO]')
    // Datos personales: DPI/CUI de Guatemala, tarjetas, cuentas bancarias y teléfonos.
    .replace(/\b(?:(DPI|CUI)\s*[:#]?\s*)?(\d{4}[ -]?\d{5}[ -]?\d{4})\b/gi, (m, label, num) => (label || /\d{4}[ -]\d{5}[ -]\d{4}/.test(num)) ? (label ? label + ': ' : '') + '[DPI OMITIDO]' : m)
    .replace(/\b[3-6]\d{3}(?:([ -]?)\d{4}\1\d{4}\1\d{4}|([ -]?)\d{6}\2\d{5})\b/g, m => luhn(m.replace(/\D/g, '')) ? '[TARJETA OMITIDA]' : m)
    .replace(/((?:n[uú]mero|no\.?|num\.?)\s+de\s+cuenta|cuenta\s+(?:bancaria|monetaria|de\s+ahorros?)|IBAN)(\s*[:#]?\s*)[A-Z]{0,4}\d[\d -]{5,}\d/gi, '$1$2[CUENTA OMITIDA]')
    .replace(/((?:tel[eé]fono|tel\.?|cel(?:ular)?|m[oó]vil|whatsapp|phone)\s*[:#]?\s*)\+?\d[\d -]{6,14}\d/gi, '$1[TELÉFONO OMITIDO]')
    .replace(/\+502[ -]?\d{4}[ -]?\d{4}\b/g, '[TELÉFONO OMITIDO]');
}
module.exports = { redact };
