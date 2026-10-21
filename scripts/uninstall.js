'use strict';
const { parseArgs } = require('../bin/memory');
const { uninstall } = require('../src/install');
require('../src/setup').resolveSetup(parseArgs(process.argv.slice(2)).options).then(uninstall).then(result => console.log(JSON.stringify(result, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; });
