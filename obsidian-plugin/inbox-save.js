'use strict';
const { makeDocument } = require('./workbench-model');
const { NOTEBOOKS, applyOrganization } = require('./inbox-model');
async function ensureFolder(app,folder){let current='';for(const part of folder.split('/')){current=current?current+'/'+part:part;if(!app.vault.getAbstractFileByPath(current)){try{await app.vault.createFolder(current);}catch(e){if(!app.vault.getAbstractFileByPath(current))throw e;}}}}
async function saveOrganizedNote(app,values,tasks,source,parseYaml){
  // Validate everything before the first filesystem change.
  const doc=makeDocument('note',values),folder=NOTEBOOKS[values.notebook];
  let original=source?source.text:doc.text;
  if(source&&values.content!==undefined){const separator=original.includes('\r\n')?'\r\n':'\n',normalized=original.replaceAll('\r\n','\n'),header=normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);if(normalized.startsWith('---\n')&&!header)throw new Error('Revisa las propiedades de la nota.');original=((header?.[0]||'')+String(values.content).replaceAll('\r\n','\n')).replaceAll('\n',separator);}
  const updated=applyOrganization(original,values,tasks);
  if(parseYaml){try{const header=updated.replaceAll('\r\n','\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/);const parsed=parseYaml(header[1]);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid mapping');}catch{throw new Error('No se puede organizar sin alterar propiedades especiales de esta nota. Edita sus propiedades manualmente.');}}
  await ensureFolder(app,folder);
  let target=folder+'/'+doc.filename,index=1;
  while(app.vault.getAbstractFileByPath(target)&&target!==source?.path)target=folder+'/'+doc.title+` (${++index}).md`;
  if(!source)return app.vault.create(target,updated);
  const file=app.vault.getAbstractFileByPath(source.path);if(!file)throw new Error('La nota ya no existe. Abre su versión actual.');
  await app.vault.process(file,current=>{if(current!==source.text)throw new Error('La nota cambió en otro lugar. Cierra esta ventana y vuelve a organizarla.');return updated;});
  // Keep the retry snapshot current if iCloud temporarily blocks the rename.
  source.text=updated;
  if(file.path!==target)await app.fileManager.renameFile(file,target);
  source.path=file.path;
  return file;
}
module.exports={saveOrganizedNote};
