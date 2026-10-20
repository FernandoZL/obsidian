#!/usr/bin/env node
'use strict';
const readline = require('node:readline');
const { loadConfig } = require('../src/config');
const { parseArgs } = require('./memory');
const { handleRequest } = require('../src/mcp');
async function main() {
  const config = await loadConfig(parseArgs(process.argv.slice(2)).options);
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  // Sequential requests preserve writes and apply backpressure without polluting stdout.
  for await (const line of lines) {
    let request;
    try { request = JSON.parse(line); }
    catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }) + '\n'); continue; }
    try { const result = await handleRequest(request, config); if (result) process.stdout.write(JSON.stringify(result) + '\n'); }
    catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id || null, error: { code: -32603, message: 'Memoria no disponible' } }) + '\n'); }
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
