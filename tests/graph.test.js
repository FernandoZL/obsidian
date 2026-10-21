const { test } = require('node:test');
const assert = require('node:assert/strict');
let buildGraph; try { ({ buildGraph } = require('../obsidian-plugin/graph')); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
test('el mapa neuronal enlaza cada recuerdo con su proyecto y su IA de origen', () => {
  assert.equal(typeof buildGraph, 'function');
  const graph = buildGraph([{ id: 'a', type: 'decision', project: 'Obsidian', source: 'codex', title: 'Decisión de proyecto', path: 'a.md', content: 'Algo útil' }, { id: 'b', type: 'learning', project: 'Obsidian', source: 'gemini', title: 'Aprendizaje', path: 'b.md' }]);
  assert.ok(graph.nodes.some(n => n.id === 'memory:a' && n.path === 'a.md'));
  assert.ok(graph.edges.some(e => e.source === 'memory:a' && e.target === 'project:Obsidian' && e.kind === 'project'));
  assert.ok(graph.edges.some(e => e.source === 'memory:b' && e.target === 'source:gemini' && e.kind === 'source'));
  assert.ok(graph.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)));
});
test('filtra proyectos y limita cantidad de neuronas sin enlaces rotos', () => {
  assert.equal(typeof buildGraph, 'function');
  const records = Array.from({ length: 200 }, (_, i) => ({ id: String(i), project: i % 2 ? 'A' : 'B', source: 'codex', type: 'session' }));
  const graph = buildGraph(records, { project: 'A', limit: 30 });
  assert.equal(graph.nodes.filter(n => n.kind === 'memory').length, 30);
  assert.ok(!graph.nodes.some(n => n.id === 'project:B'));
  const ids = new Set(graph.nodes.map(n => n.id)); assert.ok(graph.edges.every(e => ids.has(e.source) && ids.has(e.target)));
});
test('el mapa distribuye las neuronas sin amontonarlas en los bordes', () => {
  const records = Array.from({ length: 30 }, (_, i) => ({ id: String(i), project: i % 2 ? 'Obsidian' : 'General', source: i % 2 ? 'codex' : 'gemini', type: 'session' }));
  const graph = buildGraph(records);
  assert.ok(graph.nodes.filter(n => Math.abs(n.x) > 430 || Math.abs(n.y) > 265).length < 8);
});
test('la red elimina nodos repetidos, conserva recuerdos distintos y enlaza archivos nuevos por su origen',()=>{
  const {workspaceRecords}=require('../obsidian-plugin/network');
  const memories=[{id:'a',path:'m.md',content:'Uno',project:'Álgebra',source:'codex',type:'learning'},{id:'a',path:'copia.md',content:'Uno',project:'Álgebra',source:'codex',type:'learning'},{id:'a',path:'otro.md',content:'Distinto',project:'Álgebra',source:'codex',type:'learning'}];
  const documents=[{path:'Materias/Álgebra.md',title:'Álgebra',kind:'course',searchText:'La materia',tags:[]},{path:'Notas/Apunte.md',title:'Apunte',kind:'note',course:'Álgebra',searchText:'[[archivo.pdf]]',links:['archivo.pdf'],tags:[]}];
  const records=workspaceRecords(memories,documents,[{path:'archivo.pdf',basename:'archivo',extension:'pdf'}]);
  const graph=buildGraph(records,{limit:100});const ids=graph.nodes.map(n=>n.id);
  assert.equal(ids.length,new Set(ids).size);assert.equal(graph.nodes.filter(n=>n.kind==='memory'&&n.type==='learning').length,2);
  assert.equal(graph.nodes.filter(n=>n.label==='Álgebra').length,1);assert.ok(graph.nodes.some(n=>n.path==='archivo.pdf'));
  assert.ok(graph.edges.some(e=>e.kind==='link'));const keys=graph.edges.map(e=>e.source+'\0'+e.target+'\0'+e.kind);assert.equal(keys.length,new Set(keys).size);
});
test('el mapa nativo se actualiza al guardar y no escribe otra vez si nada ha cambiado',async()=>{
  const {updateNetworkIndex,NETWORK_PATH}=require('../obsidian-plugin/network');const files=new Map();let writes=0;
  const app={vault:{getAbstractFileByPath:p=>files.get(p),createFolder:async p=>files.set(p,{path:p}),create:async(p,text)=>{writes++;const f={path:p,text};files.set(p,f);return f;},cachedRead:async f=>f.text,process:async(f,fn)=>{const next=fn(f.text);if(next!==f.text)writes++;f.text=next;}}};
  await updateNetworkIndex(app,[{path:'Notas/Primera.md',title:'Primera'}],[]);const first=writes;
  await updateNetworkIndex(app,[{path:'Notas/Primera.md',title:'Primera'}],[]);assert.equal(writes,first);
  await updateNetworkIndex(app,[{path:'Notas/Primera.md',title:'Primera'},{path:'Notas/Nueva.md',title:'Nueva'}],[{path:'foto.png',basename:'foto'}]);
  assert.ok(files.get(NETWORK_PATH).text.includes('Nueva'));assert.ok(files.get(NETWORK_PATH).text.includes('foto.png'));assert.equal(writes,first+1);
});
test('una materia y un proyecto con el mismo título conservan sus archivos sin enlaces rotos',()=>{
  const {workspaceRecords}=require('../obsidian-plugin/network');
  const graph=buildGraph(workspaceRecords([],[{path:'Materias/Algebra.md',title:'Algebra',kind:'course'},{path:'Proyectos/Algebra.md',title:'Algebra',kind:'project'}]),{project:'Algebra'});
  assert.equal(new Set(graph.nodes.filter(n=>n.path?.endsWith('Algebra.md')).map(n=>n.path)).size,2);
  const ids=new Set(graph.nodes.map(n=>n.id));assert.ok(graph.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));
});
