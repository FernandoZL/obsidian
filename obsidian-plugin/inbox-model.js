'use strict';
const { safeTitle } = require('../src/memory/names');
const { localDate } = require('./workbench-model');
const NOTEBOOKS={inbox:'00 - Inbox/Notas',knowledge:'05 - Conocimiento/Notas',university:'02 - Universidad/Apuntes'};
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const weekdays=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
function proseLines(text){
  const lines=String(text).replaceAll('\r\n','\n').split('\n'),result=[];let start=0,fence='',comment=false;
  if(lines[0]==='---'){const end=lines.indexOf('---',1);if(end>=0)start=end+1;}
  for(const raw of lines.slice(start)){const f=raw.match(/^\s*(`{3,}|~{3,})/);if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence='';continue;}if(fence)continue;if(comment||raw.includes('<!--')){comment=!raw.includes('-->');continue;}result.push(raw);}
  return result;
}
function detectDate(text,reference,warnings){
  let date='';const iso=text.match(/\b(\d{4}-\d{2}-\d{2})\b/),slash=text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  const spanish=normalize(text).match(new RegExp('\\b(\\d{1,2}) de ('+months.join('|')+')(?: (?:de |del )?(\\d{4}))?\\b'));
  if(iso)date=iso[1];
  else if(slash)date=`${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`;
  else if(spanish){const year=spanish[3]||(validDate(reference)?reference.slice(0,4):'');if(!year){warnings.push('Revisa la fecha: falta el año.');return '';}date=`${year}-${String(months.indexOf(spanish[2])+1).padStart(2,'0')}-${spanish[1].padStart(2,'0')}`;}
  else {const normalized=normalize(text),day=weekdays.findIndex(d=>new RegExp('\\b'+d+'\\b').test(normalized)),relative=/\b(?:hoy|manana)\b/.test(normalized);
    if(day>=0||relative){if(!validDate(reference)){warnings.push('La fecha relativa necesita confirmación: esta nota no tiene una fecha de creación fiable.');return '';}
      const d=new Date(reference+'T12:00:00');let offset=/\bpasado manana\b/.test(normalized)?2:/\bmanana\b/.test(normalized)?1:0;
      if(day>=0){offset=(day-d.getDay()+7)%7;if(offset===0&&/\bproximo\b/.test(normalized))offset=7;}
      d.setDate(d.getDate()+offset);date=localDate(d);
    }
  }
  if(date&&!validDate(date)){warnings.push('Fecha no válida detectada; elige una fecha en la tarea.');return '';}
  if(/\b\d{1,2}\/\d{1,2}(?!\/\d{4})\b/.test(text)&&!slash)warnings.push('Confirma la fecha y el año de la tarea.');
  return date;
}
function taskText(value){return String(value).replace(/^\s*(?:[-*+]\s*)?(?:\[[ xX]\]\s*)?/,'').replace(/^(?:tengo que|debo|hay que|pendiente\s*:|tarea\s*:)\s*/i,'').replace(/\s*\[estado::[^\]]*\]/g,'').replace(/📅\s*/g,'').trim().replace(/[.;]+$/,'');}
function taskKey(value){return normalize(taskText(value).replace(/\b\d{4}-\d{2}-\d{2}\b/g,'').replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,'').replace(new RegExp('\\b\\d{1,2} de (?:'+months.join('|')+')(?: (?:de |del )?\\d{4})?','gi'),'').replace(/\b(?:el\s+)?(?:hoy|pasado mañana|mañana|(?:próximo\s+)?lunes|(?:próximo\s+)?martes|(?:próximo\s+)?mi[eé]rcoles|(?:próximo\s+)?jueves|(?:próximo\s+)?viernes|(?:próximo\s+)?s[aá]bado|(?:próximo\s+)?domingo)\b/gi,''));}
function existingTaskKeys(text){return new Set(proseLines(text).filter(l=>/^\s*[-*+] \[[ xX]\]/.test(l)).map(taskKey));}
function suggestOrganization(text,documents=[],reference=localDate()){
  const lines=proseLines(text),body=lines.join('\n'),norm=' '+normalize(body)+' ',warnings=[];
  function matchKind(kind){const candidates=[...new Set(documents.filter(n=>n.kind===kind).map(n=>n.title))].filter(title=>{const n=normalize(title);return n.length>=3&&norm.includes(' '+n+' ');});if(candidates.length===1)return candidates[0];if(candidates.length>1)warnings.push(`Hay varias ${kind==='course'?'materias':'coincidencias de proyecto'} posibles. Elige una.`);return '';}
  const course=matchKind('course'),project=matchKind('project');
  const tags=[...new Set([...body.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(m=>m[1]))];
  for(const tag of [...new Set(documents.flatMap(n=>n.tags||[]))]){const n=normalize(tag);if(n.length>=3&&norm.includes(' '+n+' ')&&!tags.includes(tag))tags.push(tag);}
  const notebook=course||/\b(universidad|materia|examen|apuntes|profesor|clase|entrega)\b/.test(norm)?'university':project||tags.length?'knowledge':'inbox';
  const title=safeTitle((lines.find(l=>l.trim()&&!/^\s*(?:[-*+] \[[ xX]\]|(?:materia|proyecto):)/i.test(l))||lines.find(l=>l.trim())||'Nota rápida').replace(/^#+\s*/,'').slice(0,90));
  const existing=existingTaskKeys(text),seen=new Set(existing),tasks=[];
  const pieces=lines.flatMap(l=>l.split(/[.!?]\s+(?=(?:tengo que|debo|hay que|entregar|resolver|preparar|leer|estudiar|terminar|enviar|revisar|investigar|comprar)\b)/i));
  for(const raw of pieces){if(/^\s*[-*+] \[[ xX]\]/.test(raw)||/^\s*>/.test(raw))continue;const candidate=raw.replace(/^\s*[-*+]\s+/,'').trim();
    if(!/^(?:tengo que|debo|hay que|pendiente\s*:|tarea\s*:|entregar\b|resolver\b|preparar\b|leer\b|estudiar\b|terminar\b|enviar\b|revisar\b|investigar\b|comprar\b)/i.test(candidate))continue;
    const title=taskText(candidate);if(title.length<5||seen.has(taskKey(title)))continue;
    seen.add(taskKey(title));tasks.push({text:title,due:detectDate(candidate,reference,warnings)});
  }
  return {title,course,project,notebook,tags:tags.slice(0,12),tasks:tasks.slice(0,30),warnings:[...new Set(warnings)],reference};
}
function appendTasks(text,tasks){
  const existing=existingTaskKeys(text),add=[];
  for(const task of tasks){const title=String(task.text||'').replace(/[\r\n]/g,' ').trim();if(!title)continue;if(task.due&&!validDate(task.due))throw new Error('La fecha de la tarea no es válida');const key=taskKey(title);if(existing.has(key))continue;existing.add(key);add.push(`- [ ] ${title}${task.due?' 📅 '+task.due:''}`);}
  return add.length?text.trimEnd()+'\n\n## Tareas detectadas\n\n'+add.join('\n')+'\n':text;
}
function applyOrganization(original,values,tasks=[],date=localDate()){
  if(!NOTEBOOKS[values.notebook])throw new Error('Cuaderno inválido');
  const separator=original.includes('\r\n')?'\r\n':'\n',text=original.replaceAll('\r\n','\n');
  const match=text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);if(text.startsWith('---\n')&&!match)throw new Error('Revisa el bloque de propiedades de esta nota antes de organizarla.');
  const tags=Array.isArray(values.tags)?values.tags:String(values.tags||'').split(/[,;]+/);
  const data={title:safeTitle(values.title||'Nota rápida'),course:values.course?safeTitle(values.course):'',project:values.project?safeTitle(values.project):'',notebook:values.notebook,tags:[...new Set(tags.map(t=>String(t).trim().replace(/^#/,'' )).filter(Boolean))],organized:date};
  const header=match?match[1].split('\n'):[],keep=[];
  for(let i=0;i<header.length;i++){const key=header[i].match(/^([\w-]+):/);if(key&&Object.hasOwn(data,key[1])){while(i+1<header.length&&/^(?:\s+\S|\s*$|-(?:\s|$))/.test(header[i+1]))i++;}else keep.push(header[i]);}
  while(keep.length&&!keep.at(-1).trim())keep.pop();
  const nextHeader=[...keep,...Object.entries(data).map(([k,v])=>k+': '+JSON.stringify(v))].join('\n');
  let body=appendTasks(match?text.slice(match[0].length):text,tasks);
  const links=[];for(const [kind,folder] of [['course','02 - Universidad/Materias'],['project','04 - Proyectos/Activos']]){if(!data[kind])continue;const target=folder+'/'+data[kind];if(!body.includes('[['+target+'|')&&!body.includes('[['+target+']]'))links.push(`[[${target}|${data[kind]}]]`);}
  if(links.length)body=body.trimEnd()+'\n\n'+links.join(' · ')+'\n';
  return ('---\n'+nextHeader+'\n---\n'+body).replaceAll('\n',separator);
}
module.exports={NOTEBOOKS,suggestOrganization,applyOrganization,appendTasks,validDate};
