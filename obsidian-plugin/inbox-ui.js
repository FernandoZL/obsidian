'use strict';
const { Modal, Notice, parseYaml } = require('obsidian');
const { localDate, readDocument } = require('./workbench-model');
const { NOTEBOOKS, suggestOrganization, validDate } = require('./inbox-model');
const { saveOrganizedNote } = require('./inbox-save');
const { prepareForm } = require('./mobile-form');
function button(el,text,fn,cls=''){const b=el.createEl('button',{text,cls});b.onclick=fn;return b;}
function field(el,name,tag='input',options={}){const label=el.createEl('label',{cls:'nn-smart-field'});label.createSpan({text:name});return label.createEl(tag,{...options,attr:{...options.attr,'aria-label':name}});}
class SmartInbox extends Modal {
  constructor(app,plugin,note){super(app);this.plugin=plugin;this.note=note;this.dirty=new Set();this.choices=new Map();this.saved=false;}
  async onOpen(){
    this.titleEl.setText(this.note?'Organizar esta nota':'Escribe. Yo te ayudo a ordenar.');this.modalEl.addClass('nn-smart-modal');this.cleanup=prepareForm(this);
    let source;
    if(this.note){try{const file=this.app.vault.getAbstractFileByPath(this.note.path);if(!file)throw new Error('La nota ya no existe');source={path:file.path,text:await this.app.vault.cachedRead(file)};const front=source.text.replaceAll('\r\n','\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/);const metadata=front&&parseYaml?parseYaml(front[1]):{};this.note=readDocument(source.text,file,metadata);if(this.note.kind!=='note')throw new Error('Esta nota ya no es un apunte. Abre su versión actual.');}
      catch(e){this.contentEl.createEl('p',{text:e.message});return;}}
    if(this.closed)return;
    this.source=source;
    const draft=!this.note?this.plugin.inboxDraft:null;
    this.data={title:'',course:'',project:'',notebook:'inbox',tags:'',content:'',...draft?.values};
    if(this.note){Object.assign(this.data,{title:this.note.title,course:this.note.course,project:this.note.project,tags:this.note.tags.join(', '),content:this.note.searchText,notebook:this.note.course?'university':this.note.path.startsWith('05 -')?'knowledge':'inbox'});for(const key of ['title','course','project','tags'])if(this.data[key])this.dirty.add(key);}
    else {for(const key of draft?.dirty||[])this.dirty.add(key);this.choices=new Map(draft?.choices||[]);}
    const docs=this.plugin.workspaceData?.documents||[];
    const intro=this.contentEl.createEl('p',{text:'Escribe o pega tus apuntes. Las sugerencias se calculan aquí, sin gastar tu API.',cls:'nn-muted'});
    const editor=field(this.contentEl,'Tu nota','textarea',{cls:'nn-smart-editor',placeholder:'Apuntes de mi materia…\nTengo que entregar el informe el viernes.\n#repaso',attr:{rows:'8'}});editor.value=this.data.content;this.editor=editor;
    const summary=this.contentEl.createDiv({cls:'nn-smart-summary',attr:{'aria-live':'polite'}});
    const details=this.contentEl.createEl('details',{cls:'nn-smart-details'});details.createEl('summary',{text:'Ajustar título y organización'});
    const fields=details.createDiv({cls:'nn-smart-fields'});this.inputs={};
    this.inputs.title=field(fields,'Título');
    const notebook=this.inputs.notebook=field(fields,'Cuaderno','select');for(const [value,text]of [['inbox','Inbox · ideas rápidas'],['knowledge','Conocimiento · notas y recursos'],['university','Universidad · apuntes']])notebook.createEl('option',{value,text});
    for(const [key,label,kind]of [['course','Materia','course'],['project','Proyecto','project']]){const select=this.inputs[key]=field(fields,label,'select');select.createEl('option',{value:'',text:'Sin asignar'});for(const name of [...new Set(docs.filter(n=>n.kind===kind).map(n=>n.title))])select.createEl('option',{value:name,text:name});if(this.data[key]&&![...select.options].some(o=>o.value===this.data[key]))select.createEl('option',{value:this.data[key],text:this.data[key]});}
    this.inputs.tags=field(fields,'Etiquetas · separadas por comas');
    for(const [key,input]of Object.entries(this.inputs)){input.value=this.data[key];const update=()=>{this.dirty.add(key);this.data[key]=input.value;this.updateSummary();};if(input.tagName==='SELECT')input.onchange=update;else input.oninput=update;}
    this.taskArea=this.contentEl.createDiv({cls:'nn-smart-task-list'});
    this.warningArea=this.contentEl.createDiv({cls:'nn-smart-warnings',attr:{'aria-live':'polite'}});
    const actions=this.contentEl.createDiv({cls:'nn-form-actions'});
    this.saveButton=button(actions,'Guardar y organizar',()=>this.save(),'mod-cta');button(actions,'Cerrar',()=>this.close());
    this.summary=summary;
    editor.oninput=()=>{this.data.content=editor.value;clearTimeout(this.timer);this.timer=setTimeout(()=>this.analyze(),280);};
    this.analyze();
    if(draft?.values?.content)intro.setText('Recuperé tu borrador de esta sesión. Puedes seguir escribiendo.');
    else if(!this.note)this.contentEl.createEl('p',{text:'Si cierras esta ventana, tu borrador se conserva mientras Obsidian siga abierto.',cls:'nn-draft-hint'});
  }
  analyze(){
    clearTimeout(this.timer);if(!this.inputs)return;
    const reference=this.note?(validDate(this.note.created)?this.note.created:null):localDate();
    const s=suggestOrganization(this.data.content,this.plugin.workspaceData?.documents||[],reference);this.suggestions=s;
    for(const key of ['title','course','project','notebook','tags'])if(!this.dirty.has(key)){this.data[key]=key==='tags'?s.tags.join(', '):s[key];this.inputs[key].value=this.data[key];}
    this.taskArea.empty();this.currentTasks=[];
    if(s.tasks.length){this.taskArea.createEl('h3',{text:`Posibles tareas · ${s.tasks.length}`});this.taskArea.createEl('p',{text:'Se añadirán como casillas en esta misma nota. Desmarca las que no quieras.',cls:'nn-muted'});}
    for(const task of s.tasks){let choice=this.choices.get(task.text);if(!choice){choice={...task,selected:true};this.choices.set(task.text,choice);}this.currentTasks.push(choice);
      const card=this.taskArea.createDiv({cls:'nn-smart-task'}),checkLabel=card.createEl('label',{cls:'nn-smart-task-check'}),check=checkLabel.createEl('input',{type:'checkbox'});check.checked=choice.selected;check.onchange=()=>choice.selected=check.checked;checkLabel.createSpan({text:'Crear esta tarea'});
      const title=field(card,'Texto de la tarea','textarea',{cls:'nn-task-editor',attr:{rows:'2'}});title.value=choice.text;title.oninput=()=>choice.text=title.value;
      const due=field(card,'Fecha de entrega','input',{type:'date'});due.value=choice.due;due.oninput=()=>choice.due=due.value;
    }
    this.warningArea.empty();for(const warning of s.warnings)this.warningArea.createEl('p',{text:warning});this.updateSummary();
    this.saveButton.disabled=!this.data.content.trim();
  }
  updateSummary(){if(!this.summary)return;this.summary.empty();this.summary.createEl('strong',{text:this.data.course||this.data.project||'Clasificación sugerida'});this.summary.createDiv({text:NOTEBOOKS[this.data.notebook]||'Inbox'});const tags=String(this.data.tags||'').trim();if(tags)this.summary.createDiv({text:tags,cls:'nn-muted'});}
  async save(){if(this.busy)return;this.analyze();if(!this.data.content.trim())return new Notice('Escribe tu nota antes de guardar.');this.busy=true;this.saveButton.disabled=true;
    try{const file=await saveOrganizedNote(this.app,this.data,this.currentTasks.filter(t=>t.selected),this.source,parseYaml);this.saved=true;if(!this.note)this.plugin.inboxDraft=null;this.close();await this.plugin.refresh();await this.app.workspace.openLinkText(file.path,'',false);new Notice('Nota organizada y tareas guardadas');}
    catch(e){new Notice(e.message);}
    finally{this.busy=false;this.saveButton.disabled=false;}
  }
  onClose(){this.closed=true;clearTimeout(this.timer);this.cleanup?.();if(!this.saved&&!this.note&&this.data)this.plugin.inboxDraft={values:{...this.data},dirty:[...this.dirty],choices:[...this.choices]};}
}
module.exports={SmartInbox};
