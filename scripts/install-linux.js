#!/usr/bin/env node
'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('../bin/memory');
const { installLinux } = require('../src/linux');

async function main() {
  if (process.platform !== 'linux') throw new Error('Este instalador es para Linux. En Windows usa INSTALAR.bat.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Se requiere Node.js 22 o posterior.');
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node scripts/install-linux.js --vault <carpeta> [--prepare-only] [--without-connectors] [--home <perfil>] [--state <carpeta>]');
    return;
  }
  const { options } = parseArgs(args.filter(a => !['--prepare-only', '--without-connectors'].includes(a)));
  if (!options.vault) throw new Error('Indica --vault <carpeta de tu bóveda>.');
  const repo = path.resolve(__dirname, '..');
  try { await fs.access(path.join(repo, 'dist/main.js')); }
  catch { await require('./build').build(); }
  const result = await installLinux({ home: options.home, repo, vault: options.vault, state: options.state, connectors: !args.includes('--without-connectors') });
  if (!args.includes('--prepare-only') && !args.includes('--without-connectors')) {
    for (const command of [['daemon-reload'], ['enable', '--now', 'neuronas-memory.timer']]) {
      const run = spawnSync('systemctl', ['--user', ...command], { stdio: 'inherit' });
      if (run.error || run.status !== 0) throw new Error('Archivos preparados, pero systemd no pudo activar la captura. Revisá systemctl --user.');
    }
  }
  console.log(JSON.stringify(result, null, 2));
  console.log('Abrí una nueva sesión de tus consolas. Para iCloud, instalá rclone y ejecutá ~/.local/bin/icloud-conectar.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
