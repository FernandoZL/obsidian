'use strict';
function isCaptureNoise(text, attribution = 'user') {
  if (attribution !== 'user') return false;
  return /^\s*(?:Usage limit reached;|Your claude\.ai usage limit has reset\.|Base directory for this skill:|<(?:bash-input|bash-stdout|bash-stderr|local-command-caveat|local-command-stdout|command-name)(?:\s|>))/i.test(text);
}
function sameCapture(a, b, { legacy = false } = {}) {
  if (a.type !== 'session' || b.type !== 'session' || a.source !== b.source || (a.attribution || 'user') !== (b.attribution || 'user')) return false;
  const content = a.content.trim();
  if (content.length < 120 || content !== b.content.trim()) return false;
  if (content.includes('[Extracto truncado a 6000 caracteres; consultar fuente local.]')) {
    if (a.contentHash || b.contentHash) return !!a.contentHash && a.contentHash === b.contentHash;
    return legacy;
  }
  return true;
}
function occurrenceOf({ content, path, bundlePath, occurrences, ...metadata }) { return metadata; }
function mergeOccurrences(canonical, duplicate) {
  const occurrences = [...(canonical.occurrences || [])];
  for (const entry of [occurrenceOf(duplicate), ...(duplicate.occurrences || [])]) {
    if (entry.id !== canonical.id && !occurrences.some(r => r.id === entry.id)) occurrences.push(entry);
  }
  return { ...canonical, occurrences };
}
module.exports = { isCaptureNoise, sameCapture, occurrenceOf, mergeOccurrences };
