const { test } = require('node:test');
const assert = require('node:assert/strict');
let m={};try{m=require('../obsidian-plugin/inbox-model');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const docs=[{kind:'course',title:'Álgebra lineal',tags:['matrices']},{kind:'project',title:'Parcial uno',tags:[]}];
test('sugiere clasificación con materias existentes, acentos y etiquetas sin llamadas externas',()=>{
  assert.equal(typeof m.suggestOrganization,'function');
  const s=m.suggestOrganization('Apuntes de algebra lineal para Parcial uno. #repaso\nResolver ejercicios mañana.',docs,'2026-10-20');
  assert.equal(s.course,'Álgebra lineal');assert.equal(s.project,'Parcial uno');assert.equal(s.notebook,'university');assert.ok(s.tags.includes('repaso'));assert.equal(s.tasks.length,1);assert.equal(s.tasks[0].due,'2026-10-21');
});
test('no decide una materia ambigua ni convierte tareas completadas o ejemplos en pendientes',()=>{
  assert.equal(typeof m.suggestOrganization,'function');
  const s=m.suggestOrganization('Álgebra lineal y Cálculo.\n- [x] Leer el capítulo\n```\nEntregar informe mañana\n```\nNo tengo que comprar libros.',[...docs,{kind:'course',title:'Cálculo'}],'2026-10-20');
  assert.equal(s.course,'');assert.ok(s.warnings.length);assert.equal(s.tasks.length,0);
});
test('fechas españolas, viernes y fechas inválidas conservan la fecha del texto como referencia',()=>{
  assert.equal(typeof m.suggestOrganization,'function');
  const s=m.suggestOrganization('Entregar informe el 25 de octubre de 2026.\nLeer capítulo el viernes.\nPreparar resumen el 30/02/2026.',[], '2026-10-20');
  assert.equal(s.tasks[0].due,'2026-10-25');assert.equal(s.tasks[1].due,'2026-10-23');assert.equal(s.tasks[2].due,'');assert.ok(s.warnings.some(w=>/fecha/i.test(w)));
  const old=m.suggestOrganization('Entregar informe mañana.',[],null);assert.equal(old.tasks[0].due,'');assert.ok(old.warnings.length);
});
test('organizar conserva propiedades YAML, contenido y CRLF; no repite las tareas al reintentarlo',()=>{
  assert.equal(typeof m.applyOrganization,'function');
  const input='---\r\naliases:\r\n  - Mi apunte\r\ntags:\r\n  - viejo\r\ncustom: 42\r\n---\r\n# Apunte\r\nEntregar informe mañana.\r\n';
  const suggestions=m.suggestOrganization('Entregar informe mañana.',[], '2026-10-20');
  const values={title:'Apunte',course:'Álgebra lineal',project:'',notebook:'university',tags:['viejo','repaso']};
  const out=m.applyOrganization(input,values,suggestions.tasks,'2026-10-20');
  assert.ok(out.includes('aliases:\r\n  - Mi apunte\r\n'));assert.ok(out.includes('custom: 42'));assert.ok(out.includes('Entregar informe mañana.'));assert.equal((out.match(/- \[ \]/g)||[]).length,1);
  assert.equal(m.applyOrganization(out,values,suggestions.tasks,'2026-10-20'),out);
  assert.equal(m.suggestOrganization(out,[], '2026-10-20').tasks.length,0);
});
test('guardar no convierte contenido elegido como título en una ruta ni acepta fechas imposibles',()=>{
  assert.equal(typeof m.applyOrganization,'function');
  assert.throws(()=>m.applyOrganization('# Nota', {title:'Algo',notebook:'otro'},[]),/cuaderno/i);
  assert.throws(()=>m.applyOrganization('# Nota', {title:'Algo',notebook:'inbox'},[{text:'Leer',due:'2026-02-30'}]),/fecha/i);
});
test('reemplaza etiquetas YAML escritas como listas sin indentación sin dejar elementos huérfanos',()=>{
  const source='---\ntags:\n- original\ncustom: 42\n---\nMi apunte\n';
  const out=m.applyOrganization(source,{title:'Apunte',notebook:'inbox',tags:['original','repaso']},[]);
  assert.ok(!out.includes('\n- original\n'));assert.ok(out.includes('custom: 42'));assert.ok(out.includes('tags: ["original","repaso"]'));
});

test('guardar una nota existente detecta cambios simultáneos y conserva el texto editado y sus propiedades',async()=>{
  const {saveOrganizedNote}=require('../obsidian-plugin/inbox-save');
  const file={path:'00 - Inbox/Original.md',text:'---\ncustom: 7\n---\n# Original\nTexto anterior\n'};
  const files=new Map([[file.path,file]]);let writes=0;
  const app={vault:{getAbstractFileByPath:p=>files.get(p),createFolder:async p=>files.set(p,{path:p}),process:async(f,fn)=>{const next=fn(f.text);writes++;f.text=next;}},fileManager:{renameFile:async(f,to)=>{files.delete(f.path);f.path=to;files.set(to,f);}}};
  const source={path:file.path,text:file.text},values={title:'Organizada',notebook:'knowledge',content:'# Original\nTexto editado por el usuario\n'};
  file.text+='Cambio externo\n';await assert.rejects(saveOrganizedNote(app,values,[],source),/cambi/i);assert.equal(writes,0);
  file.text=source.text;await saveOrganizedNote(app,values,[],source);
  assert.match(file.text,/custom: 7/);assert.match(file.text,/Texto editado por el usuario/);assert.ok(!file.text.includes('Texto anterior'));assert.equal(file.path,'05 - Conocimiento/Notas/Organizada.md');
});
