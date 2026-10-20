#!/usr/bin/env node
'use strict';
const { loadConfig } = require('../src/config');
const { parseArgs } = require('./memory');
const { handleAntigravityHook } = require('../src/antigravity');
async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 1024 * 1024) throw new Error('Evento demasiado grande'); }
  const result = await handleAntigravityHook(positional[0], JSON.parse(input || '{}'), await loadConfig(options));
  console.log(JSON.stringify(result));
}
main().catch(e => { console.error('Neuronas: ' + e.message); console.log('{}'); });
