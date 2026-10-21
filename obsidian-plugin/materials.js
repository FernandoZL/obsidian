'use strict';
const START='<!-- NEURONAS AUTO MATERIALS -->',END='<!-- /NEURONAS AUTO MATERIALS -->';
function folderOf(text){const front=text.replaceAll('\r\n','\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];const value=front?.match(/^material_folder:\s*(.+)$/m)?.[1];if(!value)return '';let folder;try{folder=JSON.parse(value);}catch{folder=value.replace(/^['"]|['"]$/g,'');}if(typeof folder!=='string')return '';folder=folder.replaceAll('\\','/').replace(/\/+$/,'');if(!folder||folder.startsWith('/')||folder.split('/').some(p=>p==='..'||p==='.'||p.startsWith('.')))return '';return folder;}
function relativeLink(source,target){const base=source.split('/');base.pop();const dest=target.split('/');while(base.length&&dest.length&&base[0]===dest[0]){base.shift();dest.shift();}return [...base.map(()=>'..'),...dest].map(encodeURIComponent).join('/');}
async function updateMaterialIndexes(app,documents){const errors=[];let updated=0;const files=app.vault.getFiles?.()||[];
for(const doc of documents){try{const file=app.vault.getAbstractFileByPath(doc.path);if(!file)continue;const original=await app.vault.cachedRead(file),folder=folderOf(original);if(!folder)continue;
const entries=new Map();for(const f of files)if(f.path!==doc.path&&!f.path.split('/').some(p=>p.startsWith('.'))&&f.path.startsWith(folder+'/'))entries.set(f.path,f);
for(const other of documents)if(other.path!==doc.path&&((doc.kind==='course'&&other.course===doc.title)||(doc.kind==='project'&&other.project===doc.title)))entries.set(other.path,other);
const sorted=[...entries.values()].sort((a,b)=>a.path.localeCompare(b.path));let group='',lines=[];
for(const item of sorted){const parent=item.path.split('/').slice(0,-1).join('/');if(parent!==group){group=parent;lines.push('\n### '+parent);}const label=String(item.title||item.path.split('/').pop()).replace(/[\r\n]/g,' ').replace(/[\\[\]]/g,'\\$&');lines.push('- ['+label+'](<'+relativeLink(doc.path,item.path)+'>)');}
const block=START+'\n## Material del curso y notas vinculadas\n\n'+entries.size+' archivos. Esta lista se actualiza automáticamente; escribe tus apuntes fuera del bloque.\n'+lines.join('\n')+'\n'+END;
const replace=text=>{const start=text.indexOf(START),end=text.indexOf(END);if(start<0&&end<0)return text.trimEnd()+'\n\n'+block+'\n';if(start<0||end<start||text.indexOf(START,start+START.length)>=0||text.indexOf(END,end+END.length)>=0)throw Error('Bloque automático incompleto');return text.slice(0,start)+block+text.slice(end+END.length);};
if(replace(original)!==original){await app.vault.process(file,replace);updated++;}
}catch{errors.push(doc.path);}}
return {updated,errors};}
module.exports={updateMaterialIndexes,folderOf,relativeLink,START,END};
