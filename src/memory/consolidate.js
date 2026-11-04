"use strict";
var fs = require("node:fs/promises");
var path = require("node:path");
var os = require("node:os");
var { isDeepStrictEqual } = require("node:util");
var { ROOT: ROOT2, hash, atomicWrite, withLock } = require('./store');
var { parseMemory, parseMemories, renderRecord, renderBundle, headerOf } = require('./format');
var { safeTitle: safeTitle2 } = require('./names');
var { zipEntries } = require('../../scripts/archive');
var STORAGE = ROOT2 + "/.neuronas-storage.json";
var SUMMARY = "07 - Recursos/01 - Resumenes automaticos/";
async function snapshot(vault) {
  const files = /* @__PURE__ */ new Map();
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(md|canvas)$/.test(entry.name)) files.set(path.relative(vault, file).replaceAll("\\", "/"), await fs.readFile(file));
    }
  }
  await walk(vault);
  try {
    files.set(STORAGE, await fs.readFile(path.join(vault, STORAGE)));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return files;
}
function linkRewriter(files, replacements, { preserveFragments = false } = {}) {
  const names = /* @__PURE__ */ new Map();
  for (const file of files.keys()) {
    const name = path.posix.basename(file, ".md");
    names.set(name, names.has(name) ? null : file);
  }
  function resolve(target, origin) {
    let decoded;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      decoded = target;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith("#")) return null;
    if (replacements.has(decoded)) return replacements.get(decoded);
    const exactRelative = path.posix.normalize(path.posix.join(path.posix.dirname(origin), decoded));
    if (replacements.has(exactRelative)) return replacements.get(exactRelative);
    const part = decoded.split("#")[0].replaceAll("\\", "/");
    const candidates = [part, path.posix.normalize(path.posix.join(path.posix.dirname(origin), part))];
    let replacement;
    for (const p of candidates) for (const candidate of [p, p + ".md"]) if (replacements.has(candidate)) {
      replacement = replacements.get(candidate);
      break;
    }
    replacement || (replacement = replacements.get(names.get(part.replace(/\.md$/, ""))));
    if (replacement && decoded.includes("#")) {
      if (!preserveFragments) throw new Error("Conservar sección o fragmento requiere revisión antes de consolidar: " + target);
      replacement = replacement.split("#")[0] + "#" + decoded.split("#").slice(1).join("#");
    }
    return replacement || null;
  }
  return function rewrite(text, origin) {
    text = text.replace(/\[\[([^\]\n]+)\]\]/g, (whole, inner) => {
      const [target, ...labels] = inner.split("|"), replacement = resolve(target, origin);
      if (!replacement) return whole;
      const label = labels.length ? labels.join("|") : path.posix.basename(target.split("#")[0], ".md");
      return "[[" + replacement.replace(/\.md(?=#|$)/, "") + "|" + label + "]]";
    });
    function destination(target) {
      const replacement = resolve(target, origin);
      if (!replacement) return null;
      const [file, fragment] = replacement.split("#");
      const relative = path.posix.relative(path.posix.dirname(origin), file);
      return relative.split("/").map(encodeURIComponent).join("/") + (fragment ? "#" + encodeURIComponent(fragment) : "");
    }
    text = text.replace(/(\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)([^)\n]*\))/g, (whole, start, target, end) => {
      const bare = target.startsWith("<") ? target.slice(1, -1) : target, next = destination(bare);
      return next ? start + (target.startsWith("<") ? "<" + next + ">" : next) + end : whole;
    });
    return text.replace(/^(\s*\[[^\]\n]+\]:\s*)(<[^>\n]+>|\S+)(.*)$/gm, (whole, start, target, tail) => {
      const next = destination(target.startsWith("<") ? target.slice(1, -1) : target);
      return next ? start + "<" + next + ">" + tail : whole;
    });
  };
}
function planConsolidation(files, { summariesOnly = false } = {}) {
  const groups = /* @__PURE__ */ new Map(), replacements = /* @__PURE__ */ new Map(), output = /* @__PURE__ */ new Map(), remove = /* @__PURE__ */ new Set();
  let sessionsBefore = 0;
  for (const [file, buffer] of files) {
    if (summariesOnly) continue;
    if (path.posix.dirname(file) !== ROOT2 + "/Sesiones" || !file.endsWith(".md")) continue;
    const record = parseMemory(buffer.toString("utf8"), file);
    if (!record || record.type !== "session") continue;
    if (/\[\[(?:#|\^)|\]\(<?#/.test(buffer.toString("utf8"))) throw new Error("Conservar sección local requiere revisión antes de consolidar: " + file);
    sessionsBefore++;
    const key = JSON.stringify([record.source, record.session || record.id]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ file, text: buffer.toString("utf8"), record });
  }
  for (const [key, group] of groups) {
    group.sort((a, b) => String(a.record.date).localeCompare(String(b.record.date)) || a.file.localeCompare(b.file));
    const first = group[0].record;
    const title = safeTitle2(`${String(first.date || "").slice(0, 10)} · ${first.title || first.source || "Conversación"}`).slice(0, 85) + " · " + hash(key).slice(0, 8);
    const destination = ROOT2 + "/Sesiones/" + title + ".md";
    if (files.has(destination)) throw new Error("Ya existe el destino de conversación: " + destination);
    let text = renderBundle([], title);
    for (const item of group) {
      replacements.set(item.file, destination + "#^neuronas-" + item.record.id);
      remove.add(item.file);
      text += renderRecord(item.record, headerOf(item.text.replaceAll("\r\n", "\n")).body.replace(/^\s*# [^\n]*\n/, "")) + "\n";
    }
    output.set(destination, text);
  }
  const summaries = [...files].filter(([file]) => path.posix.dirname(file) === SUMMARY.slice(0, -1) && file.endsWith(".md") && file !== SUMMARY + "Resúmenes reunidos.md");
  if (summaries.length) {
    const destination = SUMMARY + "Resúmenes reunidos.md";
    let text = files.has(destination) ? files.get(destination).toString("utf8") + "\n\n" : "# Resúmenes reunidos\n\nResúmenes históricos completos. Se conservan sus fuentes y metadatos; pueden describir estados anteriores de la bóveda.\n\n";
    for (const [file, buffer] of summaries) {
      const original = buffer.toString("utf8").replaceAll("\r\n", "\n"), anchor = "resumen-" + hash(file + "\n" + original);
      replacements.set(file, destination + "#^" + anchor);
      remove.add(file);
      const { body } = headerOf(original), frontmatter = original.slice(0, original.length - body.length);
      let section = "## " + path.posix.basename(file, ".md") + "\n\nFuente original: `" + file + "` ^" + anchor + "\n\n";
      if (frontmatter) section += "````yaml\n" + frontmatter + "\n````\n\n";
      section += body + "\n\n---\n\n";
      if (text.includes("^" + anchor + "\n")) {
        if (!text.includes(section)) throw new Error("El resumen reunido fue editado; se conservan ambas fuentes: " + file);
      } else text += section;
    }
    output.set(destination, text);
  }
  const rewrite = linkRewriter(files, replacements);
  const indexPath = ROOT2 + "/Memoria IA.md";
  if (groups.size && files.has(indexPath)) {
    const entries = [...output.keys()].filter((file) => file.startsWith(ROOT2 + "/Sesiones/") && file.endsWith(".md"));
    const block = "\n\n<!-- NEURONAS CONVERSACIONES -->\n## Conversaciones reunidas\n\n" + sessionsBefore + " extractos conservados en " + groups.size + " conversaciones. Las decisiones, aprendizajes y preferencias permanecen separados para facilitar su consulta.\n\n" + entries.map((file) => "- [[" + file.slice(0, -3) + "|" + path.posix.basename(file, ".md") + "]]").join("\n") + "\n\n" + (summaries.length > 1 ? "[[07 - Recursos/01 - Resumenes automaticos/Resúmenes reunidos|Resúmenes históricos reunidos]]\n" : "") + "<!-- /NEURONAS CONVERSACIONES -->\n";
    output.set(indexPath, files.get(indexPath).toString("utf8") + block);
  }
  for (const [file, buffer] of files) {
    if (remove.has(file) || !/\.(md|canvas)$/.test(file)) continue;
    const original = buffer.toString("utf8");
    let text = original;
    if (file.endsWith(".canvas")) {
      const data = JSON.parse(text);
      let changed = false;
      for (const node of data.nodes || []) {
        const replacement = replacements.get(node.file);
        if (replacement) {
          if (node.subpath) throw new Error("Conservar sección de Canvas requiere revisión antes de consolidar: " + file);
          [node.file, node.subpath] = replacement.split(/(?=#)/);
          changed = true;
        }
        if (typeof node.text === "string") {
          const next = rewrite(node.text, file);
          if (next !== node.text) {
            node.text = next;
            changed = true;
          }
        }
      }
      if (changed) text = JSON.stringify(data, null, 2) + "\n";
    } else text = rewrite(text, file);
    if (text !== original) output.set(file, rewrite(output.get(file) || text, file));
  }
  for (const [file, text] of output) if (file.endsWith(".md")) output.set(file, rewrite(text, file));
  const expected = [], actual = [];
  for (const file of /* @__PURE__ */ new Set([...remove, ...output.keys()])) if (file.startsWith(ROOT2 + "/Sesiones/") && files.has(file)) expected.push(...parseMemories(rewrite(files.get(file).toString("utf8"), file), file));
  for (const [file, text] of output) if (file.startsWith(ROOT2 + "/Sesiones/")) actual.push(...parseMemories(text, file));
  const comparable = (records) => records.map(({ path: path2, bundlePath, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id) || a.content.localeCompare(b.content));
  if (!isDeepStrictEqual(comparable(expected), comparable(actual))) throw new Error("La consolidación cambiaría recuerdos; se conservan los originales");
  if (sessionsBefore) output.set(STORAGE, JSON.stringify({ sessionStorage: "conversation", version: 1 }, null, 2) + "\n");
  return { output, remove, replacements, sessionsBefore, conversationsAfter: groups.size, summariesBefore: summaries.length };
}
async function consolidateVault(vault, { backupDirectory = path.join(process.env.LOCALAPPDATA || os.homedir(), "ObsidianNeuronas", "backups"), summariesOnly = false, preparedPlan, expectedSnapshot } = {}) {
  vault = await fs.realpath(vault);
  backupDirectory = path.resolve(backupDirectory);
  if (backupDirectory === vault || backupDirectory.startsWith(vault + path.sep)) throw new Error("El respaldo debe quedar fuera de la bóveda");
  return withLock(vault + ":notes", async () => {
    const files = expectedSnapshot || await snapshot(vault), plan = preparedPlan || planConsolidation(files, { summariesOnly });
    if (!plan.remove.size && !plan.output.size) return { changed: false };
    await fs.mkdir(backupDirectory, { recursive: true });
    const backup = path.join(backupDirectory, "consolidacion-" + hash(vault).slice(0, 8) + "-" + (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-") + ".zip");
    await fs.writeFile(backup, zipEntries([...files].map(([name, data]) => ({ name, data }))), { flag: "wx" });
    const current = await snapshot(vault);
    if (current.size !== files.size || [...files].some(([file, data]) => !current.get(file)?.equals(data))) throw new Error("La bóveda cambió durante el respaldo; se conservan los originales");
    const written = /* @__PURE__ */ new Map(), deleted = /* @__PURE__ */ new Set();
    try {
      for (const [file, text] of plan.output) {
        const target = path.join(vault, file);
        const existing = await fs.readFile(target).catch((e) => {
          if (e.code !== "ENOENT") throw e;
          return null;
        });
        if (existing ? !files.get(file)?.equals(existing) : files.has(file)) throw new Error("Archivo cambiado simultáneamente: " + file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await atomicWrite(target, text);
        written.set(file, Buffer.from(text));
      }
      for (const [file, data] of written) {
        const disk = await fs.readFile(path.join(vault, file)).catch((e) => {
          if (e.code !== "ENOENT") throw e;
          return null;
        });
        if (!disk?.equals(data)) throw new Error("Destino cambiado simultáneamente: " + file);
        if (file.startsWith(ROOT2 + "/Sesiones/") && file.endsWith(".md") && !parseMemories(disk.toString("utf8"), file).length && !plan.emptyMemoryFiles?.has(file)) throw new Error("Conversación sin recuerdos");
      }
      for (const file of plan.remove) {
        const target = path.join(vault, file);
        if (!(await fs.readFile(target)).equals(files.get(file))) throw new Error("Archivo cambiado simultáneamente: " + file);
        await fs.unlink(target);
        deleted.add(file);
      }
    } catch (error) {
      for (const file of deleted) await fs.writeFile(path.join(vault, file), files.get(file), { flag: "wx" });
      for (const [file, data] of written) {
        const target = path.join(vault, file), current2 = await fs.readFile(target).catch(() => null);
        if (!current2?.equals(data)) continue;
        if (files.has(file)) await atomicWrite(target, files.get(file));
        else await fs.unlink(target);
      }
      throw error;
    }
    const result = { changed: true, backup, sessionsBefore: plan.sessionsBefore, conversationsAfter: plan.conversationsAfter, summariesBefore: plan.summariesBefore, filesBefore: [...files.keys()].filter((f) => f.endsWith(".md")).length, filesAfter: [...(await snapshot(vault)).keys()].filter((f) => f.endsWith(".md")).length };
    await fs.writeFile(backup + ".json", JSON.stringify({ ...result, vault, replacements: [...plan.replacements] }, null, 2));
    return result;
  });
}
module.exports = { consolidateVault, planConsolidation, linkRewriter, snapshotVault: snapshot };
