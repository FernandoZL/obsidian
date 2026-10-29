#!/usr/bin/env node
'use strict';
const { loadConfig } = require('../src/config');
const { parseArgs } = require('./memory');
const { organize } = require('../src/organizer/run');
async function main() {
  const { options } = parseArgs(process.argv.slice(2));
  const result = await organize(await loadConfig(options), { force: options.force === 'true' });
  if (!options.quiet) console.log(JSON.stringify(result));
}
main().catch(error => { console.error('Neuronas: ' + error.message); process.exitCode = 1; });
