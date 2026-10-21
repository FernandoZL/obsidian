'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {configPath}=require('./config');const {hash}=require('./memory/store');
async function resolveSetup(options={}, {home=os.homedir(),repo=path.resolve(__dirname,'..')}={}){
  let previous={};try{previous=JSON.parse(await fs.readFile(path.join(path.dirname(configPath(home)),'last-setup.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;try{previous=JSON.parse(await fs.readFile(configPath(home),'utf8'));}catch(inner){if(inner.code!=='ENOENT')throw inner;}}
  const vault=path.resolve(options.vault||previous.vault||path.join(home,'Documents','Neuronas'));
  const same=previous.vault&&path.resolve(previous.vault).toLowerCase()===vault.toLowerCase();
  const state=path.resolve(options.state||(same&&previous.state)||path.join(home,'AppData/Local/ObsidianNeuronas',previous.vault&&!same?'state-'+hash(vault):'state'));
  return {home,vault,state,repo,previousVault:options.previous,connectors:options.connectors===undefined?previous.connectors!==false:options.connectors!=='false'};
}
module.exports={resolveSetup};
