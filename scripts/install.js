'use strict';
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('../bin/memory');
const { install } = require('../src/install');
const { resolveSetup } = require('../src/setup');
const { options } = parseArgs(process.argv.slice(2));
const home = options.home || os.homedir();
async function main(){
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('Necesitas Node.js 22 o posterior.');
  if(options.prebuilt==='true'){
    const fs=require('node:fs/promises'),root=path.resolve(__dirname,'..');
    for(const name of ['main.js','styles.css','manifest.json'])await fs.access(path.join(root,'dist',name));
    const manifest=JSON.parse(await fs.readFile(path.join(root,'dist/manifest.json'),'utf8'));
    if(manifest.version!==require('../package.json').version)throw new Error('El paquete precompilado tiene otra versión. Descarga el ZIP completo de nuevo.');
  }else await require('./build').build();
  return install(await resolveSetup(options,{home,repo:path.resolve(__dirname,'..')}));
}
main().then(result=>console.log(JSON.stringify(result))).catch(e=>{console.error(e.message);process.exitCode=1;});
