#!/usr/bin/env node
'use strict';
const { loadConfig } = require('../src/config');
const { readMemories } = require('../src/memory/store');
const { searchMemories } = require('../src/memory/retrieve');
const { sync } = require('../src/importer');
const { parseArgs } = require('./memory');
async function main() {
  // Consume the protocol payload; no conversation data is echoed.
  let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 1024 * 1024) throw new Error('Entrada demasiado grande'); }
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [action, app] = positional, config = await loadConfig(options);
  if (action === 'start') {
    const context = searchMemories(await readMemories(config.vault), '', { maxChars: 3200 }).text;
    const specific = { additionalContext: context };
    if (app === 'claude') specific.hookEventName = 'SessionStart';
    console.log(JSON.stringify({ hookSpecificOutput: specific }));
  } else if (action === 'end') {
    const result = await sync(config);
    if (result.errors.length) console.error('Neuronas: errores de importación; consultar estado local');
    console.log('{}');
  } else throw new Error('Acción de hook inválida');
}
main().catch(e => { console.error('Neuronas: ' + e.message); console.log('{}'); });
