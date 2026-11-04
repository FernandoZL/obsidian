"use strict";
var { parseMemory: fromMarkdown, parseMemories: memoriesFromMarkdown2 } = require('../src/memory/format');
function toggleTask(text, lineIndex, expected) {
  const separator = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/), match = lines[lineIndex]?.match(/^(\s*[-*] \[)([ xX])(\] )(.*)$/);
  if (!match || match[4] !== expected) throw new Error("La tarea cambió; actualiza el panel");
  lines[lineIndex] = match[1] + (match[2] === " " ? "x" : " ") + match[3] + match[4];
  return lines.join(separator);
}
module.exports = { fromMarkdown, memoriesFromMarkdown: memoriesFromMarkdown2, toggleTask };
