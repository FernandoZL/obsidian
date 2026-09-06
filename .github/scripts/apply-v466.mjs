import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const corePath = path.join(root, 'installer/payload/.obsidian/plugins/jarvis-core/main.js');
const stylesPath = path.join(root, 'installer/payload/.obsidian/plugins/jarvis-core/styles.css');
const manifestPaths = [
  'installer/payload/.obsidian/plugins/jarvis-core/manifest.json',
  'installer/payload/.obsidian/plugins/jarvis-local-ai/manifest.json',
].map((p) => path.join(root, p));
const versionPath = path.join(root, 'VERSION');

function fail(message) {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
}

function replaceOnce(text, oldValue, newValue, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== 1) fail(`${label}: esperaba 1 coincidencia y encontre ${count}`);
  return text.replace(oldValue, newValue);
}

function replaceBetween(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) fail(`${label}: no se encontraron limites`);
  return text.slice(0, start) + replacement + text.slice(end);
}

let core = fs.readFileSync(corePath, 'utf8').replace(/\r\n/g, '\n');
let styles = fs.readFileSync(stylesPath, 'utf8').replace(/\r\n/g, '\n');

// Heartbeat de la version de prueba.
core = replaceOnce(core, 'version: "4.6.5",', 'version: "4.6.6",', 'heartbeat');

// Fecha regional reutilizable.
core = replaceOnce(
  core,
  `  currentMonth() {\n    return this.todayIso().slice(0, 7);\n  }`,
  `  formatDate(date, options = {}) {\n    const value = String(date || "").trim();\n    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value;\n    const locale = String(this.settings.locale || (typeof navigator !== "undefined" ? navigator.language : "es-GT") || "es-GT");\n    const parsed = new Date(\`${'${value}'}T12:00:00\`);\n    if (Number.isNaN(parsed.getTime())) return value;\n    const defaults = { day: "numeric", month: "short", year: "numeric" };\n    try { return new Intl.DateTimeFormat(locale, Object.assign(defaults, options || {})).format(parsed); }\n    catch (_) { return value; }\n  }\n\n  currentMonth() {\n    return this.todayIso().slice(0, 7);\n  }`,
  'formatDate'
);

// Consultas de pendientes nunca son acciones.
core = replaceOnce(
  core,
  `  normalizeSpeech(value) {\n    return String(value || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[¿?¡!]/g, "").trim();\n  }`,
  `  normalizeSpeech(value) {\n    return String(value || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[¿?¡!]/g, "").replace(/\\s+/g, " ").trim();\n  }\n\n  isPendingQuery(value) {\n    const text = this.normalizeSpeech(value);\n    return /^(?:dime|muestrame|mostrame|ensename|indicame)?\\s*(?:que\\s+)?(?:tengo|hay)\\s+(?:de\\s+)?pendientes?$/.test(text)\n      || /^(?:mis|los)\\s+pendientes$/.test(text)\n      || /^que\\s+hay\\s+para\\s+hoy$/.test(text)\n      || /^que\\s+tengo(?:\\s+para\\s+hoy)?$/.test(text)\n      || /^como\\s+voy$/.test(text);\n  }`,
  'isPendingQuery'
);

// Limpieza visual del recordatorio y duplicado proyecto — proyecto.
core = replaceBetween(
  core,
  '  cleanReminderDisplayText(value) {',
  '  parseMovement(content) {',
  `  cleanReminderDisplayText(value) {\n    const raw = String(value || "");\n    const isAutoStudy = /<!--\\s*JARVIS_STUDY:/i.test(raw);\n    let cleaned = raw.replace(/<!--\\s*JARVIS_STUDY:[^>]+-->/gi, "").trim();\n    if (isAutoStudy) cleaned = cleaned.replace(/\\s+—\\s+\\[\\[[^\\]]+\\]\\]\\s*$/i, "");\n    const visible = this.cleanDisplayText(cleaned);\n    const parts = visible.split(/\\s+—\\s+/);\n    if (parts.length === 2) {\n      const left = parts[0].trim();\n      const right = parts[1].trim();\n      const projectName = left.replace(/^continuar proyecto:\\s*/i, "").trim();\n      if (projectName && this.normalizeSpeech(projectName) === this.normalizeSpeech(right)) return left;\n    }\n    return visible;\n  }\n\n`,
  'cleanReminderDisplayText'
);

// Filtra defensivamente consultas conversacionales de recordatorios existentes.
core = replaceBetween(
  core,
  '  async getDueReminders() {',
  '  async getOpenTasks() {',
  `  async getDueReminders() {\n    const today = this.todayIso();\n    const file = this.app.vault.getAbstractFileByPath(REMINDERS_FILE);\n    if (!(file instanceof TFile)) return [];\n    const lines = (await this.app.vault.cachedRead(file)).split(/\\r?\\n/);\n    return lines.map((line, index) => {\n      const match = line.match(/^- \\[ \\] (\\d{4}-\\d{2}-\\d{2}) — (.+)$/);\n      if (!match) return null;\n      const visible = this.cleanReminderDisplayText(match[2]);\n      if (this.isPendingQuery(visible)) return null;\n      return { date: match[1], text: match[2], overdue: match[1] < today, line: index + 1 };\n    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));\n  }\n\n  async cleanupConversationalReminders() {\n    const file = this.app.vault.getAbstractFileByPath(REMINDERS_FILE);\n    if (!(file instanceof TFile)) return 0;\n    const current = await this.app.vault.read(file);\n    const newline = current.includes("\\r\\n") ? "\\r\\n" : "\\n";\n    const lines = current.split(/\\r?\\n/);\n    let removed = 0;\n    const kept = lines.filter((line) => {\n      const match = line.match(/^- \\[ \\] \\d{4}-\\d{2}-\\d{2} — (.+)$/);\n      if (!match) return true;\n      const visible = this.cleanReminderDisplayText(match[1]);\n      if (!this.isPendingQuery(visible)) return true;\n      removed += 1;\n      return false;\n    });\n    if (removed) await this.app.vault.modify(file, kept.join(newline).replace(/\\s*$/, "") + newline);\n    return removed;\n  }\n\n`,
  'getDueReminders'
);

// Ejecuta la limpieza conservadora al cargar la boveda.
core = replaceOnce(
  core,
  `      await this.ensureBaseFiles();\n      await this.ensureContextHomes();`,
  `      await this.ensureBaseFiles();\n      await this.cleanupConversationalReminders();\n      await this.ensureContextHomes();`,
  'startup cleanup'
);

// Impide guardar una consulta como recordatorio incluso desde otros flujos.
core = replaceOnce(
  core,
  `    const cleanText = String(data.text || "").replace(/[\\r\\n]+/g, " ").replace(/\\s+/g, " ").trim();\n    const link = data.linkPath`,
  `    const cleanText = String(data.text || "").replace(/[\\r\\n]+/g, " ").replace(/\\s+/g, " ").trim();\n    if (this.isPendingQuery(cleanText)) throw new Error("Eso parece una consulta de pendientes, no un recordatorio.");\n    const link = data.linkPath`,
  'addReminder guard'
);

// Defensa adicional en el planificador heuristico.
core = replaceOnce(
  core,
  `  heuristicAgentPlan(input) {\n    const original = String(input || "").trim();\n    const text = this.normalizeSpeech(original);`,
  `  heuristicAgentPlan(input) {\n    const original = String(input || "").trim();\n    const text = this.normalizeSpeech(original);\n    if (this.isPendingQuery(text)) return { mode: "answer", reply: "", actions: [] };`,
  'heuristic pending query'
);

// looksLikeAgentAction no clasifica preguntas como acciones.
core = replaceBetween(
  core,
  '  looksLikeAgentAction(value) {',
  '  async askOllamaAsJarvis(query) {',
  `  looksLikeAgentAction(value) {\n    const text = this.normalizeSpeech(value);\n    if (this.isPendingQuery(text)) return "";\n    if (/(borra|borrar|elimina|eliminar|vaciar|mueve todo|mover todo|renombra|renombrar)/.test(text)) return "destructive";\n    return /\\b(anota|anotar|guarda|guardar|agrega|agregar|añade|anade|crea|crear|registra|registrar|actualiza|actualizar|proyecto|tarea|pendiente|recuerdame|recordarme|recordatorio|apunta|pon|clasifica|clasificar|archiva|archivar)\\b/.test(text) ? "action" : "";\n  }\n\n`,
  'looksLikeAgentAction'
);

// handleJarvis resuelve la pregunta antes de cualquier accion.
core = replaceOnce(
  core,
  `    if (/^(que tengo|como voy|resumen|estado|que hay para hoy|mis pendientes)/.test(text)) return this.jarvisStatus();`,
  `    if (this.isPendingQuery(text) || /^(que tengo|como voy|resumen|estado|que hay para hoy|mis pendientes)/.test(text)) return this.jarvisStatus();`,
  'handle pending query'
);

// Fecha visible y panel mas compacto en movil.
core = replaceOnce(core,
  'heroTools.createEl("span", { cls: "jarvis-date-chip", text: this.plugin.todayIso() });',
  'heroTools.createEl("span", { cls: "jarvis-date-chip", text: this.plugin.formatDate(this.plugin.todayIso()) });',
  'hero date');
core = replaceOnce(core,
  '    const upcoming = reminders.filter((item) => item.date > today).slice(0, 4);',
  '    const upcoming = reminders.filter((item) => item.date > today).slice(0, Platform.isMobile ? 3 : 4);',
  'upcoming limit');
core = replaceOnce(core,
  '    for (const item of due.slice(0, 6)) {',
  '    for (const item of due.slice(0, Platform.isMobile ? 4 : 6)) {',
  'due limit');
core = replaceOnce(core,
  '      if (item.overdue) row.createEl("strong", { text: `Atrasado · ${item.date}` });',
  '      if (item.overdue) row.createEl("strong", { text: `Atrasado · ${this.plugin.formatDate(item.date)}` });',
  'overdue date');
core = replaceOnce(core,
  '      for (const item of upcoming) reminderCard.createEl("p", { text: `${item.date} · ${this.plugin.cleanReminderDisplayText(item.text)}` });',
  '      for (const item of upcoming) reminderCard.createEl("p", { cls: "jarvis-upcoming-item", text: `${this.plugin.formatDate(item.date)} · ${this.plugin.cleanReminderDisplayText(item.text)}` });',
  'upcoming date');

// Modal de recordatorio: no abre teclado automaticamente en movil, usa visualViewport y footer sticky.
core = replaceBetween(
  core,
  'class ReminderModal extends BaseFormModal {',
  'class JarvisModal extends Modal {',
  `class ReminderModal extends BaseFormModal {\n  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; this.viewportHandler = null; }\n  onOpen() {\n    this.contentEl.empty();\n    this.contentEl.addClass("jarvis-reminder-modal");\n    if (this.modalEl) this.modalEl.addClass("jarvis-reminder-shell");\n    this.contentEl.createEl("h2", { text: "Crear recordatorio" });\n    const text = this.field("¿Qué debe recordar?", "text", this.defaults.text || "");\n    const date = this.field("Fecha", "date", this.defaults.date || this.plugin.todayIso());\n    date.setAttr("lang", this.plugin.settings.locale || "es-GT");\n    const datePreview = this.contentEl.createEl("p", { cls: "jarvis-date-preview" });\n    const updateDatePreview = () => datePreview.setText(date.value ? this.plugin.formatDate(date.value, { day: "numeric", month: "long", year: "numeric" }) : "");\n    date.addEventListener("change", updateDatePreview);\n    updateDatePreview();\n    const active = this.app.workspace.getActiveFile();\n    if (active instanceof TFile && active.extension === "md") this.contentEl.createEl("p", { cls: "jarvis-form-hint", text: \`Se enlazará con: ${'${active.basename}'}\` });\n    this.actions(async () => {\n      if (!text.value.trim() || !date.value) return new Notice("Complete el recordatorio y la fecha.");\n      try {\n        await this.plugin.addReminder({ text: text.value, date: date.value, linkPath: active instanceof TFile ? active.path : "" });\n        this.close();\n      } catch (error) { new Notice(error.message, 7000); }\n    });\n\n    const syncViewport = () => {\n      if (Platform.isDesktopApp || !this.modalEl) return;\n      const vv = window.visualViewport;\n      const height = vv ? vv.height : window.innerHeight;\n      const offsetTop = vv ? vv.offsetTop : 0;\n      const keyboardOpen = height < window.innerHeight * 0.82;\n      this.modalEl.style.setProperty("--jarvis-visible-height", \`${'${Math.max(280, height - 16)}'}px\`);\n      this.modalEl.toggleClass("is-keyboard-open", keyboardOpen);\n      if (this.containerEl) {\n        this.containerEl.style.alignItems = "flex-start";\n        this.containerEl.style.paddingTop = \`${'${Math.max(8, offsetTop + 8)}'}px\`;\n        this.containerEl.style.paddingBottom = "calc(8px + env(safe-area-inset-bottom, 0px))";\n      }\n    };\n    this.viewportHandler = syncViewport;\n    if (window.visualViewport) {\n      window.visualViewport.addEventListener("resize", syncViewport);\n      window.visualViewport.addEventListener("scroll", syncViewport);\n    }\n    window.addEventListener("resize", syncViewport);\n    text.addEventListener("focus", () => window.setTimeout(syncViewport, 40));\n    text.addEventListener("blur", () => window.setTimeout(syncViewport, 160));\n    syncViewport();\n    if (Platform.isDesktopApp) window.setTimeout(() => text.focus(), 50);\n  }\n  onClose() {\n    if (this.viewportHandler) {\n      if (window.visualViewport) {\n        window.visualViewport.removeEventListener("resize", this.viewportHandler);\n        window.visualViewport.removeEventListener("scroll", this.viewportHandler);\n      }\n      window.removeEventListener("resize", this.viewportHandler);\n    }\n    if (this.containerEl) { this.containerEl.style.alignItems = ""; this.containerEl.style.paddingTop = ""; this.containerEl.style.paddingBottom = ""; }\n    this.contentEl.empty();\n  }\n}\n\n`,
  'ReminderModal'
);

const cssMarker = '/* JARVIS V4.6.6 MOBILE REMINDER */';
if (!styles.includes(cssMarker)) {
  styles += `\n\n${cssMarker}\n.jarvis-date-preview {\n  margin: -6px 0 8px;\n  font-size: 0.82em;\n  color: var(--text-muted);\n}\n\n@media (max-width: 720px) {\n  .jarvis-reminder-shell {\n    width: min(94vw, 520px) !important;\n    max-width: min(94vw, 520px) !important;\n    max-height: var(--jarvis-visible-height, 86dvh) !important;\n    overflow: hidden !important;\n    margin: 0 auto !important;\n  }\n\n  .jarvis-reminder-modal {\n    box-sizing: border-box;\n    display: flex;\n    flex-direction: column;\n    max-height: var(--jarvis-visible-height, 86dvh);\n    overflow-y: auto;\n    overscroll-behavior: contain;\n    -webkit-overflow-scrolling: touch;\n    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));\n  }\n\n  .jarvis-reminder-modal .jarvis-field {\n    flex: 0 0 auto;\n  }\n\n  .jarvis-reminder-modal .jarvis-form-actions {\n    position: sticky;\n    bottom: 0;\n    z-index: 20;\n    display: grid;\n    grid-template-columns: 1fr 1fr;\n    gap: 10px;\n    margin-top: 12px;\n    padding: 10px 0 calc(10px + env(safe-area-inset-bottom, 0px));\n    background: var(--background-primary);\n    border-top: 1px solid var(--background-modifier-border);\n  }\n\n  .jarvis-reminder-modal .jarvis-form-actions button {\n    min-height: 44px;\n    width: 100%;\n  }\n\n  .jarvis-reminder-shell.is-keyboard-open .jarvis-reminder-modal {\n    gap: 4px;\n  }\n\n  .jarvis-reminder-shell.is-keyboard-open .jarvis-reminder-modal h2 {\n    margin-top: 0;\n    margin-bottom: 6px;\n    font-size: 1.15rem;\n  }\n\n  .jarvis-reminder-shell.is-keyboard-open .jarvis-form-hint {\n    margin-block: 4px;\n    font-size: 0.78em;\n  }\n\n  .jarvis-upcoming-item {\n    margin-block: 6px !important;\n  }\n}\n`;
}

fs.writeFileSync(corePath, core.replace(/\n/g, '\n'), 'utf8');
fs.writeFileSync(stylesPath, styles.replace(/\n/g, '\n'), 'utf8');
fs.writeFileSync(versionPath, '4.6.6\n', 'utf8');
for (const manifestPath of manifestPaths) {
  const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  data.version = '4.6.6';
  fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Limpia los intentos locales R1-R4 de esta rama; la version final se prueba via pull + instalador normal.
const obsolete = [
  'AJUSTAR_PRUEBA_V466_R2.bat',
  'AJUSTAR_PRUEBA_V466_R3.bat',
  'AJUSTAR_PRUEBA_V466_R4.bat',
  'APLICAR_PRUEBA_V466.bat',
  'installer/ajustar_prueba_v466_r2.ps1',
  'installer/ejecutar_prueba_v466_r3.ps1',
  'installer/aplicar_prueba_v466_r4.ps1',
  'installer/aplicar_prueba_v466.ps1',
];
for (const rel of obsolete) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) fs.rmSync(full, { force: true });
}

console.log('[OK] V4.6.6 aplicada directamente a los archivos reales de la rama.');
