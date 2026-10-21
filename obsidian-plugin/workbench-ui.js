'use strict';
const { Modal, Notice, Setting } = require('obsidian');
const { STATES, makeDocument, localDate, taskSummary, changeTaskState } = require('./workbench-model');
const { SmartInbox } = require('./inbox-ui');
const { prepareForm } = require('./mobile-form');
const LABELS = { note:'Nota', course:'Materia', project:'Proyecto', task:'Tarea / entrega' };
function action(el, text, fn, cls='') { const b=el.createEl('button',{text,cls}); b.onclick=fn; return b; }
function openNote(view, path) { return view.app.workspace.openLinkText(path,'',false); }
function hint(el,text) { el.createEl('p',{text,cls:'nn-muted'}); }
function heading(el,title,detail) { el.createEl('h2',{text:title}); if(detail)hint(el,detail); }
function notesOf(view) { return view.plugin.workspaceData?.documents || []; }
function tasksOf(view) { return notesOf(view).flatMap(n=>n.tasks); }
function noteLink(view,el,n) { return action(el,n.title,()=>openNote(view,n.path),'nn-note-link'); }
function noteCards(view,el,notes) {
  const grid=el.createDiv({cls:'nn-results'});
  if(!notes.length) hint(grid,'Aquí aparecerán tus notas. Usa «Nueva nota» para empezar.');
  for(const n of notes.slice(0,40)) { const card=grid.createDiv({cls:'nn-card'});card.createDiv({text:LABELS[n.kind]||'Nota',cls:'nn-eyebrow'}); noteLink(view,card,n); hint(card,n.excerpt || 'Abre la nota para escribir.'); const tags=card.createDiv({cls:'nn-chips'});for(const t of [n.course,n.project,...n.tags].filter(Boolean))tags.createSpan({text:t,cls:'nn-badge'});action(card,'Organizar',()=>new SmartInbox(view.app,view.plugin,n).open()); }
  if(notes.length>40)hint(el,`Mostrando 40 de ${notes.length} notas. Usa los filtros para acotar.`);
}
function memoryLink(view,el,name) {
  const count=view.plugin.records.filter(r=>r.project===name).length;
  action(el,`Recuerdos relacionados (${count})`,()=>{view.tab='memory';view.query=name;view.type='';view.render();});
}
async function updateTask(view,task,state) {
  try { const file=view.app.vault.getAbstractFileByPath(task.path);if(!file)throw new Error('La nota ya no existe');await view.app.vault.process(file,current=>changeTaskState(current,task,state));await view.plugin.refresh(); }
  catch(e) {new Notice(e.message);await view.plugin.refresh();}
}
function stateSelect(view,el,task) {
  const select=el.createEl('select',{attr:{'aria-label':`Estado de ${task.text}`}});
  for(const [key,text] of Object.entries(STATES))select.createEl('option',{value:key,text});select.value=task.state;
  select.onchange=async()=>{select.disabled=true;await updateTask(view,task,select.value);};return select;
}
function dueLabel(task) { return task.due ? (task.state!=='hecho' && task.due<localDate() ? 'Vencida · ' : '') + task.due : 'Sin fecha'; }
function taskRow(view,el,t) {
  const row=el.createDiv({cls:'nn-task'}),box=row.createEl('input',{type:'checkbox',attr:{'aria-label':`Completar ${t.text}`}});box.checked=t.state==='hecho';
  box.onchange=async()=>{box.disabled=true;await updateTask(view,t,box.checked?'hecho':'pendiente');};
  const body=row.createDiv({cls:'nn-task-content'});action(body,t.text,()=>openNote(view,t.path),'nn-note-link');
  body.createDiv({text:[dueLabel(t),t.course||t.project,t.source].filter(Boolean).join(' · '),cls:t.due && t.due<localDate() && t.state!=='hecho'?'nn-overdue':'nn-muted'});
}
function home(view,el) {
  const docs=notesOf(view),summary=taskSummary(tasksOf(view));
  const hero=el.createDiv({cls:'nn-work-hero'});hero.createDiv({text:new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'}),cls:'nn-eyebrow'});
  hero.createEl('h2',{text:'Tu día, con intención.'});hint(hero,'Captura una idea, avanza una entrega y retoma lo que estabas aprendiendo.');
  const actions=hero.createDiv({cls:'nn-actions'});action(actions,'+ Captura inteligente',()=>new SmartInbox(view.app,view.plugin).open(),'mod-cta');for(const kind of ['task','course','project'])action(actions,'+ '+LABELS[kind],()=>new Composer(view.app,view.plugin,kind).open());
  const metrics=el.createDiv({cls:'nn-work-metrics'});
  for(const [value,label,tab] of [[summary.today.length,'para hoy','tasks'],[summary.overdue.length,'vencidas','tasks'],[docs.filter(n=>n.kind==='course').length,'materias','university'],[docs.filter(n=>n.kind==='project').length,'proyectos','projects']]) { const b=action(metrics,'',()=>{view.tab=tab;view.render();},'nn-work-metric');b.createEl('strong',{text:String(value)});b.createSpan({text:label}); }
  const pending=docs.filter(n=>n.kind==='note'&&n.path.startsWith('00 - Inbox/')&&n.path!=='00 - Inbox/Inbox.md'&&!n.organized);
  if(pending.length){const inbox=el.createDiv({cls:'nn-inbox-queue'});heading(inbox,`Por organizar · ${pending.length}`,'Abre una nota para revisar sus sugerencias y guardarla en su cuaderno.');for(const note of pending.slice(0,4)){const row=inbox.createDiv({cls:'nn-inbox-row'});noteLink(view,row,note);action(row,'Organizar',()=>new SmartInbox(view.app,view.plugin,note).open());}if(pending.length>4)action(inbox,'Ver todas en Biblioteca',()=>{view.tab='library';view.render();});}
  const columns=el.createDiv({cls:'nn-home-columns'}),agenda=columns.createDiv({cls:'nn-section'}),recent=columns.createDiv({cls:'nn-section'});
  heading(agenda,'Lo siguiente',summary.overdue.length?'Primero las entregas vencidas; después las más próximas.':'Tus pendientes ordenados por fecha.');
  for(const t of summary.open.slice(0,6))taskRow(view,agenda,t);if(!summary.open.length)hint(agenda,'Sin pendientes. Puedes crear una tarea o escribir - [ ] en cualquier nota.');
  action(agenda,'Ver todas las tareas →',()=>{view.tab='tasks';view.render();});
  heading(recent,'Continúa donde te quedaste');for(const n of [...docs].sort((a,b)=>b.modified-a.modified).slice(0,7)){const item=recent.createDiv({cls:'nn-recent'});noteLink(view,item,n);hint(item,[LABELS[n.kind]||'Nota',n.course||n.project].filter(Boolean).join(' · '));}
  if(!docs.length)hint(recent,'Tus notas recientes aparecerán aquí.');
}
function university(view,el) {
  heading(el,'Mi universidad','Materias, apuntes y entregas reunidos.');
  const tools=el.createDiv({cls:'nn-actions'});action(tools,'+ Materia',()=>new Composer(view.app,view.plugin,'course').open(),'mod-cta');action(tools,'+ Entrega',()=>new Composer(view.app,view.plugin,'task').open());
  const docs=notesOf(view),courses=docs.filter(n=>n.kind==='course'),grid=el.createDiv({cls:'nn-projects nn-work-grid'});
  if(!courses.length)hint(grid,'Crea tu primera materia. Después podrás asociar sus apuntes y entregas.');
  for(const n of courses) {
    const tasks=tasksOf(view).filter(t=>t.course===n.title),s=taskSummary(tasks),notes=docs.filter(d=>d.kind==='note'&&d.course===n.title),card=grid.createDiv({cls:'nn-card'});
    card.createDiv({text:'MATERIA',cls:'nn-eyebrow'});noteLink(view,card,n);hint(card,`${notes.length} apuntes · ${s.open.length} entregas pendientes`);
    if(s.overdue.length)card.createEl('p',{text:`${s.overdue.length} entrega(s) vencida(s)`,cls:'nn-overdue'});
    action(card,'+ Apunte',()=>new Composer(view.app,view.plugin,'note',{course:n.title}).open());action(card,'+ Entrega',()=>new Composer(view.app,view.plugin,'task',{course:n.title}).open());
    for(const t of s.open.slice(0,3))taskRow(view,card,t);for(const note of notes.slice(0,3))noteLink(view,card,note);memoryLink(view,card,n.title);
  }
  const orphan=tasksOf(view).filter(t=>t.course&&!courses.some(c=>c.title===t.course));if(orphan.length){heading(el,'Entregas de otras materias');for(const t of orphan.slice(0,10))taskRow(view,el,t);}
}
function projects(view,el) {
  heading(el,'Mis proyectos','Objetivo, próximos pasos y recuerdos conectados.');action(el,'+ Proyecto',()=>new Composer(view.app,view.plugin,'project').open(),'mod-cta');
  const docs=notesOf(view),grid=el.createDiv({cls:'nn-projects nn-work-grid'}),projects=docs.filter(n=>n.kind==='project');
  for(const n of projects) {const all=tasksOf(view).filter(t=>t.project===n.title),done=all.filter(t=>t.state==='hecho').length,card=grid.createDiv({cls:'nn-card'});noteLink(view,card,n);hint(card,n.excerpt);const progress=card.createEl('progress',{attr:{max:String(all.length||1),value:String(done),'aria-label':`Avance de ${n.title}`}});progress.addClass('nn-progress');hint(card,`${done} de ${all.length} tareas completadas`);action(card,'+ Tarea',()=>new Composer(view.app,view.plugin,'task',{project:n.title}).open());action(card,'Ver tablero',()=>{view.taskProject=n.title;view.taskCourse='';view.taskState='';view.taskMode='board';view.tab='tasks';view.render();});memoryLink(view,card,n.title);}
  if(!projects.length)hint(grid,'Crea un proyecto y dale un objetivo. Sus tareas y recuerdos se reunirán aquí.');
  action(el,'Abrir tablero Markdown existente',()=>openNote(view,'04 - Proyectos/Tablero'));
}
function filterSelect(el,label,values,current,onChange) {
  const s=el.createEl('select',{attr:{'aria-label':label}});s.createEl('option',{text:label,value:''});for(const v of values)s.createEl('option',{text:v,value:v});s.value=current||'';s.onchange=()=>onChange(s.value);return s;
}
function tasks(view,el) {
  heading(el,'Tareas y entregas','Un mismo pendiente en tabla o tablero. Puedes arrastrar tarjetas o cambiar su estado con el selector.');
  const all=tasksOf(view),filters=el.createDiv({cls:'nn-work-filters'}),results=el.createDiv();
  const search=filters.createEl('input',{type:'search',placeholder:'Buscar una tarea…',attr:{'aria-label':'Buscar tareas'}});search.value=view.taskQuery||'';
  filterSelect(filters,'Todos los proyectos',[...new Set(all.map(t=>t.project).filter(Boolean))],view.taskProject,v=>{view.taskProject=v;draw();});
  filterSelect(filters,'Todas las materias',[...new Set(all.map(t=>t.course).filter(Boolean))],view.taskCourse,v=>{view.taskCourse=v;draw();});
  const state=filters.createEl('select',{attr:{'aria-label':'Filtrar estado'}});state.createEl('option',{text:'Todos los estados',value:''});for(const [key,text]of Object.entries(STATES))state.createEl('option',{text,value:key});state.value=view.taskState||'';state.onchange=()=>{view.taskState=state.value;draw();};
  const mode=filters.createEl('select',{attr:{'aria-label':'Vista de tareas'}});for(const [value,text]of [['board','Tablero'],['table','Tabla']])mode.createEl('option',{value,text});mode.value=view.taskMode||'board';mode.onchange=()=>{view.taskMode=mode.value;draw();};
  action(filters,'+ Tarea',()=>new Composer(view.app,view.plugin,'task',{course:view.taskCourse,project:view.taskProject}).open(),'mod-cta');
  search.oninput=()=>{view.taskQuery=search.value;draw();};
  function draw(){results.empty();const query=(view.taskQuery||'').toLocaleLowerCase();const filtered=all.filter(t=>(!view.taskProject||t.project===view.taskProject)&&(!view.taskCourse||t.course===view.taskCourse)&&(!view.taskState||t.state===view.taskState)&&(!query||[t.text,t.source,t.project,t.course].join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));const visible=filtered.slice(0,200);
    if(!visible.length){hint(results,'No hay tareas con estos filtros. Crea una tarea o cambia los filtros.');return;}
    if((view.taskMode||'board')==='board') {const board=results.createDiv({cls:'nn-kanban'});for(const [key,label]of Object.entries(STATES)){const group=visible.filter(t=>t.state===key),column=board.createDiv({cls:'nn-kanban-column'});column.createEl('h3',{text:`${label} · ${group.length}`});column.ondragover=e=>{e.preventDefault();};column.ondrop=e=>{e.preventDefault();const token=e.dataTransfer?.getData('text/plain');const t=visible.find(t=>t.path+'#'+t.line===token);if(t)updateTask(view,t,key);};for(const t of group){const card=column.createDiv({cls:'nn-card nn-kanban-card'});card.draggable=true;card.ondragstart=e=>{e.dataTransfer?.setData('text/plain',t.path+'#'+t.line);};action(card,t.text,()=>openNote(view,t.path),'nn-note-link');hint(card,[t.course||t.project,t.source].filter(Boolean).join(' · '));card.createDiv({text:dueLabel(t),cls:t.due&&t.due<localDate()&&key!=='hecho'?'nn-overdue':'nn-muted'});stateSelect(view,card,t);}}}
    else {const wrap=results.createDiv({cls:'nn-table-scroll'}),table=wrap.createEl('table',{cls:'nn-work-table'}),head=table.createEl('thead').createEl('tr');for(const text of ['Tarea','Estado','Fecha','Materia / proyecto'])head.createEl('th',{text});const body=table.createEl('tbody');for(const t of visible){const row=body.createEl('tr');action(row.createEl('td'),t.text,()=>openNote(view,t.path),'nn-note-link');stateSelect(view,row.createEl('td'),t);row.createEl('td',{text:dueLabel(t)});row.createEl('td',{text:[t.course,t.project].filter(Boolean).join(' · ')||'General'});}}
    if(filtered.length>200)hint(results,`Mostrando 200 de ${filtered.length} tareas. Filtra para ver las restantes.`);
  }draw();
}
function library(view,el) {
  heading(el,'Mi biblioteca','Tus notas y recursos, con búsqueda por título, contenido, tema y etiquetas.');
  const docs=notesOf(view).filter(n=>!['task','course','project'].includes(n.kind)),filters=el.createDiv({cls:'nn-work-filters'}),results=el.createDiv();
  const input=filters.createEl('input',{type:'search',placeholder:'Buscar en mis notas…',attr:{'aria-label':'Buscar notas'}});let tag='',course='',notebook='';input.value=view.libraryQuery||'';
  filterSelect(filters,'Todos los cuadernos',[...new Set(docs.map(n=>n.notebook))].sort(),'',v=>{notebook=v;draw();});
  filterSelect(filters,'Todas las etiquetas',[...new Set(docs.flatMap(n=>n.tags))].sort(),'',v=>{tag=v;draw();});
  filterSelect(filters,'Todas las materias',[...new Set(docs.map(n=>n.course).filter(Boolean))],'',v=>{course=v;draw();});
  action(filters,'+ Captura inteligente',()=>new SmartInbox(view.app,view.plugin).open(),'mod-cta');
  input.oninput=()=>{view.libraryQuery=input.value;draw();};
  function draw(){results.empty();const q=(view.libraryQuery||'').toLocaleLowerCase();noteCards(view,results,docs.filter(n=>(!tag||n.tags.includes(tag))&&(!notebook||n.notebook===notebook)&&(!course||n.course===course)&&(!q||[n.title,n.searchText,n.course,n.project,...n.tags].join(' ').toLocaleLowerCase().includes(q))).sort((a,b)=>b.modified-a.modified));}draw();
}
class Composer extends Modal {
  constructor(app,plugin,kind='note',initial={}){super(app);this.plugin=plugin;this.kind=kind;this.initial=initial;}
  onOpen(){this.titleEl.setText('Crear '+LABELS[this.kind].toLocaleLowerCase());const data={title:'',course:'',project:'',due:'',tags:'',content:'',...this.initial};let busy=false;
    this.cleanupForm=prepareForm(this);
    new Setting(this.contentEl).setName('Título').addText(t=>{t.setPlaceholder(this.kind==='course'?'Nombre de tu materia':'Un nombre fácil de reconocer').onChange(v=>data.title=v);if(window.matchMedia?.('(pointer: fine)').matches)setTimeout(()=>t.inputEl.focus(),30);});
    const docs=this.plugin.workspaceData?.documents||[];
    if(this.kind==='note')new Setting(this.contentEl).setName('Cuaderno').addDropdown(d=>d.addOptions({inbox:'Inbox · ideas rápidas',knowledge:'Conocimiento · notas y recursos',university:'Universidad · apuntes'}).setValue(data.course?'university':'inbox').onChange(v=>data.notebook=v));
    if(['note','task'].includes(this.kind)){for(const [field,label,kind]of [['course','Materia','course'],['project','Proyecto','project']])new Setting(this.contentEl).setName(label).addDropdown(d=>{d.addOption('','Sin asignar');for(const n of docs.filter(n=>n.kind===kind))d.addOption(n.title,n.title);d.setValue(data[field]||'').onChange(v=>data[field]=v);});}
    if(this.kind==='task')new Setting(this.contentEl).setName('Fecha de entrega').setDesc('Opcional. Se mostrará en tu agenda.').addText(t=>{t.inputEl.type='date';t.onChange(v=>data.due=v);});
    new Setting(this.contentEl).setName('Etiquetas').setDesc('Separadas por comas: universidad, lectura, ideas…').addText(t=>t.onChange(v=>data.tags=v));
    const area=this.contentEl.createEl('textarea',{cls:'nn-capture',placeholder:this.kind==='task'?'Detalles, instrucciones o enlaces de la tarea…':'Escribe aquí. Puedes usar Markdown y pegar enlaces…'});area.oninput=()=>data.content=area.value;
    const actions=this.contentEl.createDiv({cls:'nn-form-actions'});
    const save=action(actions,'Guardar '+LABELS[this.kind].toLocaleLowerCase(),async()=>{if(busy)return;busy=true;save.disabled=true;try{const doc=makeDocument(this.kind,data);if(['course','project'].includes(this.kind)){const existing=docs.find(n=>n.kind===this.kind&&n.title===doc.title);if(existing)throw new Error('Ya existe con ese nombre. Abre la nota existente.');}
      await ensureFolder(this.app,doc.folder);let path=doc.folder+'/'+doc.filename,index=1;while(this.app.vault.getAbstractFileByPath(path))path=doc.folder+'/'+doc.title+` (${++index}).md`;
      const file=await this.app.vault.create(path,doc.text);this.close();await this.plugin.refresh();await this.app.workspace.openLinkText(file.path,'',false);new Notice('Guardado en tu bóveda');
    }catch(e){new Notice(e.message);}finally{busy=false;save.disabled=false;}},'mod-cta');
  }
  onClose(){this.cleanupForm?.();}
}
async function ensureFolder(app,folder){let current='';for(const part of folder.split('/')){current=current?current+'/'+part:part;if(!app.vault.getAbstractFileByPath(current)){try{await app.vault.createFolder(current);}catch(e){if(!app.vault.getAbstractFileByPath(current))throw e;}}}}
function renderWorkTab(view,el,tab){({home,university,projects,tasks,library}[tab])(view,el);}
module.exports={Composer,renderWorkTab};
