'use strict';
const NETWORK_FOLDER='05 - Conocimiento/Red automática',NETWORK_PATH=NETWORK_FOLDER+'/Red automática.md';
const START='<!-- NEURONAS AUTO NETWORK -->',END='<!-- /NEURONAS AUTO NETWORK -->';
function workspaceRecords(memories,documents,attachments=[]){
  const records=[];
  for(const doc of [...documents].sort((a,b)=>(b.modified||0)-(a.modified||0))){if(doc.path===NETWORK_PATH||doc.path.startsWith(NETWORK_FOLDER+'/'))continue;records.push({id:'file:'+doc.path,path:doc.path,title:doc.title,type:doc.kind||'note',entityKind:['course','project'].includes(doc.kind)?doc.kind:'',project:['course','project'].includes(doc.kind)?doc.title:doc.project||doc.course||doc.notebook||'Notas',course:doc.course||'',source:'Obsidian',attribution:'note',content:doc.searchText||doc.excerpt||'',links:doc.links||[]});}
  for(const f of attachments)records.push({id:'file:'+f.path,path:f.path,title:f.basename||f.path.split('/').pop(),type:'attachment',project:f.path.split('/').slice(0,-1).join('/')||'Archivos',source:'Obsidian',attribution:'note',content:'Archivo adjunto: '+f.path});
  return [...records,...memories];
}
function attachmentsOf(app){return (app.vault.getFiles?.()||[]).filter(f=>f.extension!=='md'&&!f.path.startsWith('.'));}
async function updateNetworkIndex(app,documents,attachments=[]){
  const entries=new Map();for(const f of [...documents,...attachments])if(f.path&&!f.path.startsWith(NETWORK_FOLDER+'/'))entries.set(f.path,{path:f.path,title:f.title||f.basename||f.path.split('/').pop()});
  const list=[...entries.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  let group='',lines=[];
  for(const item of list){const folder=item.path.split('/').slice(0,-1).join('/')||'Raíz';if(folder!==group){group=folder;lines.push('\n## '+group.replace(/[\r\n]/g,' '));}const label=String(item.title).replace(/[\r\n]/g,' ').replace(/[\\[\]]/g,'\\$&');const target='../../'+item.path.split('/').map(encodeURIComponent).join('/');lines.push(`- [${label}](<${target}>)`);}
  const block=START+'\n# Red automática\n\nEste bloque enlaza tus archivos y se actualiza al guardarlos. Puedes escribir fuera del bloque automático.\n'+lines.join('\n')+'\n'+END;
  function replace(original){const start=original.indexOf(START),end=original.indexOf(END);if(start<0||end<start)throw new Error('El mapa automático fue editado. Se conserva sin reemplazarlo.');return original.slice(0,start)+block+original.slice(end+END.length);}
  let folder='';for(const part of NETWORK_FOLDER.split('/')){folder=folder?folder+'/'+part:part;if(!app.vault.getAbstractFileByPath(folder)){try{await app.vault.createFolder(folder);}catch(e){if(!app.vault.getAbstractFileByPath(folder))throw e;}}}
  const file=app.vault.getAbstractFileByPath(NETWORK_PATH);
  if(!file){await app.vault.create(NETWORK_PATH,block+'\n');return true;}
  const current=await app.vault.cachedRead(file);if(replace(current)===current)return false;
  await app.vault.process(file,replace);return true;
}
module.exports={NETWORK_FOLDER,NETWORK_PATH,workspaceRecords,attachmentsOf,updateNetworkIndex};
