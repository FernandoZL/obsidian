'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
function configPath(home = os.homedir()) { return path.join(home, 'AppData', 'Local', 'ObsidianNeuronas', 'config.json'); }
async function loadConfig(options = {}) {
  let config = {};
  try { config = JSON.parse(await fs.readFile(options.config || configPath(), 'utf8')); }
  catch(e) { if (e.code !== 'ENOENT') throw e; }
  const vault = options.vault || config.vault;
  if (!vault) throw new Error('Primero instala o indica --vault <ruta>');
  return { ...config, vault: path.resolve(vault), state: path.resolve(options.state || config.state || path.join(os.homedir(), 'AppData/Local/ObsidianNeuronas/state')) };
}
module.exports = { configPath, loadConfig };
