#!/usr/bin/env node
'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('../bin/memory');
const { uninstallLinux } = require('../src/linux');

async function main() {
  if (process.platform !== 'linux') throw new Error('En Windows usa scripts/uninstall.ps1.');
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('node scripts/uninstall-linux.js [--state <carpeta>] [--home <perfil>] [--prepare-only]'); return; }
  const { options } = parseArgs(args.filter(a => a !== '--prepare-only'));
  const home = path.resolve(options.home || os.homedir());
  let state = options.state;
  if (!state) {
    const config = JSON.parse(await fs.readFile(path.join(home, '.config/neuronas/config.json'), 'utf8'));
    state = config.state;
  }
  state = path.resolve(state);
  const manifest = JSON.parse(await fs.readFile(path.join(state, 'installation.json'), 'utf8'));
  const result = await uninstallLinux({ home, state, beforeRemove: async () => {
    if (args.includes('--prepare-only')) return;
    // A plugin-only install never owns the user's shared background services.
    if (manifest.config !== path.join(home, '.config/neuronas/config.json')) return;
    const run = spawnSync('systemctl', ['--user', 'disable', '--now', 'neuronas-memory.timer', 'neuronas-icloud.timer'], { stdio: 'inherit' });
    if (run.error || run.status !== 0) throw new Error('No se pudieron detener los temporizadores. No se retiraron archivos.');
    const stop = spawnSync('systemctl', ['--user', 'stop', 'neuronas-memory.service', 'neuronas-icloud.service'], { stdio: 'inherit' });
    if (stop.error || stop.status !== 0) throw new Error('No se pudieron detener los servicios. No se retiraron archivos.');
  } });
  if (!args.includes('--prepare-only')) spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' });
  console.log(JSON.stringify(result, null, 2));
  console.log('Las notas y las credenciales de rclone se conservaron.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
