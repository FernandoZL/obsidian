'use strict';
const { safeTitle } = require('../src/memory/names');
const STATES = { pendiente: 'Pendiente', 'en-curso': 'En curso', hecho: 'Hecho' };
const FOLDERS = { note: '00 - Inbox/Notas', course: '02 - Universidad/Materias', project: '04 - Proyectos/Activos', task: '04 - Proyectos/Tareas' };
function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
function clean(value) { return String(value || '').replace(/[\r\n]/g, ' ').trim(); }
function makeDocument(kind, input, today = localDate()) {
  if (!FOLDERS[kind]) throw new Error('Tipo de nota desconocido');
  if (!clean(input.title)) throw new Error('Escribe un título');
  const title = safeTitle(clean(input.title)), course = input.course ? safeTitle(clean(input.course)) : '', project = input.project ? safeTitle(clean(input.project)) : '';
  const due = clean(input.due); if (due && !validDate(due)) throw new Error('La fecha debe ser válida');
  const tags = [...new Set((Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(/[,;]+/)).map(t => clean(t).replace(/^#/, '')).filter(Boolean))];
  const data = { workspace: 'neuronas', kind, title, created: today, course, project, tags };
  const notebooks = { inbox: '00 - Inbox/Notas', knowledge: '05 - Conocimiento/Notas', university: '02 - Universidad/Apuntes' };
  if (kind === 'note') data.notebook = input.notebook || (course ? 'university' : 'inbox');
  if (kind === 'task') data.due = due;
  if (kind === 'course') data.material_folder = '02 - Universidad/Materiales/' + title;
  const front = Object.entries(data).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  const links = [course && `[[02 - Universidad/Materias/${course}|${course}]]`, project && `[[04 - Proyectos/Activos/${project}|${project}]]`, '[[Inicio]]'].filter(Boolean).join(' · ');
  let body = input.content?.trim() || '';
  if (kind === 'task') body = `- [ ] ${title}${due ? ' 📅 ' + due : ''}\n\n${body}`;
  if (kind === 'course') body = `## Objetivo de la materia\n${body}\n\n## Apuntes y recursos\n\n## Próxima clase\n`;
  if (kind === 'project') body = `## Objetivo\n${body}\n\n## Próximo paso\n\n## Recursos y decisiones\n`;
  const folder = kind === 'note' ? notebooks[data.notebook] : kind === 'task' && course ? '02 - Universidad/Entregas' : FOLDERS[kind];
  if (!folder) throw new Error('Cuaderno inválido');
  return { title, folder, filename: title + '.md', text: `---\n${front}\n---\n\n# ${title}\n\n${body}\n\n${links}\n` };
}
function readDocument(text, file, cached = {}) {
  const lines = text.replaceAll('\r\n','\n').split('\n'), data = { ...cached };
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---',1);
    if(end >= 0) { start = end + 1; for(const line of lines.slice(1,end)) { const m = line.match(/^([\w-]+):\s*(.*)$/); if(m && data[m[1]] === undefined) { try { data[m[1]] = JSON.parse(m[2]); } catch { data[m[1]] = m[2].replace(/^['"]|['"]$/g,''); } } } }
  }
  const title = clean(data.title) || file.basename || file.path.split('/').pop().replace(/\.md$/,'');
  const tags = [...new Set([...(Array.isArray(data.tags) ? data.tags : String(data.tags || '').split(/[, ]+/)), ...[...lines.slice(start).join('\n').matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(m=>m[1])].filter(Boolean))];
  const doc = { path: file.path, title, kind: clean(data.kind) || 'note', organized: clean(data.organized), created: clean(data.created), course: clean(data.course), project: clean(data.project), notebook: file.path.split('/').slice(0,-1).join('/') || 'Raíz', tags, modified: file.stat?.mtime || 0, searchText: lines.slice(start).join('\n'), excerpt: lines.slice(start).filter(l=>l.trim() && !/^#|^\[\[/.test(l)).join(' ').slice(0,220), tasks: [], links:[...text.matchAll(/\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map(m=>m[1]) };
  let fence = '', comment = false, section = 'pendiente';
  for(let line = start; line < lines.length; line++) {
    const raw = lines[line], f = raw.match(/^\s*(`{3,}|~{3,})/);
    if(f) { if(!fence) fence=f[1]; else if(f[1][0]===fence[0] && f[1].length>=fence.length) fence=''; continue; }
    if(fence) continue;
    if(comment || raw.includes('<!--')) { comment = !raw.includes('-->'); continue; }
    const h=raw.match(/^#{1,6}\s+(.+?)\s*$/);
    if(h) section = /^en curso$/i.test(h[1]) ? 'en-curso' : /^(?:hecho|completad[oa]s?)$/i.test(h[1]) ? 'hecho' : 'pendiente';
    const match = raw.match(/^\s*[-*+] \[([ xX])\] (.*)$/); if(!match) continue;
    const explicit = match[2].match(/\s*\[estado::\s*(pendiente|en-curso|hecho)\]/);
    // The checkbox is authoritative when another Obsidian plugin completes/reopens a task.
    const state = match[1] !== ' ' ? 'hecho' : explicit?.[1] === 'hecho' ? 'pendiente' : explicit?.[1] || (section === 'hecho' ? 'pendiente' : section);
    const date = match[2].match(/📅\s*(\d{4}-\d{2}-\d{2})/)?.[1] || (doc.kind === 'task' ? clean(data.due) : '');
    doc.tasks.push({ path: file.path, line, raw, text: match[2].replace(/\s*\[estado::[^\]]*\]/g,'').replace(/\s*📅\s*\d{4}-\d{2}-\d{2}/g,'').trim(), state, due: validDate(date) ? date : '', course: doc.course, project: doc.project, source: title });
  }
  return doc;
}
function changeTaskState(text, task, state) {
  if(!STATES[state]) throw new Error('Estado inválido');
  const separator = text.includes('\r\n') ? '\r\n' : '\n', lines = text.split(/\r?\n/);
  if(lines[task.line] !== task.raw) throw new Error('La tarea cambió. Actualiza el panel antes de moverla.');
  const match=lines[task.line].match(/^(\s*[-*+] \[)[ xX](\] )(.*)$/); if(!match) throw new Error('La tarea cambió');
  const content=match[3].replace(/\s*\[estado::\s*(?:pendiente|en-curso|hecho)\]/g,'');
  lines[task.line]=match[1]+(state === 'hecho' ? 'x' : ' ')+match[2]+content+` [estado:: ${state}]`;
  return lines.join(separator);
}
function taskSummary(tasks, today=localDate()) {
  const open=tasks.filter(t=>t.state!=='hecho').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  return { open, overdue:open.filter(t=>t.due && t.due<today), today:open.filter(t=>t.due===today), upcoming:open.filter(t=>t.due>today) };
}
async function loadWorkspace(app) {
  const files=app.vault.getMarkdownFiles().filter(f=>!f.path.startsWith('09 - Memoria IA/')&&!f.path.startsWith('90 - Archivo/')&&!f.path.startsWith('05 - Conocimiento/Red automática/')&&!f.path.endsWith('.excalidraw.md'));
  const documents=[], errors=[];
  for(let i=0;i<files.length;i+=16) {
    const results=await Promise.allSettled(files.slice(i,i+16).map(async file=>{const text=await app.vault.cachedRead(file),cache=app.metadataCache?.getFileCache(file),doc=readDocument(text,file,cache?.frontmatter);if(cache?.links)doc.links=cache.links.map(link=>link.link);return doc;}));
    results.forEach((r,j)=>{if(r.status==='fulfilled')documents.push(r.value);else errors.push(files[i+j].path);});
  }
  for(const doc of documents)doc.links=doc.links.map(link=>app.metadataCache?.getFirstLinkpathDest?.(link,doc.path)?.path||link);
  return { documents, errors };
}
module.exports={STATES,FOLDERS,localDate,makeDocument,readDocument,changeTaskState,taskSummary,loadWorkspace};
