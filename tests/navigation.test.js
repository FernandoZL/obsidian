const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
test('una bóveda nueva tiene un Inicio y nombres distintos para sus índices y recuerdos',async t=>{
 const vault=await fs.mkdtemp(path.join(os.tmpdir(),'neuronas-indexes-'));t.after(()=>fs.rm(vault,{recursive:true,force:true}));await require('../src/init').initVault(vault);await require('../src/memory/store').saveMemory(vault,{content:'Mi tarea de universidad',project:'Universidad'});
 await fs.access(path.join(vault,'09 - Memoria IA/Memoria IA.md'));await fs.access(path.join(vault,'05 - Conocimiento/Mapa de conocimiento.md'));await fs.access(path.join(vault,'09 - Memoria IA/Proyectos/Recuerdos de Universidad.md'));
 await assert.rejects(fs.access(path.join(vault,'09 - Memoria IA/Inicio.md')),/ENOENT/);
});
test('la migración renombra los índices anteriores mediante Obsidian y no toca el Inicio principal',async()=>{
 const {migrateNavigation}=require('../obsidian-plugin/navigation');const files=new Map();for(const [name,text]of [['Inicio.md','# Inicio'],['09 - Memoria IA/Inicio.md','# Memoria compartida IA'],['05 - Conocimiento/Mapa.md','# Mapa de conocimiento'],['05 - Conocimiento/Red automática/Mapa.md','<!-- NEURONAS AUTO NETWORK -->'],['09 - Memoria IA/Proyectos/Universidad.md','# Universidad\n\nConsulta los enlaces entrantes y el grafo local para ver las sesiones y decisiones de este proyecto.']])files.set(name,{path:name,basename:name.split('/').pop().slice(0,-3),text});
 const app={vault:{getAbstractFileByPath:p=>files.get(p),getMarkdownFiles:()=>[...files.values()],cachedRead:async f=>f.text},fileManager:{renameFile:async(f,to)=>{files.delete(f.path);f.path=to;files.set(to,f);}}};
 const result=await migrateNavigation(app);assert.equal(result.renamed,4);assert.ok(files.has('Inicio.md'));assert.ok(files.has('09 - Memoria IA/Memoria IA.md'));assert.ok(files.has('09 - Memoria IA/Proyectos/Recuerdos de Universidad.md'));assert.equal((await migrateNavigation(app)).renamed,0);
});
test('al actualizar no se crea un segundo índice antes de migrar el anterior',async t=>{
 const vault=await fs.mkdtemp(path.join(os.tmpdir(),'neuronas-old-index-'));t.after(()=>fs.rm(vault,{recursive:true,force:true}));await fs.mkdir(path.join(vault,'09 - Memoria IA'),{recursive:true});await fs.writeFile(path.join(vault,'09 - Memoria IA/Inicio.md'),'Un índice anterior');await require('../src/init').initVault(vault);await assert.rejects(fs.access(path.join(vault,'09 - Memoria IA/Memoria IA.md')),/ENOENT/);
});
test('capturar una memoria durante una actualización reutiliza su índice anterior sin crear copia',async t=>{
 const vault=await fs.mkdtemp(path.join(os.tmpdir(),'neuronas-project-index-'));t.after(()=>fs.rm(vault,{recursive:true,force:true}));const folder=path.join(vault,'09 - Memoria IA/Proyectos');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'Universidad.md'),'# Universidad\n\nConsulta los enlaces entrantes y el grafo local para ver las sesiones y decisiones de este proyecto.\n');await require('../src/memory/store').saveMemory(vault,{content:'Otra entrega de mi materia',project:'Universidad'});await assert.rejects(fs.access(path.join(folder,'Recuerdos de Universidad.md')),/ENOENT/);
});
