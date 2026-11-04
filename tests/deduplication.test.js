const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { saveMemory, readMemories } = require('../src/memory/store');
const { renderBundle, parseMemories } = require('../src/memory/format');
const { adaptSession } = require('../src/adapters/claude');
const { planOrganization } = require('../src/organizer/vault');
const long = 'El lote conserva sus evidencias y requiere revisión del supervisor antes del cierre definitivo. '.repeat(3);
async function temp(t) { const p=await fs.mkdtemp(path.join(os.tmpdir(),'neuronas-dedup-')); t.after(()=>fs.rm(p,{recursive:true,force:true})); return fs.realpath(p); }

test('una captura larga con otro ID conserva una sola neurona, sus orígenes y las anclas anteriores', async t => {
  const vault=await temp(t);
  const first={id:'a',type:'session',source:'claude',session:'chat-a',attribution:'assistant',content:long};
  const a=await saveMemory(vault,first);
  const b=await saveMemory(vault,{...first,id:'b',session:'chat-b',sourcePath:'otra-conversacion.jsonl'});
  assert.equal(b.created,false);
  let records=await readMemories(vault);
  assert.equal(records.length,1);
  assert.equal(records[0].content,long);
  assert.ok(records[0].occurrences.some(r=>r.id==='b' && r.session==='chat-b'));
  assert.match(await fs.readFile(a.path.split('#')[0],'utf8'),/\^neuronas-b/);
  assert.equal((await saveMemory(vault,{...first,id:'b',session:'chat-b'})).created,false);
  records=await readMemories(vault);
  assert.equal(records[0].occurrences.length,1);
  await assert.rejects(saveMemory(vault,{...first,id:'b',content:long+' Cambio.'}),/conflicto/i);
});

test('la deduplicación no mezcla autorías, fuentes, tipos ni intervenciones cortas',async t=>{
 const vault=await temp(t);const r={type:'session',source:'codex',session:'chat',attribution:'user',content:long};
 for(const x of [{id:'a'},{id:'b',attribution:'assistant'},{id:'c',source:'claude'},{id:'d',type:'decision'},{id:'e',content:'Confirmo lo solicitado'},{id:'f',content:'Confirmo lo solicitado'}])await saveMemory(vault,{...r,...x});
 assert.equal((await readMemories(vault)).length,6);
});

test('los prefijos truncados distintos no se fusionan y las repeticiones concurrentes sí',async t=>{
 const vault=await temp(t);const content=long+'\n[Extracto truncado a 6000 caracteres; consultar fuente local.]';
 const r={type:'session',source:'claude',session:'chat',attribution:'user',content};
 await saveMemory(vault,{...r,id:'a',contentHash:'one'});await saveMemory(vault,{...r,id:'b',contentHash:'two'});
 assert.equal((await readMemories(vault)).length,2);
 const results=await Promise.all(['c','d','e'].map(id=>saveMemory(vault,{...r,id,content:long,contentHash:'complete'})));
 assert.equal(results.filter(r=>r.created).length,1);
 assert.equal((await readMemories(vault)).length,3);
});

test('la captura omite avisos y envoltorios de herramientas pero conserva una consulta humana sobre ellos',()=>{
 const event=text=>({type:'user',uuid:'a',sessionId:'chat',message:{role:'user',content:text}});
 for(const text of ['Usage limit reached; a short grace allowance remains, then this turn is cut off','Your claude.ai usage limit has reset. Continue the task you were working on','Base directory for this skill: C:/skills/example\nInstrucciones internas','<bash-input>echo prueba</bash-input>'])assert.equal(adaptSession(event(text),{},'chat.jsonl',1),null,text);
 assert.ok(adaptSession(event('Explícame por qué aparece Usage limit reached en mi consola.'),{},'chat.jsonl',1));
});

test('reorganizar temas no acumula portadas y conserva anotaciones y contenido de los registros',()=>{
 const folder='09 - Memoria IA/Sesiones/';const r={neuronas:1,type:'session',source:'codex',attribution:'user'};
 const a=folder+'A.md',b=folder+'B.md';
 let files=new Map([[a,Buffer.from(renderBundle([{...r,id:'a',content:long}], 'A')+'\nMi anotación personal.\n')],[b,Buffer.from(renderBundle([{...r,id:'b',content:'Otro recuerdo diferente'}],'B'))]]);
 const first=planOrganization(files,{summary:'Temas',groups:[{title:'Un tema',files:[a,b]}]});
 const target=[...first.output.keys()][0];const text=first.output.get(target);
 assert.equal((text.match(/^# /gm)||[]).length,1);
 assert.match(text,/Mi anotación personal/);
 assert.equal(parseMemories(text,target)[0].content,long);
});

test('actualizar procedencia no modifica ejemplos de marcadores dentro de un extracto',async t=>{
 const vault=await temp(t);const content=long+'\n<!-- neuronas-aliases -->\nEjemplo literal\n<!-- /neuronas-aliases -->\n';
 const r={type:'session',source:'claude',attribution:'user',content};
 await saveMemory(vault,{...r,id:'a'});await saveMemory(vault,{...r,id:'b'});
 assert.equal((await readMemories(vault))[0].content,content);
});

test('reparación respalda, conserva textos únicos, anotaciones, procedencia y referencias, y es idempotente',async t=>{
 const { repairVault, planRepair }=require('../src/memory/repair');
 const { snapshotVault }=require('../src/memory/consolidate');
 const vault=await temp(t),backupDirectory=await temp(t),folder='09 - Memoria IA/Sesiones/';
 await fs.mkdir(path.join(vault,folder),{recursive:true});
 const r={neuronas:1,type:'session',source:'claude',attribution:'assistant',date:'2026-10-20'};
 const a=folder+'A.md',b=folder+'B.md';
 await fs.writeFile(path.join(vault,a),renderBundle([{...r,id:'a',session:'uno',content:long}],'A'));
 const noise={...r,id:'noise',attribution:'user',content:'Your claude.ai usage limit has reset. Continue the task you were working on'};
 await fs.writeFile(path.join(vault,b),renderBundle([{...r,id:'b',session:'dos',content:long},{...r,id:'unique',content:'Un texto diferente que debe conservarse.'},noise],'B')+'\nMi anotación adicional.\n');
 await fs.writeFile(path.join(vault,'Inicio.md'),`[[${b.slice(0,-3)}#^neuronas-b|Referencia antigua]]`);
 await fs.writeFile(path.join(vault,'Mapa.canvas'),JSON.stringify({nodes:[{id:'n',file:b,subpath:'#^neuronas-b'}],edges:[]}));
 const result=await repairVault(vault,{backupDirectory});
 assert.equal(result.changed,true);assert.ok((await fs.stat(result.backup)).size>0);
 const records=await readMemories(vault);assert.equal(records.length,2);
 assert.equal(records.find(x=>x.id==='a').content,long);
 assert.equal(records.find(x=>x.id==='unique').content,'Un texto diferente que debe conservarse.');
 assert.equal(records.find(x=>x.id==='a').occurrences[0].session,'dos');
 assert.match(await fs.readFile(path.join(vault,b),'utf8'),/Mi anotación adicional/);
 assert.match(await fs.readFile(path.join(vault,a),'utf8'),/\^neuronas-b/);
 assert.match(await fs.readFile(path.join(vault,'Inicio.md'),'utf8'),/A#\^neuronas-b/);
 const node=JSON.parse(await fs.readFile(path.join(vault,'Mapa.canvas'),'utf8')).nodes[0];assert.equal(node.file,a);assert.equal(node.subpath,'#^neuronas-b');
 assert.equal(planRepair(await snapshotVault(vault)).output.size,0);
 assert.equal((await repairVault(vault,{backupDirectory})).changed,false);
});

test('una nota que solo tenía un aviso técnico conserva su anotación sin quedar como bundle inválido',async t=>{
 const {repairVault}=require('../src/memory/repair');const vault=await temp(t),backupDirectory=await temp(t);
 const folder=path.join(vault,'09 - Memoria IA/Sesiones');await fs.mkdir(folder,{recursive:true});
 const file=path.join(folder,'Aviso.md');
 await fs.writeFile(file,renderBundle([{neuronas:1,id:'notice',type:'session',source:'claude',attribution:'user',content:'Usage limit reached; a short grace allowance remains, then this turn is cut off'}],'Aviso')+'\nAnotación que no se borra.\n');
 await repairVault(vault,{backupDirectory});assert.equal((await readMemories(vault)).length,0);
 assert.match(await fs.readFile(file,'utf8'),/Anotación que no se borra/);
});

test('consolidar un recuerdo con alias no duplica sus anclas',async t=>{
 const {consolidateVault}=require('../src/memory/consolidate');const vault=await temp(t),backupDirectory=await temp(t);
 const r={type:'session',source:'claude',session:'chat',attribution:'user',content:long};
 await saveMemory(vault,{...r,id:'a'});await saveMemory(vault,{...r,id:'b'});
 await consolidateVault(vault,{backupDirectory});const record=(await readMemories(vault))[0];
 const text=await fs.readFile(path.join(vault,record.bundlePath),'utf8');assert.equal((text.match(/\^neuronas-b/g)||[]).length,1);
});

test('la reparación conserva propiedades YAML personalizadas aun sin duplicados',()=>{
 const {planRepair}=require('../src/memory/repair');const file='09 - Memoria IA/Sesiones/Uno.md';
 const text=renderBundle([{neuronas:1,id:'one',type:'session',source:'claude',content:'Mi recuerdo único'}],'Uno').replace('neuronasBundle: 1','neuronasBundle: 1\ntags: ["review"]\nowner: "Fernando"');
 const plan=planRepair(new Map([[file,Buffer.from(text)]]));assert.equal(plan.output.size,0);
});

test('la reparación conserva anotaciones anteriores al contenido y mueve todas las anclas de procedencia',()=>{
 const {planRepair}=require('../src/memory/repair');const folder='09 - Memoria IA/Sesiones/',a=folder+'A.md',b=folder+'B.md';
 const r={neuronas:1,type:'session',source:'claude',attribution:'assistant',content:long};
 const first=renderBundle([{...r,id:'a',date:'2026-10-20'}],'A');
 const second=renderBundle([{...r,id:'b',date:'2026-10-21',occurrences:[{id:'c',session:'tercera'}]}],'B').replace('<!-- contenido -->','Mi comentario antes del contenido.\n\n<!-- contenido -->');
 const files=new Map([[a,Buffer.from(first)],[b,Buffer.from(second)],['Inicio.md',Buffer.from(`[[${b}#^neuronas-c|Origen C]]`)],['Mapa.canvas',Buffer.from(JSON.stringify({nodes:[{file:b,subpath:'#^neuronas-c'}],edges:[]}))]]);
 const plan=planRepair(files);assert.match(plan.output.get(b),/Mi comentario antes del contenido/);
 assert.match(plan.output.get('Inicio.md'),/A#\^neuronas-c/);
 const node=JSON.parse(plan.output.get('Mapa.canvas')).nodes[0];assert.equal(node.file,a);assert.equal(node.subpath,'#^neuronas-c');
});
