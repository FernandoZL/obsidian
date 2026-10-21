'use strict';
const {safeTitle}=require('../src/memory/names');
const {LEGACY_PATHS}=require('../src/navigation');
async function migrateNavigation(app){
  const result={renamed:0,conflicts:[]};if(!app.fileManager?.renameFile)return result;
  async function rename(from,to){if(from===to)return;const file=app.vault.getAbstractFileByPath(from);if(!file)return;if(app.vault.getAbstractFileByPath(to)){result.conflicts.push(from);return;}await app.fileManager.renameFile(file,to);result.renamed++;}
  for(const [from,to]of Object.entries(LEGACY_PATHS))await rename(from,to);
  for(const file of app.vault.getMarkdownFiles().filter(f=>f.path.startsWith('09 - Memoria IA/Proyectos/'))){const text=await app.vault.cachedRead(file),title=text.match(/^# (.+)\r?\n/)?.[1];if(!title||!text.includes('Consulta los enlaces entrantes y el grafo local'))continue;await rename(file.path,'09 - Memoria IA/Proyectos/'+safeTitle('Recuerdos de '+title)+'.md');}
  return result;
}
module.exports={LEGACY_PATHS,migrateNavigation};
