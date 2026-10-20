'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { redact } = require('./redact');
const { safeTitle, memoryTitle, uniqueMemories } = require('./names');
const ROOT = '09 - Memoria IA';
const FOLDERS = { session: 'Sesiones', decision: 'Decisiones', learning: 'Aprendizajes', profile: 'Perfil', project: 'Proyectos' };
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 24);
const slug = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'general';
function parseMemory(text, filePath) {
  text = text.replaceAll('\r\n', '\n');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(':'); if (i < 0) continue;
    try { data[line.slice(0, i)] = JSON.parse(line.slice(i + 1).trim()); } catch { /* Not our metadata. */ }
  }
  if (data.neuronas !== 1 || !data.id) return null;
  const body = text.slice(match[0].length);
  const content = body.split('\n<!-- contenido -->\n')[1]?.split('\n<!-- /contenido -->')[0];
  return content === undefined ? null : { ...data, content, path: filePath };
}
async function withLock(key, action) {
  const directory = path.join(os.tmpdir(), 'obsidian-neuronas-locks');
  await fs.mkdir(directory, { recursive: true });
  const lock = path.join(directory, hash(key) + '.lock');
  let handle;
  for (let i = 0; i < 100; i++) {
    try { handle = await fs.open(lock, 'wx'); await handle.writeFile(String(process.pid)); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const info = await fs.stat(lock).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 120000) {
        const pid = Number(await fs.readFile(lock, 'utf8').catch(() => ''));
        let alive = true; try { process.kill(pid, 0); } catch (err) { alive = err.code !== 'ESRCH'; }
        if (pid > 0 && !alive) await fs.unlink(lock).catch(() => {});
      }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
  if (!handle) throw new Error('Memoria ocupada; reintenta en unos segundos.');
  try { return await action(); } finally { await handle.close(); await fs.unlink(lock).catch(() => {}); }
}
async function atomicWrite(file, text) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temp, text, 'utf8');
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temp, file); break; }
      catch(e) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(e.code) || attempt >= 6) throw e;
        await new Promise(resolve => setTimeout(resolve, 30 * 2 ** attempt));
      }
    }
  }
  finally { await fs.unlink(temp).catch(() => {}); }
}
async function safeDirectory(vaultPath, relative) {
  const vault = await fs.realpath(vaultPath);
  let directory = vault;
  for (const piece of relative.split('/')) {
    directory = path.join(directory, piece);
    await fs.mkdir(directory).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const resolved = await fs.realpath(directory);
    if (resolved !== vault && !resolved.startsWith(vault + path.sep)) throw new Error('Ruta fuera de la bóveda');
  }
  return directory;
}
async function saveMemory(vaultPath, input) {
  if (!input.content?.trim()) throw new Error('El contenido no puede estar vacío');
  const content = redact(input.content).replaceAll('\r\n', '\n').replace(/<!--\s*\/?contenido\s*-->/g, '');
  const id = input.id || hash([input.source || 'manual', input.session || '', content].join('\n'));
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Identificador inválido');
  const type = input.type || 'learning';
  if (!FOLDERS[type]) throw new Error('Tipo de memoria inválido');
  const directory = await safeDirectory(vaultPath, `${ROOT}/${FOLDERS[type]}`);
  return withLock(path.resolve(vaultPath) + ':notes', async () => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.md'))) {
      const existingPath = path.join(directory, entry.name), old = parseMemory(await fs.readFile(existingPath, 'utf8'), existingPath);
      if (old?.id !== id) continue;
      if (old.content !== content) throw new Error('Conflicto: el identificador ya tiene otro contenido');
      return { id, path: existingPath, created: false };
    }
    const title = memoryTitle({ ...input, type, content, title: input.title && redact(input.title) });
    const file = await unusedName(directory, title);
    const project = redact(String(input.project || 'General')).replace(/[\r\n]/g, ' ');
    const record = { neuronas: 1, id, type, date: input.date || new Date().toISOString(), source: input.source || 'manual', session: input.session || '', project, status: input.status || 'recorded', attribution: input.attribution || 'user', title, sourcePath: input.sourcePath || '', links: input.links || [] };
    const projectDir = await safeDirectory(vaultPath, `${ROOT}/Proyectos`);
    let projectName = safeTitle(project), number = 1;
    while (true) {
      const existing = await fs.readFile(path.join(projectDir, projectName + '.md'), 'utf8').catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
      if (existing === null || existing.replaceAll('\r\n', '\n').split('\n')[0] === '# ' + project) break;
      projectName = safeTitle(project) + ` (${++number})`;
    }
    const frontmatter = Object.entries(record).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
    const body = `---\n${frontmatter}\n---\n\n# ${record.title.replace(/[\r\n]/g, ' ')}\n\n<!-- contenido -->\n${content}\n<!-- /contenido -->\n\nProyecto: [[${ROOT}/Proyectos/${projectName}|${project.replace(/[\[\]|]/g, '')}]]\n\n[[${ROOT}/Inicio|Memoria IA]] · [[Inicio|Inicio]]\n`;
    await atomicWrite(file, body);
    const projectFile = path.join(projectDir, projectName + '.md');
    await withLock(projectFile, async () => {
      if (!(await fs.stat(projectFile).catch(() => null))) await atomicWrite(projectFile, `# ${project}\n\n[[${ROOT}/Inicio|Memoria IA]]\n\nConsulta los enlaces entrantes y el grafo local para ver las sesiones y decisiones de este proyecto.\n`);
    });
    return { id, path: file, created: true };
  });
}
async function unusedName(directory, title) {
  let filename = path.join(directory, safeTitle(title) + '.md'), number = 1;
  while (await fs.stat(filename).catch(e => { if (e.code !== 'ENOENT') throw e; return null; })) filename = path.join(directory, safeTitle(title) + ` (${++number}).md`);
  return filename;
}
async function readMemories(vaultPath) {
  const result = [], root = path.join(vaultPath, ROOT);
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(e => { if (e.code !== 'ENOENT') throw e; return []; })) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.md')) {
        const record = parseMemory(await fs.readFile(file, 'utf8'), path.relative(vaultPath, file).replaceAll('\\', '/'));
        if (record) result.push(record);
      }
    }
  }
  await walk(root); return uniqueMemories(result);
}
module.exports = { ROOT, FOLDERS, hash, slug, saveMemory, readMemories, parseMemory, atomicWrite, withLock, unusedName };
