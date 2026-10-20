#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { initVault } = require('../src/init');
const { saveMemory, readMemories } = require('../src/memory/store');
const { searchMemories } = require('../src/memory/retrieve');
const { sync } = require('../src/importer');
function parseArgs(args) {
  const options = {}, positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (['json', 'quiet', 'stdin'].includes(key)) options[key] = true;
      else { if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error('Falta valor para --' + key); options[key] = args[++i]; }
    } else positional.push(args[i]);
  }
  return { options, positional };
}
async function main(args) {
  const { options, positional } = parseArgs(args), command = positional.shift();
  if (!command || command === 'help') { console.log('Neuronas: init | add --text/--file/--stdin | search <tema> | context | sync | status | watch\nOpciones: --vault <ruta> --state <ruta> --json'); return; }
  const config = await loadConfig(options);
  if (command === 'init') return console.log(JSON.stringify(await initVault(config.vault)));
  if (command === 'rename') return console.log(JSON.stringify(await require('../src/memory/migrate').renameMemories(config.vault)));
  if (command === 'graphify-export') {
    const graph = require('../src/graphify').exportGraph(await readMemories(config.vault));
    const output = path.join(config.state, 'graphify/graph.json'); await fs.mkdir(path.dirname(output), { recursive: true });
    await require('../src/memory/store').atomicWrite(output, JSON.stringify(graph, null, 2));
    return console.log(JSON.stringify({ output, nodes: graph.nodes.length, links: graph.links.length }));
  }
  if (command === 'add') {
    const content = options.file ? await fs.readFile(options.file, 'utf8') : options.stdin ? await readStdin() : options.text;
    const result = await saveMemory(config.vault, { content, type: options.type || 'learning', project: options.project, source: options.source || 'manual', title: options.title, attribution: options.attribution || 'user' });
    return console.log(JSON.stringify(result));
  }
  if (command === 'search' || command === 'context') {
    const result = searchMemories(await readMemories(config.vault), positional.join(' '), { maxChars: Number(options['max-chars'] || 3200) });
    return console.log(options.json ? JSON.stringify(result) : result.text);
  }
  if (command === 'sync') {
    const result = await sync(config); if (!options.quiet) console.log(JSON.stringify(result));
    if (result.errors.length) process.exitCode = 1; return;
  }
  if (command === 'status') {
    const memories = await readMemories(config.vault); let lastSync = null;
    try { lastSync = JSON.parse(await fs.readFile(path.join(config.state, 'status.json'), 'utf8')); } catch(e) { if (e.code !== 'ENOENT') throw e; }
    return console.log(JSON.stringify({ memories: memories.length, vault: config.vault, lastSync }, null, 2));
  }
  if (command === 'watch') {
    const tick = async () => { try { await sync(config); } catch(e) { console.error(e.message); } };
    await tick(); setInterval(tick, 60000); return;
  }
  throw new Error('Comando desconocido: ' + command);
}
async function readStdin() { let text = ''; for await (const chunk of process.stdin) text += chunk; return text; }
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { main, parseArgs };
