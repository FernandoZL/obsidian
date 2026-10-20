'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { saveMemory, atomicWrite, withLock, hash } = require('./memory/store');
const adapters = { codex: require('./adapters/codex'), claude: require('./adapters/claude'), gemini: require('./adapters/gemini'), antigravity: require('./adapters/antigravity') };
function defaultSources(home = os.homedir()) {
  return [{ app: 'codex', root: path.join(home, '.codex', 'sessions') }, { app: 'claude', root: path.join(home, '.claude', 'projects') }, { app: 'gemini', root: path.join(home, '.gemini', 'tmp') }, ...['antigravity-cli', 'antigravity', 'antigravity-ide'].map(app => ({ app: 'antigravity', root: path.join(home, '.gemini', app, 'brain') }))];
}
async function filesUnder(root) {
  const output = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(e => { if (e.code !== 'ENOENT') throw e; return []; })) {
      if (entry.isSymbolicLink()) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith('.jsonl')) output.push(p);
    }
  }
  await walk(root); return output;
}
async function sync({ vault, state, sources = defaultSources() }) {
  await fs.access(vault);
  const vaultReal = await fs.realpath(vault);
  const stateFull = path.resolve(state);
  if (stateFull === vaultReal || stateFull.startsWith(vaultReal + path.sep)) throw new Error('El estado debe quedar fuera de iCloud/bóveda');
  await fs.mkdir(state, { recursive: true });
  return withLock('sync:' + vaultReal, async () => {
    const checkpointPath = path.join(state, 'checkpoint.json');
    let checkpoint = {};
    try { checkpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('Estado ilegible: conservar checkpoint y reconstruirlo explícitamente'); }
    if (checkpoint._vault && checkpoint._vault !== vaultReal) throw new Error('El estado pertenece a otra bóveda; usa un directorio de estado diferente');
    checkpoint._vault = vaultReal;
    let agySessions = {};
    try { agySessions = JSON.parse(await fs.readFile(path.join(state, 'antigravity-sessions.json'), 'utf8')); } catch(e) { if (e.code !== 'ENOENT') throw e; }
    const result = { imported: 0, skipped: 0, errors: [], scanned: 0, date: new Date().toISOString() };
    for (const source of sources) {
      if (!adapters[source.app]) { result.errors.push({ source: source.app, error: 'Adaptador no soportado' }); continue; }
      let files;
      try { files = await filesUnder(source.root); } catch(e) { result.errors.push({ source: source.app, error: e.code || e.message }); continue; }
      for (const file of files) {
        if (source.app === 'antigravity' && path.basename(file) !== 'transcript.jsonl') continue;
        result.scanned++;
        const key = source.app + ':' + file;
        let handle;
        try {
          const previous = checkpoint[key] || { offset: 0, index: 0, meta: {} };
          handle = await fs.open(file, 'r'); const stat = await handle.stat();
          // Detect replacement even when its length stays unchanged. Prefix length is stable per checkpoint.
          const prefixLength = Math.min(previous.prefixLength || 128, stat.size);
          const prefixBuffer = Buffer.alloc(prefixLength); await handle.read(prefixBuffer, 0, prefixLength, 0);
          const prefixHash = hash(prefixBuffer);
          const regionChanged = previous.consumedHash && previous.offset <= stat.size && (await digestRegion(handle, previous.offset)) !== previous.consumedHash;
          const changed = previous.offset > stat.size || regionChanged || (previous.prefixHash && previous.prefixLength <= stat.size && previous.prefixHash !== prefixHash);
          let offset = changed ? 0 : previous.offset, index = changed ? 0 : previous.index;
          const meta = changed ? {} : { ...previous.meta };
          if (source.app === 'antigravity') {
            meta.session = path.basename(path.dirname(path.dirname(path.dirname(file))));
            const registered = agySessions[meta.session];
            if (registered && path.resolve(registered.transcriptPath) === path.resolve(file)) meta.project = registered.project;
          }
          if (stat.size === offset && !changed) continue;
          const buffer = Buffer.alloc(Math.min(stat.size - offset, 8 * 1024 * 1024));
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
          const lastNewline = buffer.subarray(0, bytesRead).lastIndexOf(10);
          if (lastNewline < 0) {
            if (bytesRead === 8 * 1024 * 1024) throw new Error('Línea de sesión mayor de 8 MB; no se omite automáticamente');
            continue;
          }
          for (const line of buffer.subarray(0, lastNewline + 1).toString('utf8').split('\n').slice(0, -1)) {
            index++;
            if (!line.trim()) continue;
            let event;
            try { event = JSON.parse(line); } catch { throw new Error('JSON de sesión inválido; punto de avance conservado'); }
            const record = adapters[source.app].adaptSession(event, meta, file, index);
            if (!record) continue;
            const written = await saveMemory(vault, record);
            if (written.created) result.imported++; else result.skipped++;
          }
          const nextOffset = offset + lastNewline + 1;
          checkpoint[key] = { offset: nextOffset, index, meta, prefixHash, prefixLength, consumedHash: await digestRegion(handle, nextOffset) };
        } catch (e) { result.errors.push({ source: source.app, file: path.basename(file), error: e.code || e.message }); }
        finally { await handle?.close(); }
      }
    }
    await atomicWrite(checkpointPath, JSON.stringify(checkpoint, null, 2));
    await atomicWrite(path.join(state, 'status.json'), JSON.stringify(result, null, 2));
    return result;
  });
}
async function digestRegion(handle, end) {
  const digest = createHash('sha256'), buffer = Buffer.alloc(65536);
  for (let offset = 0; offset < end;) {
    const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, end - offset), offset);
    if (!bytesRead) break;
    digest.update(buffer.subarray(0, bytesRead)); offset += bytesRead;
  }
  return digest.digest('hex');
}
module.exports = { sync, defaultSources };
