"use strict";
var path = require("node:path");
var { hash } = require('../memory/store');
var { redact: redact2 } = require('../memory/redact');
var { isCaptureNoise } = require('../memory/capture-policy');
function textContent(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.filter((x) => x && (!x.type || ["text", "input_text", "output_text"].includes(x.type))).map((x) => x.text || "").join("\n");
}
function normalized(app, event, state, file, index, role, text, eventId) {
  if (text.startsWith("NEURONAS_ORGANIZER_JOB\n")) state.internalOrganizer = true;
  if (state.internalOrganizer) return null;
  if (!["user", "assistant"].includes(role) || !text.trim()) return null;
  if (isCaptureNoise(text, role)) return null;
  if (text.trim().length < 10 || text.includes("<!-- NEURONAS START -->")) return null;
  if (/^\s*<(?:environment_context|system-reminder|local-command|command-name|permissions|skills_instructions|turn_aborted)/i.test(text)) return null;
  const session = state.session || path.basename(file, path.extname(file));
  const clean = redact2(text);
  return { id: hash(`${app}:${session}:${eventId || index}:${text}`), type: "session", title: `${app} · ${role === "user" ? "Usuario" : "Asistente"} · ${String(event.timestamp || "").slice(0, 16)}`, date: event.timestamp || state.date || (/* @__PURE__ */ new Date()).toISOString(), source: app, session, project: state.project || "General", attribution: role, status: "extract", sourcePath: file, contentHash: hash(clean), content: clean.slice(0, 6e3) + (clean.length > 6e3 ? "\n[Extracto truncado a 6000 caracteres; consultar fuente local.]" : "") };
}
function projectFromCwd(cwd) {
  const name = String(cwd || "").split(/[\\/]/).filter(Boolean).pop();
  const parts = String(cwd || "").split(/[\\/]/).filter(Boolean);
  return !name || /^(system32|windows)$/i.test(name) ? "General" : `${name} · ${parts.slice(0, -1).join(" / ")}`;
}
module.exports = { textContent, normalized, projectFromCwd };
