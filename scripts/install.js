'use strict';
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('../bin/memory');
const { install } = require('../src/install');
const { build } = require('./build');
const { options } = parseArgs(process.argv.slice(2));
const home = options.home || os.homedir();
build().then(() => install({ home, vault: options.vault || path.join(home, 'iCloudDrive/iCloud~md~obsidian/Obsidian'), state: options.state || path.join(home, 'AppData/Local/ObsidianNeuronas/state'), repo: path.resolve(__dirname, '..'), previousVault: options.previous })).then(result => console.log(JSON.stringify(result))).catch(e => { console.error(e.message); process.exitCode = 1; });
