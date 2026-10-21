'use strict';
const {PAGE_SEEDS,LEGACY_PAGES}=require('../src/pages');
const {localDate}=require('./workbench-model');
const {relativeLink}=require('./materials');
const START='<!-- NEURONAS LIVE PAGE -->',END='<!-- /NEURONAS LIVE PAGE -->';
const same=(a,b)=>a.replaceAll('\r\n','\n').trim()===b.replaceAll('\r\n','\n').trim();
function isKanban(text){const front=text.replace(/^\uFEFF/,'').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]||'';return /^kanban-plugin:\s*["']?(?:board|basic)["']?\s*(?:#.*)?$/m.test(front);}
function label(value){return String(value||'Nota').replace(/[\r\n]/g,' ').replace(/[\\[\]]/g,'\\$&');}
function link(from,doc,text=doc.title){return `[${label(text)}](<${relativeLink(from,doc.path)}>)`;}
function list(from,items,empty,task=false){
  if(!items.length)return empty;
  const lines=items.slice(0,100).map(item=>'- '+link(from,item,task?item.text:item.title)+(task&&item.due?' · '+item.due:'')+(task&&item.course?' · '+label(item.course):''));
  if(items.length>100)lines.push(`\nMostrando 100 de ${items.length}. Consulta Neuronas para filtrar.`);
  return lines.join('\n');
}
async function updateLivePages(app,documents,today=localDate()){
  let updated=0;const errors=[],snapshots=new Map();
  for(const [p,seed]of Object.entries(PAGE_SEEDS)){
    const file=app.vault.getAbstractFileByPath(p);if(!file)continue;
    try{const text=await app.vault.cachedRead(file);snapshots.set(p,{file,text,pristine:same(text,LEGACY_PAGES[p]),seed});}catch{errors.push(p);}
  }
  const tasks=documents.filter(d=>!snapshots.get(d.path)?.pristine).flatMap(d=>d.tasks||[]);
  const open=tasks.filter(t=>t.state!=='hecho').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  const docs=documents.filter(d=>!PAGE_SEEDS[d.path]&&!d.path.startsWith('07 - Recursos/')&&!d.path.startsWith('09 - Memoria IA/'));
  const courses=docs.filter(d=>d.kind==='course').sort((a,b)=>a.title.localeCompare(b.title));
  const projects=docs.filter(d=>d.kind==='project').sort((a,b)=>a.title.localeCompare(b.title));
  const notes=docs.filter(d=>!['course','project','task'].includes(d.kind)).sort((a,b)=>(b.modified||0)-(a.modified||0));
  const section=(p,title,items,empty,task=false)=>'## '+title+'\n\n'+list(p,items,empty,task);
  for(const [p,snapshot]of snapshots){
    // Kanban serializes lists as cards and discards our delimiters. Keep custom boards untouched.
    if(!snapshot.pristine && isKanban(snapshot.text))continue;
    let content;
    if(p==='Inicio.md')content=section(p,'Mis materias',courses,'Todavía no hay materias.')+'\n\n'+section(p,'Para hoy',open.filter(t=>t.due===today),'No hay entregas con fecha para hoy.',true)+'\n\n'+section(p,'Proyectos',projects,'Todavía no hay proyectos.')+'\n\n'+section(p,'Notas recientes',notes.slice(0,8),'Aquí aparecerán tus notas.');
    if(p==='01 - Hoy/Hoy.md')content='**'+today+'**\n\n'+section(p,'Vencidas',open.filter(t=>t.due&&t.due<today),'No hay tareas vencidas.',true)+'\n\n'+section(p,'Para hoy',open.filter(t=>t.due===today),'No hay entregas con fecha para hoy.',true)+'\n\n'+section(p,'Próximas entregas',open.filter(t=>t.due>today),'No hay próximas entregas con fecha.',true)+'\n\n'+section(p,'Sin fecha',open.filter(t=>!t.due),'No hay tareas sin fecha.',true);
    if(p==='00 - Inbox/Inbox.md')content=section(p,'Por organizar',notes.filter(d=>d.path.startsWith('00 - Inbox/')),'Tu bandeja está vacía.');
    if(p==='02 - Universidad/Universidad.md')content=section(p,'Mis materias',courses,'Todavía no hay materias.')+'\n\n'+section(p,'Entregas pendientes',open.filter(t=>t.course),'No hay entregas pendientes.',true);
    if(p==='04 - Proyectos/Proyectos.md')content=section(p,'Proyectos activos',projects,'Todavía no hay proyectos. Crea uno desde Neuronas → Proyectos.');
    if(p==='04 - Proyectos/Tablero.md')content=['pendiente','en-curso','hecho'].map((state,i)=>section(p,['Pendiente','En curso','Hecho'][i],tasks.filter(t=>t.state===state),'No hay tareas en este estado.',true)).join('\n\n');
    if(p==='05 - Conocimiento/Mapa de conocimiento.md')content=section(p,'Apuntes y notas',notes,'Aquí aparecerán tus apuntes y notas.');
    const block=START+'\n'+content+'\n'+END;
    const replace=current=>{
      if(!same(current,LEGACY_PAGES[p]) && isKanban(current))return current;
      if(same(current,LEGACY_PAGES[p]))current=snapshot.seed;
      const start=current.indexOf(START),end=current.indexOf(END);
      if(start<0&&end<0)return current.trimEnd()+'\n\n'+block+'\n';
      if(start<0||end<start||current.indexOf(START,start+START.length)>=0||current.indexOf(END,end+END.length)>=0)throw Error('Bloque automático incompleto');
      return current.slice(0,start)+block+current.slice(end+END.length);
    };
    try{if(replace(snapshot.text)!==snapshot.text){await app.vault.process(snapshot.file,replace);updated++;}}catch{errors.push(p);}
  }
  return {updated,errors};
}
module.exports={updateLivePages,START,END};
