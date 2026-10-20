'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'); let files = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.js')) { const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (check.status !== 0) throw new Error(check.stderr); files++; }
  }
}
for (const directory of ['src', 'bin', 'scripts', 'obsidian-plugin', 'tests', 'dist']) walk(path.join(root, directory));
console.log(`${files} archivos JavaScript: sintaxis válida`);
