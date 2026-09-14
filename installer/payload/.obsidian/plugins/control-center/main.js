const { Plugin, PluginSettingTab, Setting, ItemView, Modal, Menu, Notice, TFile, normalizePath, Platform, requestUrl } = require("obsidian");

const VIEW_TYPE = "sistema-control-center-view";
const TODAY_HOME_FILE = "01 - Hoy/Inicio - Hoy.md";
const REMINDERS_FILE = "01 - Hoy/Recordatorios/Recordatorios.md";
const ORGANIZATION_REPORT_FILE = "01 - Hoy/Organización/Reporte de organización.md";
const STUDY_PLANS_FOLDER = "02 - Universidad/Planes de estudio";
const AUTO_STUDY_PLAN_FILE = `${STUDY_PLANS_FOLDER}/Plan automático de estudio.md`;
const AUTO_STUDY_START = "<!-- ESTUDIO_AUTO_INICIO -->";
const AUTO_STUDY_END = "<!-- ESTUDIO_AUTO_FIN -->";
const AUTOMATIC_SUMMARIES_FOLDER = "07 - Recursos/01 - Resumenes automaticos";
const MOVEMENTS_ROOT = "06 - Personal/Finanzas/Control personal/Movimientos";
const EDUCATION_ROOT = "02 - Universidad";
const WORK_ROOT = "03 - Trabajo";

const DEFAULT_SETTINGS = {
  profileName: "",
  locale: "",
  currencyCode: "",
  currencySymbol: "",
  activeEducationContext: "",
  activeWorkContext: "",
  voiceEnabled: false,
  appearance: "auto",
  openDashboardOnStartup: true,
  model: "llama3.2",
  studyAutoEnabled: true,
  studyMinutes: 45,
  studyHorizonDays: 7,
};

module.exports = class ControlCenterPlugin extends Plugin {
  runtimeHeartbeatPath() {
    if (!Platform.isDesktopApp) return "";
    try {
      const fs = require("fs");
      const path = require("path");
      const crypto = require("crypto");
      const vaultName = this.app.vault.getName();
      if (!vaultName) return "";
      const root = process.env.LOCALAPPDATA || process.env.APPDATA || "";
      if (!root) return "";
      const key = crypto.createHash("sha1")
        .update(String(vaultName).toLowerCase())
        .digest("hex")
        .slice(0, 16);
      const dir = path.join(root, "Obsidian", "runtime");
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, `${key}.json`);
    } catch (_) {
      return "";
    }
  }

  writeRuntimeHeartbeat(stage, extra = {}) {
    if (!Platform.isDesktopApp) return;
    try {
      const fs = require("fs");
      const file = this.runtimeHeartbeatPath();
      if (!file) return;

      let previous = {};
      try {
        if (fs.existsSync(file)) {
          previous = JSON.parse(fs.readFileSync(file, "utf8")) || {};
        }
      } catch (_) {
        previous = {};
      }

      const payload = Object.assign({}, previous, {
        version: "4.6.6",
        stage,
        at: new Date().toISOString(),
        vault: this.app.vault.getName(),
      }, extra);

      if (String(stage).startsWith("onload")) payload.loaded = true;
      if (stage === "dashboard-ready") payload.dashboardReady = true;

      fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
    } catch (_) {}
  }

  scheduleStartupDashboardRecovery() {
    if (this.startupRecoveryScheduled) return;
    this.startupRecoveryScheduled = true;
    if (this.settings && this.settings.openDashboardOnStartup === false) return;

    const delays = [300, 1000, 2200, 4000];
    this.startupTimerIds = [];

    delays.forEach((delay, index) => {
      const timer = window.setTimeout(async () => {
        if (this.startupDashboardConfirmed) return;
        try {
          await this.activateDashboard();
          this.startupDashboardConfirmed = true;
          this.writeRuntimeHeartbeat("dashboard-ready", { attempt: index + 1 });
        } catch (error) {
          this.writeRuntimeHeartbeat("dashboard-error", {
            attempt: index + 1,
            error: String(error && error.message ? error.message : error),
          });
        }
      }, delay);

      this.startupTimerIds.push(timer);
    });

    this.register(() => {
      for (const timer of this.startupTimerIds || []) {
        window.clearTimeout(timer);
      }
    });
  }

  async onload() {
    this.writeRuntimeHeartbeat("onload-start");
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.writeRuntimeHeartbeat("onload");
    this.addSettingTab(new ControlCenterSettingTab(this.app, this));
    this.refreshTimer = null;
    this.studyRefreshTimer = null;
    this.studyRefreshInProgress = false;
    this.searchIndex = null;
    this.searchIndexBuilding = null;
    this.applyAppearance(this.settings.appearance);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => { if (this.settings.appearance === "auto") this.applyAppearance("auto"); };
    systemTheme.addEventListener("change", followSystem);
    this.register(() => systemTheme.removeEventListener("change", followSystem));
    this.registerView(VIEW_TYPE, (leaf) => new ControlCenterView(leaf, this));
    this.app.workspace.onLayoutReady(() => {
      this.writeRuntimeHeartbeat("layout-ready");
      this.scheduleStartupDashboardRecovery();
    });

    this.addRibbonIcon("layout-dashboard", "Abrir Centro de control", () => this.activateDashboard());
    this.addRibbonIcon("message-circle", "Abrir asistente", () => new AsistenteModal(this.app, this).open());
    this.addCommand({ id: "abrir-centro-control", name: "Abrir Centro de control", callback: () => this.activateDashboard() });
    this.addCommand({ id: "buscar-en-boveda", name: "Buscar en toda la bóveda", callback: () => this.focusDashboardSearch() });
    this.addCommand({ id: "abrir-asistente", name: "Abrir asistente", callback: () => new AsistenteModal(this.app, this).open() });
    this.addCommand({ id: "crear-nota-rapida", name: "Crear nota rápida", callback: () => new QuickNoteModal(this.app, this).open() });
    this.addCommand({ id: "registrar-el-dia", name: "Registrar algo en el día de hoy", callback: () => this.openToday() });
    this.addCommand({ id: "registrar-movimiento", name: "Registrar ingreso, gasto o pago", callback: () => new MovementModal(this.app, this).open() });
    this.addCommand({ id: "crear-recordatorio", name: "Crear recordatorio", callback: () => new ReminderModal(this.app, this).open() });
    this.addCommand({ id: "reporte-organizacion", name: "Crear reporte de organización", callback: () => this.createOrganizationReport(true) });
    this.addCommand({ id: "crear-plan-estudio", name: "Crear / actualizar plan de estudio automático", callback: () => this.refreshAutomaticStudySystem(true) });
    this.addCommand({ id: "actualizar-estudio-automatico", name: "Actualizar estudio automático de todas las materias", callback: () => this.refreshAutomaticStudySystem(true) });

    const refresh = () => this.scheduleRefresh();
    const changed = (file) => { this.invalidateSearchIndex(); refresh(); this.scheduleAutomaticStudyRefresh(file); };
    this.registerEvent(this.app.vault.on("create", (file) => { changed(file); this.scheduleRedundantTitleCleanup(file); }));
    this.registerEvent(this.app.vault.on("modify", (file) => changed(file)));
    this.registerEvent(this.app.vault.on("delete", (file) => changed(file)));
    this.registerEvent(this.app.vault.on("rename", (file) => { changed(file); this.scheduleRedundantTitleCleanup(file); }));

    this.app.workspace.onLayoutReady(async () => {
      await this.organizeTodaySystemFiles();
      await this.ensureBaseFiles();
      await this.cleanupConversationalReminders();
      await this.ensureContextHomes();
      await this.removeDuplicateHomeHeadings();
      await this.cleanupBrokenAgentProjectTasks();
      if (Platform.isDesktopApp && this.settings.studyAutoEnabled !== false) {
        window.setTimeout(() => this.refreshAutomaticStudySystem(false), 1400);
      }
      this.writeRuntimeHeartbeat("layout-services-ready");
    });
    this.registerInterval(window.setInterval(() => this.scheduleRefresh(), 5 * 60 * 1000));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateDashboard() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) await leaf.view.render();
    this.writeRuntimeHeartbeat("dashboard-ready");
  }

  async focusDashboardSearch() {
    await this.activateDashboard();
    window.setTimeout(() => {
      const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
      const input = leaf && leaf.view && leaf.view.containerEl
        ? leaf.view.containerEl.querySelector(".sistema-search-input")
        : null;
      if (input) {
        input.focus();
        if (typeof input.select === "function") input.select();
      }
    }, 80);
  }

  invalidateSearchIndex() {
    this.searchIndex = null;
    this.searchIndexBuilding = null;
  }

  scheduleRefresh() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        if (leaf.view && leaf.view.render) leaf.view.render();
      }
    }, 500);
  }

  async setVoiceEnabled(enabled) {
    this.settings.voiceEnabled = Boolean(enabled);
    await this.saveData(this.settings);
  }

  async setAppearance(appearance) {
    this.settings.appearance = ["auto", "dark", "light"].includes(appearance) ? appearance : "auto";
    await this.saveData(this.settings);
    this.applyAppearance(this.settings.appearance);
    this.scheduleRefresh();
  }

  applyAppearance(appearance) {
    const resolved = appearance === "auto"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : appearance;
    document.body.toggleClass("theme-dark", resolved === "dark");
    document.body.toggleClass("theme-light", resolved === "light");
    document.body.setAttr("data-sistema-appearance", appearance || "auto");
  }

  appearanceLabel() {
    return ({ auto: "◐ Automático", dark: "☾ Oscuro", light: "☀ Claro" })[this.settings.appearance] || "◐ Automático";
  }

  async getAiStatus() {
    try {
      const aiPlugin = (this.app.plugins && typeof this.app.plugins.getPlugin === "function")
        ? this.app.plugins.getPlugin("vault-ai")
        : (this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["vault-ai"] : null);

      if (aiPlugin && typeof aiPlugin.assertAIAvailable === "function") {
        return await aiPlugin.assertAIAvailable();
      }
      if (!Platform.isDesktopApp) {
        return { state: "mobile", label: "Modo móvil", detail: "Sistema listo. Activa IA de bóveda para IA en móvil." };
      }
      const response = await requestUrl({ url: "http://127.0.0.1:11434/api/tags", method: "GET", throw: false });
      if (response.status !== 200) throw new Error("sin respuesta");
      const models = response.json && Array.isArray(response.json.models) ? response.json.models : [];
      const expected = this.settings.model || "llama3.2";
      const installed = models.some((item) => String(item.name || item.model || "").startsWith(expected));
      return installed
        ? { state: "ready", label: "Ollama listo", detail: `${expected} disponible` }
        : { state: "missing", label: "Falta el modelo", detail: `Ejecute: ollama pull ${expected}` };
    } catch (_) {
      return { state: "offline", label: "IA no conectada", detail: "Las notas y organización siguen funcionando." };
    }
  }

  todayIso() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  formatDate(date, options = {}) {
    const value = String(date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const locale = String(this.settings.locale || (typeof navigator !== "undefined" ? navigator.language : "es-GT") || "es-GT");
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    const defaults = { day: "numeric", month: "short", year: "numeric" };
    try { return new Intl.DateTimeFormat(locale, Object.assign(defaults, options || {})).format(parsed); }
    catch (_) { return value; }
  }

  currentMonth() {
    return this.todayIso().slice(0, 7);
  }

  profileName() {
    const value = String(this.settings.profileName || "").trim();
    return value || "Usuario";
  }

  formatMoney(amount) {
    const value = Number(amount) || 0;
    const locale = String(this.settings.locale || (typeof navigator !== "undefined" ? navigator.language : "es-ES") || "es-ES");
    const currency = String(this.settings.currencyCode || "").trim().toUpperCase();
    if (currency) {
      try {
        return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
      } catch (_) { /* usa el símbolo configurado */ }
    }
    const symbol = String(this.settings.currencySymbol || "").trim() || "¤";
    return `${symbol}${value.toFixed(2)}`;
  }

  educationAreaLabel() {
    const context = String(this.settings.activeEducationContext || "").trim();
    return context ? `Universidad · ${context}` : "Universidad";
  }

  workAreaLabel() {
    const context = String(this.settings.activeWorkContext || "").trim();
    return context ? `Trabajo · ${context}` : "Trabajo";
  }

  getEducationHomePath() {
    const context = String(this.settings.activeEducationContext || "").trim();
    if (context) {
      const candidates = [
        `${EDUCATION_ROOT}/${context}/${context} - Inicio.md`,
        `${EDUCATION_ROOT}/${context}/Universidad - Inicio.md`,
      ];
      for (const path of candidates) {
        if (this.app.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile) return path;
      }
    }
    return `${EDUCATION_ROOT}/Universidad - Inicio.md`;
  }

  getWorkHomePath() {
    const context = String(this.settings.activeWorkContext || "").trim();
    if (context) {
      const candidates = [
        `${WORK_ROOT}/${context}/${context} - Inicio.md`,
        `${WORK_ROOT}/${context}/Trabajo - Inicio.md`,
      ];
      for (const path of candidates) {
        if (this.app.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile) return path;
      }
    }
    return `${WORK_ROOT}/Trabajo - Inicio.md`;
  }

  workNotesFolder(contextName = "") {
    const context = String(contextName || "").trim();
    const safe = context ? this.safeName(context) : "";
    return safe ? `${WORK_ROOT}/${safe}/Notas` : `${WORK_ROOT}/Notas`;
  }

  educationNotesFolder(contextName = "") {
    const context = String(contextName || "").trim();
    const safe = context ? this.safeName(context) : "";
    return safe ? `${EDUCATION_ROOT}/${safe}/Notas` : `${EDUCATION_ROOT}/Notas`;
  }

  activeWorkNotesFolder() {
    return this.workNotesFolder(this.settings.activeWorkContext || "");
  }

  activeEducationNotesFolder() {
    return this.educationNotesFolder(this.settings.activeEducationContext || "");
  }

  async ensureContextHomes() {
    const education = String(this.settings.activeEducationContext || "").trim();
    if (education) {
      const safe = this.safeName(education);
      const folder = `${EDUCATION_ROOT}/${safe}`;
      await this.ensureFolder(folder);
      await this.ensureFile(`${folder}/${safe} - Inicio.md`, [
        "---", "tipo: institucion_educativa", `nombre: "${safe.replace(/"/g, "'")}"`, "estado: activo", "---", "",
        `# ${safe}`, "", "> Contexto educativo administrado por el sistema.", "",
        "## Periodos, carreras o cursos", "", "- ", "",
        `[[${EDUCATION_ROOT}/Universidad - Inicio|Volver a Universidad]]`, "",
      ].join("\\n"));
    }

    const work = String(this.settings.activeWorkContext || "").trim();
    if (work) {
      const safe = this.safeName(work);
      const folder = `${WORK_ROOT}/${safe}`;
      await this.ensureFolder(folder);
      await this.ensureFile(`${folder}/${safe} - Inicio.md`, [
        "---", "tipo: contexto_laboral", `nombre: "${safe.replace(/"/g, "'")}"`, "estado: activo", "---", "",
        `# ${safe}`, "", "> Contexto laboral administrado por el sistema.", "",
        "## Pendientes", "", "- [ ] ", "",
        "## Notas", "", "",
        `[[${WORK_ROOT}/Trabajo - Inicio|Abrir Trabajo general]]`, "- [[04 - Proyectos/Proyectos - Inicio|Abrir Proyectos]]", "",
      ].join("\\n"));
    }
  }

  async ensureBaseFiles() {
    await this.ensureFile(TODAY_HOME_FILE, [
      "> Tu zona operativa del día, ordenada y lista para usar.", "",
      "## Entradas rápidas", "", "- [[Inicio|Abrir Inicio]]", "- [[01 - Hoy/Recordatorios/Recordatorios|Ver recordatorios]]", "- [[01 - Hoy/Notas diarias|Abrir notas diarias]]", "",
      "## Revisión", "", "- [[01 - Hoy/Revisiones/Revisión semanal|Revisión semanal]]", "- [[01 - Hoy/Organización/Reporte de organización|Reporte de organización]]", "",
    ].join("\n"));
    await this.ensureFile(REMINDERS_FILE, "# Recordatorios\n\n> Pendientes con fecha creados desde el Centro de control.\n\n## Pendientes\n\n");
    await this.ensureFile("00 - Inbox/Inbox.md", "# Inbox\n\nNotas rápidas pendientes de organizar.\n");
    await this.ensureFolder("01 - Hoy/Notas diarias");
    await this.ensureFolder("01 - Hoy/Revisiones");
    await this.ensureFolder("01 - Hoy/Organización");
    await this.ensureFolder("01 - Hoy/Plantillas");
    await this.ensureFolder(STUDY_PLANS_FOLDER);
    await this.ensureFolder(MOVEMENTS_ROOT);
  }

  async organizeTodaySystemFiles() {
    const moves = [
      ["01 - Hoy/Recordatorios.md", REMINDERS_FILE],
      ["01 - Hoy/Revisión semanal.md", "01 - Hoy/Revisiones/Revisión semanal.md"],
      ["01 - Hoy/Reporte de organización.md", ORGANIZATION_REPORT_FILE],
      ["01 - Hoy/Hoy - Plantilla diaria.md", "01 - Hoy/Plantillas/Hoy - Plantilla diaria.md"],
    ];
    for (const [oldPath, newPath] of moves) {
      const source = this.app.vault.getAbstractFileByPath(normalizePath(oldPath));
      const target = this.app.vault.getAbstractFileByPath(normalizePath(newPath));
      if (!(source instanceof TFile) || target) continue;
      const folder = newPath.substring(0, newPath.lastIndexOf("/"));
      await this.ensureFolder(folder);
      try { await this.app.vault.rename(source, normalizePath(newPath)); } catch (_) { /* el proveedor de sincronización puede estar trabajando */ }
    }
  }

  async removeDuplicateHomeHeadings() {
    const homes = [["Inicio.md", "Inicio"], [TODAY_HOME_FILE, "Hoy"]];
    for (const [path, heading] of homes) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      const current = await this.app.vault.read(file);
      const pattern = new RegExp(`^\\uFEFF?#\\s+${heading}\\s*\\r?\\n+`, "i");
      const cleaned = current.replace(pattern, "");
      if (cleaned !== current) await this.app.vault.modify(file, cleaned);
    }
  }

  normalizeComparableTitle(value) {
    return String(value || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[`*_~#]/g, "")
      .replace(/[–—·:|_\-]+/g, " ")
      .replace(/^[^a-z0-9ñ]+/i, "")
      .replace(/[^a-z0-9ñ]+$/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("es");
  }

  async removeRedundantTitleForFile(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const current = await this.app.vault.read(file);
    const newline = current.includes("\r\n") ? "\r\n" : "\n";
    const lines = current.split(/\r?\n/);
    let index = 0;
    if ((lines[index] || "").replace(/^\uFEFF/, "").trim() === "---") {
      index += 1;
      while (index < lines.length && lines[index].trim() !== "---") index += 1;
      if (index < lines.length) index += 1;
    }
    while (index < lines.length && !lines[index].trim()) index += 1;
    const match = (lines[index] || "").match(/^#\s+(.+?)\s*$/);
    if (!match) return false;
    if (this.normalizeComparableTitle(match[1]) !== this.normalizeComparableTitle(file.basename)) return false;

    lines.splice(index, 1);
    if (index < lines.length && !lines[index].trim()) lines.splice(index, 1);
    const cleaned = lines.join(newline).replace(/^\uFEFF?/, "");
    if (cleaned === current) return false;
    await this.app.vault.modify(file, cleaned);
    return true;
  }

  scheduleRedundantTitleCleanup(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    window.setTimeout(() => this.removeRedundantTitleForFile(file).catch(() => {}), 450);
  }

  async ensureFolder(folderPath) {
    const normalized = normalizePath(folderPath || "");
    if (!normalized) return;
    let current = "";
    for (const part of normalized.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try { await this.app.vault.createFolder(current); } catch (_) { /* la sincronización puede crearla simultáneamente */ }
      }
    }
  }

  async ensureFile(filePath, initialContent) {
    const normalized = normalizePath(filePath);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof TFile) return existing;
    const folder = normalized.includes("/") ? normalized.substring(0, normalized.lastIndexOf("/")) : "";
    await this.ensureFolder(folder);
    const created = await this.app.vault.create(normalized, initialContent);
    await this.removeRedundantTitleForFile(created).catch(() => false);
    return created;
  }

  async openPath(filePath) {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filePath));
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
    else new Notice("Todavía no existe esa nota.");
  }

  getTodayFile() {
    const date = this.todayIso();
    const path = `01 - Hoy/Notas diarias/${date}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  async openToday() {
    const file = this.getTodayFile();
    if (file) await this.app.workspace.getLeaf(false).openFile(file);
    else new DailyCaptureModal(this.app, this).open();
  }

  localTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async appendDailyActivity(text) {
    const date = this.todayIso();
    const path = `01 - Hoy/Notas diarias/${date}.md`;
    const line = `- ${this.localTime()} · ${String(text).replace(/[\r\n]+/g, " ").trim()}`;
    let file = this.getTodayFile();
    if (!file) {
      const initial = [
        "---", `fecha: ${date}`, "tipo: nota_diaria", "---", "", `# Mi día — ${date}`, "",
        "## Actividad registrada", "", line, "", "## Lo más importante", "", "## Pendientes", "",
        "## Cierre del día", "", "- Qué avancé:", "- Qué sigue:", "", "[[Inicio|Volver a Inicio]]", "",
      ].join("\n");
      file = await this.ensureFile(path, initial);
    } else {
      const current = await this.app.vault.read(file);
      await this.app.vault.modify(file, current.replace(/\s*$/, "") + "\n" + line + "\n");
    }
    this.scheduleRefresh();
    return file;
  }

  async saveDailyCapture(content) {
    const clean = String(content || "").trim();
    if (!clean) throw new Error("escriba o dicte algo antes de guardar");
    const file = await this.appendDailyActivity(`🗒️ ${clean}`);
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  async createQuickNote(data) {
    const folders = {
      inbox: "00 - Inbox", universidad: "02 - Universidad", trabajo: "03 - Trabajo",
      proyectos: "04 - Proyectos", personal: "06 - Personal",
    };
    const folder = folders[data.area] || folders.inbox;
    await this.ensureFolder(folder);
    const title = this.safeName(data.title || "Nota rápida");
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
    const path = await this.uniquePath(`${folder}/${title} - ${stamp}.md`);
    const content = [
      "---", `creado: ${this.todayIso()}`, "tipo: nota_rapida", `area: ${data.area}`, "estado: por_organizar", "---", "",
      `# ${title}`, "", data.content.trim() || "Escriba aquí…", "", "## Siguiente acción", "", "- [ ] Revisar y relacionar esta nota.",
    ].join("\n");
    const file = await this.app.vault.create(path, content + "\n");
    await this.removeRedundantTitleForFile(file).catch(() => false);
    await this.appendDailyActivity(`✍️ Nota creada: [[${file.path.replace(/\.md$/i, "")}]]`);
    await this.app.workspace.getLeaf(false).openFile(file);
    new Notice("Nota creada y guardada.");
    return file;
  }

  async addReminder(data) {
    const file = await this.ensureFile(REMINDERS_FILE, "# Recordatorios\n\n## Pendientes\n\n");
    const current = await this.app.vault.read(file);
    const cleanText = String(data.text || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    if (this.isPendingQuery(cleanText)) throw new Error("Eso parece una consulta de pendientes, no un recordatorio.");
    const link = data.linkPath ? ` — [[${data.linkPath.replace(/\.md$/i, "")}]]` : "";
    const line = `- [ ] ${data.date} — ${cleanText}${link}`;
    const fingerprint = this.normalizeSpeech(`${data.date} ${cleanText}`);
    const duplicate = current.split(/\r?\n/).some((item) => this.normalizeSpeech(item).includes(fingerprint));
    if (!duplicate) {
      await this.app.vault.modify(file, current.replace(/\s*$/, "") + "\n" + line + "\n");
      await this.appendDailyActivity(`⏰ Recordatorio para ${data.date}: ${cleanText}`);
    }
    new Notice(duplicate ? "Ese recordatorio ya existe." : `Recordatorio guardado para ${data.date}.`);
    return { file, duplicate };
  }

  async addMovement(data) {
    const amount = Number(String(data.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("el monto debe ser mayor que cero");
    const month = data.date.slice(0, 7);
    const folder = `${MOVEMENTS_ROOT}/${month}`;
    await this.ensureFolder(folder);
    const title = `${data.date} - ${this.labelMovement(data.type)} - ${this.safeName(data.description).slice(0, 55)}`;
    const path = await this.uniquePath(`${folder}/${title}.md`);
    const yaml = (value) => `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const content = [
      "---", "tipo: movimiento_financiero", `movimiento: ${data.type}`, `fecha: ${data.date}`,
      `monto: ${amount.toFixed(2)}`, `categoria: ${yaml(data.category)}`, `cuenta: ${yaml(data.account)}`,
      `descripcion: ${yaml(data.description)}`, "---", "", `# ${title}`, "",
      `- **Tipo:** ${this.labelMovement(data.type)}`, `- **Monto:** ${this.formatMoney(amount)}`,
      `- **Categoría:** ${data.category || "Sin categoría"}`, `- **Cuenta o medio:** ${data.account || "Sin indicar"}`,
      "", data.notes ? `## Notas\n\n${data.notes.trim()}\n` : "",
      "[[06 - Personal/Finanzas/Control personal/Mi control financiero - Inicio|Volver a Finanzas]]",
    ].filter((line) => line !== "").join("\n");
    const file = await this.app.vault.create(path, content + "\n");
    await this.removeRedundantTitleForFile(file).catch(() => false);
    await this.appendDailyActivity(`💰 ${this.labelMovement(data.type)} ${this.formatMoney(amount)} · ${data.description} · [[${file.path.replace(/\.md$/i, "")}]]`);
    new Notice(`${this.labelMovement(data.type)} registrado: ${this.formatMoney(amount)}`);
    this.scheduleRefresh();
  }

  labelMovement(type) {
    return ({ ingreso: "Ingreso", gasto: "Gasto", pago_deuda: "Pago de deuda", ahorro: "Ahorro", transferencia: "Transferencia" })[type] || type;
  }

  async uniquePath(desired) {
    let path = normalizePath(desired);
    let index = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(desired.replace(/\.md$/i, ` ${index}.md`));
      index += 1;
    }
    return path;
  }

  safeName(value) {
    return String(value || "Nota").replace(/[\\/:*?"<>|#\[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100);
  }

  scheduleAutomaticStudyRefresh(file) {
    if (!Platform.isDesktopApp || this.settings.studyAutoEnabled === false || this.studyRefreshInProgress) return;
    const path = normalizePath(file && file.path ? file.path : "");
    if (!path) return;
    const academicChange = path.startsWith("02 - Universidad/") && !path.startsWith(`${STUDY_PLANS_FOLDER}/`);
    const summaryChange = path.startsWith(`${AUTOMATIC_SUMMARIES_FOLDER}/`);
    if (!academicChange && !summaryChange) return;
    if (this.studyRefreshTimer) window.clearTimeout(this.studyRefreshTimer);
    this.studyRefreshTimer = window.setTimeout(() => this.refreshAutomaticStudySystem(false), summaryChange ? 4200 : 1800);
  }

  academicDisplayName(folderPath, fallback) {
    const prefix = normalizePath(folderPath) + "/";
    const home = this.app.vault.getMarkdownFiles().find((file) =>
      normalizePath(file.path).startsWith(prefix) &&
      file.parent && normalizePath(file.parent.path) === normalizePath(folderPath) &&
      / - Inicio$/i.test(file.basename)
    );
    return (home ? home.basename.replace(/ - Inicio$/i, "") : fallback)
      .replace(/\s+/g, " ").trim();
  }

  detectEducationContexts() {
    const contexts = new Set();
    for (const file of this.app.vault.getFiles()) {
      const path = normalizePath(file.path);
      if (!path.startsWith(`${EDUCATION_ROOT}/`)) continue;
      const parts = path.split("/");
      const candidate = parts[1] || "";
      if (!candidate || /^planes? de estudio$/i.test(candidate)) continue;
      if (/universidad - inicio\.md$/i.test(parts.slice(-1)[0] || "")) continue;
      contexts.add(candidate);
    }
    if (this.settings.activeEducationContext) contexts.add(this.settings.activeEducationContext);
    return [...contexts].sort((a, b) => a.localeCompare(b, "es"));
  }

  detectWorkContexts() {
    const contexts = new Set();
    for (const file of this.app.vault.getFiles()) {
      const path = normalizePath(file.path);
      if (!path.startsWith(`${WORK_ROOT}/`)) continue;
      const parts = path.split("/");
      const candidate = parts[1] || "";
      if (!candidate || /^\d{2}\s*-\s*/.test(candidate) || /^notas de sistema$/i.test(candidate)) continue;
      if (/^trabajo - inicio\.md$/i.test(candidate)) continue;
      contexts.add(candidate);
    }
    if (this.settings.activeWorkContext) contexts.add(this.settings.activeWorkContext);
    return [...contexts].sort((a, b) => a.localeCompare(b, "es"));
  }

  detectAcademicSubjects() {
    const groups = new Map();
    const markdown = this.app.vault.getMarkdownFiles();
    const allFiles = this.app.vault.getFiles();

    const addFolder = (folderPath) => {
      const normalized = normalizePath(folderPath || "");
      if (!normalized.startsWith(`${EDUCATION_ROOT}/`)) return;
      const parts = normalized.split("/");
      if (parts.length < 3) return;
      const institution = parts[1] || "";
      if (!institution || /^planes? de estudio$/i.test(institution)) return;
      const folderName = parts[parts.length - 1] || "";
      if (!folderName || /^planes? de estudio$/i.test(folderName)) return;
      const period = parts.slice(2, -1).join(" / ");
      if (!groups.has(normalized)) {
        groups.set(normalized, { institution, period, folderName, folderPath: normalized, files: [] });
      }
    };

    // Convención universal: una materia suele tener Tareas, Parciales, Apuntes,
    // Fórmulas, Conceptos o Ejercicios dentro de su carpeta.
    for (const file of markdown) {
      const path = normalizePath(file.path);
      if (!path.startsWith(`${EDUCATION_ROOT}/`)) continue;
      if (!/(?: - |\b)(Tareas|Parciales|Apuntes|F[oó]rmulas|Conceptos|Ejercicios)(?:\b| y )/i.test(file.basename)) continue;
      if (file.parent) addFolder(file.parent.path);
    }

    // También admite una nota de inicio marcada explícitamente como materia.
    for (const file of markdown) {
      const path = normalizePath(file.path);
      if (!path.startsWith(`${EDUCATION_ROOT}/`) || !/ - Inicio$/i.test(file.basename) || !file.parent) continue;
      const cache = this.app.metadataCache.getFileCache(file);
      const type = this.normalizeSpeech(cache && cache.frontmatter ? (cache.frontmatter.tipo || cache.frontmatter.type || "") : "");
      if (type === "materia" || type === "curso" || type === "subject") addFolder(file.parent.path);
    }

    for (const group of groups.values()) {
      group.files = allFiles.filter((file) => {
        const path = normalizePath(file.path);
        return path === group.folderPath || path.startsWith(group.folderPath + "/");
      });
    }

    const active = this.normalizeSpeech(this.settings.activeEducationContext || "");
    return [...groups.values()].map((group, index) => {
      const name = this.academicDisplayName(group.folderPath, group.folderName);
      const aliases = [...new Set([name, group.folderName]
        .map((value) => this.normalizeSpeech(value)).filter(Boolean))];
      return {
        ...group,
        name,
        aliases,
        index,
        activeContext: Boolean(active && this.normalizeSpeech(group.institution) === active),
      };
    }).sort((a, b) =>
      Number(b.activeContext) - Number(a.activeContext) ||
      a.institution.localeCompare(b.institution, "es") ||
      a.name.localeCompare(b.name, "es")
    );
  }

  subjectMatchesText(subject, value) {
    const text = this.normalizeSpeech(value);
    return subject.aliases.some((alias) => alias && text.includes(alias));
  }

  subjectForPath(path, subjects = this.detectAcademicSubjects()) {
    const normalized = normalizePath(path || "");
    const direct = subjects.find((subject) => normalized === subject.folderPath || normalized.startsWith(subject.folderPath + "/"));
    if (direct) return direct;
    return subjects.find((subject) => this.subjectMatchesText(subject, normalized)) || null;
  }

  dateValuesFromText(text) {
    const values = new Set();
    const today = this.todayIso();
    const source = String(text || "");
    for (const match of source.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) values.add(`${match[1]}-${match[2]}-${match[3]}`);
    for (const match of source.matchAll(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/g)) {
      values.add(`${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`);
    }
    return [...values].filter((date) => /^20\d{2}-\d{2}-\d{2}$/.test(date) && date >= today).sort();
  }

  daySeed(date = this.todayIso()) {
    const start = new Date(`${date.slice(0, 4)}-01-01T12:00:00`);
    const current = new Date(`${date}T12:00:00`);
    return Math.floor((current - start) / 86400000);
  }

  async getAcademicRecommendations(limit = 3) {
    const subjects = this.detectAcademicSubjects();
    if (!subjects.length) return [];
    const markdown = this.app.vault.getMarkdownFiles();
    const summaryMarkdown = markdown.filter((file) => normalizePath(file.path).startsWith(`${AUTOMATIC_SUMMARIES_FOLDER}/`));
    const reminders = await this.getDueReminders();
    const globalCalendar = markdown.filter((file) => /calendario de evaluaciones|pendientes del semestre/i.test(file.basename));
    let globalText = "";
    for (const file of globalCalendar.slice(0, 4)) globalText += "\n" + (await this.app.vault.cachedRead(file)).slice(0, 30000);
    const today = this.todayIso();
    const seed = this.daySeed(today);
    const result = [];

    for (const subject of subjects) {
      const ownNotes = markdown.filter((file) => normalizePath(file.path).startsWith(subject.folderPath + "/"));
      const summaryNotes = [];
      for (const file of summaryMarkdown.slice(0, 120)) {
        const content = (await this.app.vault.cachedRead(file)).slice(0, 12000);
        if (this.subjectMatchesText(subject, `${file.path}\n${content}`)) summaryNotes.push(file);
      }
      const scanNotes = [...ownNotes, ...summaryNotes].slice(0, 80);
      const openTasks = [];
      const dates = [];
      for (const file of scanNotes) {
        const content = (await this.app.vault.cachedRead(file)).slice(0, 50000);
        for (const line of content.split(/\r?\n/)) {
          const task = line.match(/^\s*- \[ \] (.+\S)\s*$/);
          if (task) openTasks.push({ file, text: task[1] });
        }
        dates.push(...this.dateValuesFromText(content));
      }
      for (const line of globalText.split(/\r?\n/)) {
        if (this.subjectMatchesText(subject, line)) dates.push(...this.dateValuesFromText(line));
      }
      const relatedReminders = reminders.filter((item) => this.subjectMatchesText(subject, item.text));
      dates.push(...relatedReminders.map((item) => item.date).filter((date) => date >= today));
      const nearestDate = [...new Set(dates)].sort()[0] || "";
      const daysToDeadline = nearestDate ? Math.ceil((new Date(`${nearestDate}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000) : null;

      let topics = ownNotes.filter((file) => !/( - Inicio| - Tareas| - Parciales| - Apuntes.*| - Fórmulas.*| - Formulas.*| - Conceptos.*| - Ejercicios.*)$/i.test(file.basename));
      if (!topics.length) topics = ownNotes.filter((file) => !/ - Inicio$/i.test(file.basename));
      topics.sort((a, b) => a.path.localeCompare(b.path, "es"));
      const topic = topics.length ? topics[(seed + subject.index) % topics.length] : null;
      const newest = subject.files.reduce((max, file) => Math.max(max, Number(file.stat && file.stat.mtime) || 0), 0);
      const ageDays = newest ? Math.max(0, Math.floor((Date.now() - newest) / 86400000)) : 999;
      let score = 10 + Math.min(openTasks.length, 8) * 6;
      if (subject.activeContext) score += 18;
      if (daysToDeadline !== null) {
        if (daysToDeadline <= 0) score += 100;
        else if (daysToDeadline <= 2) score += 80;
        else if (daysToDeadline <= 7) score += 55;
        else if (daysToDeadline <= 14) score += 30;
      }
      if (ageDays <= 3) score += 14;
      else if (ageDays <= 7) score += 8;
      const rotation = (subject.index - (seed % subjects.length) + subjects.length) % subjects.length;
      const reason = daysToDeadline !== null
        ? `Objetivo próximo: ${nearestDate}`
        : openTasks.length
          ? `${openTasks.length} pendiente(s) detectado(s)`
          : topic
            ? `Repaso rotativo: ${topic.basename}`
            : "Materia detectada en la bóveda";
      result.push({ subject, score, rotation, nearestDate, daysToDeadline, openTasks, topic, topics, reason });
    }

    return result.sort((a, b) => b.score - a.score || a.rotation - b.rotation || a.subject.name.localeCompare(b.subject.name, "es")).slice(0, limit);
  }

  stableStudyId(value) {
    let hash = 5381;
    for (const char of this.normalizeSpeech(value)) hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
    return (hash >>> 0).toString(36);
  }

  async buildAutomaticStudySchedule(days) {
    const ranked = await this.getAcademicRecommendations(100);
    if (!ranked.length) return { ranked: [], sessions: [] };
    const horizon = Math.max(1, Math.min(14, Number(days) || 7));
    const slots = horizon * 2;
    const coverage = ranked.slice();
    const weighted = [];
    for (const item of ranked) {
      const copies = item.score >= 70 ? 3 : item.score >= 40 ? 2 : 1;
      for (let i = 0; i < copies; i += 1) weighted.push(item);
    }
    const queue = coverage.concat(weighted);
    const sessions = [];
    let cursor = 0;
    for (let day = 0; day < horizon; day += 1) {
      const date = this.addDays(day);
      const used = new Set();
      for (let part = 0; part < 2 && sessions.length < slots; part += 1) {
        let choice = null;
        for (let attempts = 0; attempts < queue.length * 2; attempts += 1) {
          const candidate = queue[cursor % queue.length];
          cursor += 1;
          if (!used.has(candidate.subject.folderPath)) { choice = candidate; break; }
        }
        if (!choice) choice = ranked[(day + part) % ranked.length];
        used.add(choice.subject.folderPath);
        const topics = choice.topics || [];
        const topic = topics.length ? topics[(this.daySeed(date) + choice.subject.index + part) % topics.length] : choice.topic;
        const task = choice.openTasks && choice.openTasks.length ? choice.openTasks[(day + part) % choice.openTasks.length] : null;
        const activity = task ? `Avanzar pendiente: ${this.cleanDisplayText(task.text)}` : topic ? `Repasar ${topic.basename}` : `Repasar material de ${choice.subject.name}`;
        const source = task ? task.file : topic;
        sessions.push({ date, item: choice, activity, source, minutes: Number(this.settings.studyMinutes) || 45 });
      }
    }
    return { ranked, sessions };
  }

  async updateAutomaticStudyReminders(sessions) {
    const reminders = await this.ensureFile(REMINDERS_FILE, "# Recordatorios\n\n## Pendientes\n\n");
    const current = await this.app.vault.read(reminders);
    const startAt = current.indexOf(AUTO_STUDY_START);
    const endAt = current.indexOf(AUTO_STUDY_END);
    const previousBlock = startAt >= 0 && endAt > startAt ? current.slice(startAt, endAt + AUTO_STUDY_END.length) : "";
    const completed = new Map();
    for (const line of previousBlock.split(/\r?\n/)) {
      const id = (line.match(/<!-- ESTUDIO_AUTO:([a-z0-9]+) -->/i) || [])[1];
      if (id && /^- \[x\]/i.test(line.trim())) completed.set(id, line.trim());
    }
    const existingManual = current.replace(previousBlock, "");
    const newIds = new Set();
    const lines = [AUTO_STUDY_START, "", "### Estudio automático", "", "> Este bloque se actualiza solo. Los recordatorios personales fuera de este bloque no se modifican.", ""];
    for (const session of sessions) {
      const subject = session.item.subject.name;
      const duplicate = existingManual.split(/\r?\n/).some((line) => line.includes(session.date) && this.subjectMatchesText(session.item.subject, line));
      if (duplicate) continue;
      const sourceLink = session.source ? ` — [[${session.source.path.replace(/\.md$/i, "")}]]` : "";
      const id = this.stableStudyId(`${session.date}|${subject}|${session.activity}`);
      newIds.add(id);
      if (completed.has(id)) lines.push(completed.get(id));
      else lines.push(`- [ ] ${session.date} — ${subject}: ${session.activity} · ${session.minutes} min${sourceLink} <!-- ESTUDIO_AUTO:${id} -->`);
    }
    const historical = [...completed.entries()].filter(([id]) => !newIds.has(id));
    if (historical.length) {
      lines.push("", "#### Completados anteriores", "");
      for (const [, line] of historical) lines.push(line);
    }
    lines.push("", AUTO_STUDY_END);
    const block = lines.join("\n");
    let next;
    if (startAt >= 0 && endAt > startAt) next = current.slice(0, startAt).replace(/\s*$/, "\n\n") + block + current.slice(endAt + AUTO_STUDY_END.length);
    else next = current.replace(/\s*$/, "") + "\n\n" + block + "\n";
    if (next !== current) await this.app.vault.modify(reminders, next);
  }

  async refreshAutomaticStudySystem(showNotice = false) {
    if (this.studyRefreshInProgress) return null;
    this.studyRefreshInProgress = true;
    try {
      const horizon = Math.max(3, Math.min(14, Number(this.settings.studyHorizonDays) || 7));
      const { ranked, sessions } = await this.buildAutomaticStudySchedule(horizon);
      if (!ranked.length) {
        if (showNotice) new Notice("No detecté materias dentro de Universidad.");
        return null;
      }
      await this.ensureFolder(STUDY_PLANS_FOLDER);
      const plan = await this.ensureFile(AUTO_STUDY_PLAN_FILE, "");
      const grouped = new Map();
      for (const session of sessions) {
        if (!grouped.has(session.date)) grouped.set(session.date, []);
        grouped.get(session.date).push(session);
      }
      const lines = [
        "---", "tipo: plan_estudio_automatico", `actualizado: ${this.todayIso()}`, `horizonte_dias: ${horizon}`, "estado: activo", "---", "",
        "# Plan automático de estudio", "",
        "> Se genera a partir de todas las materias detectadas en Universidad. No privilegia una materia fija: prioriza fechas, pendientes y material reciente y rota el repaso entre cursos.", "",
        "## Prioridad actual", "",
      ];
      ranked.forEach((item, index) => lines.push(`${index + 1}. **${item.subject.name}** — ${item.reason}`));
      lines.push("", `## Próximos ${horizon} días`, "");
      for (const [date, daySessions] of grouped) {
        lines.push(`### ${date}`, "");
        for (const session of daySessions) {
          const sourceLink = session.source ? ` · [[${session.source.path.replace(/\.md$/i, "")}]]` : "";
          lines.push(`- **${session.item.subject.name}** · ${session.minutes} min — ${session.activity}${sourceLink}`);
        }
        lines.push("");
      }
      lines.push("## Materias detectadas", "");
      for (const item of ranked) lines.push(`- [[${item.subject.folderPath}/${item.subject.name} - Inicio|${item.subject.name}]]`);
      lines.push("", "## Cómo funciona", "", "- Los documentos nuevos resumidos por la IA local actualizan este plan automáticamente.", "- Los recordatorios de estudio se actualizan sin tocar recordatorios personales.", "- Los repasos rotan entre materias para evitar que una sola aparezca siempre.", "");
      const next = lines.join("\n");
      const current = plan instanceof TFile ? await this.app.vault.read(plan) : "";
      if (current !== next) await this.app.vault.modify(plan, next);
      await this.updateAutomaticStudyReminders(sessions);
      this.scheduleRefresh();
      if (showNotice) new Notice(`Estudio automático actualizado: ${ranked.length} materia(s) y ${sessions.length} sesión(es) de estudio.`, 7000);
      return { ranked, sessions, plan };
    } finally {
      this.studyRefreshInProgress = false;
    }
  }

  async studyContext(subject, focus) {
    const query = this.normalizeSpeech(`${subject} ${focus || ""}`);
    const terms = query.split(/[^a-z0-9ñ]+/).filter((word) => word.length > 2);
    const candidates = this.app.vault.getMarkdownFiles().filter((file) => {
      const path = normalizePath(file.path);
      return (path.startsWith("02 - Universidad/") && !path.startsWith(`${STUDY_PLANS_FOLDER}/`)) || path.startsWith(`${AUTOMATIC_SUMMARIES_FOLDER}/`);
    }).map((file) => {
      const path = this.normalizeSpeech(file.path);
      const score = terms.reduce((sum, word) => sum + (path.includes(word) ? 3 : 0), 0);
      return { file, score };
    }).sort((a, b) => b.score - a.score || b.file.stat.mtime - a.file.stat.mtime);

    let selected = candidates.filter((item) => item.score > 0).slice(0, 12);
    if (selected.length < 4) {
      const used = new Set(selected.map((item) => item.file.path));
      selected = selected.concat(candidates.filter((item) => !used.has(item.file.path)).slice(0, 4 - selected.length));
    }
    const parts = [];
    const sources = [];
    let total = 0;
    for (const item of selected) {
      if (total >= 26000) break;
      const content = (await this.app.vault.cachedRead(item.file)).trim().slice(0, 6000);
      if (!content) continue;
      const remaining = 26000 - total;
      parts.push(`FUENTE: ${item.file.path}\n${content.slice(0, remaining)}`);
      sources.push(item.file.path);
      total += Math.min(content.length, remaining);
    }
    return { text: parts.join("\n\n---\n\n"), sources };
  }

  studyDates(endDate, limit = 60) {
    const dates = [];
    const current = new Date(`${this.todayIso()}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    while (current <= end && dates.length < limit) {
      dates.push(new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  async createStudyPlan(data) {
    const subject = String(data.subject || "").trim();
    const endDate = String(data.endDate || "").trim();
    const minutes = Math.max(15, Math.min(480, Number(data.minutes) || 60));
    if (!subject || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("complete el curso y la fecha objetivo");
    if (endDate < this.todayIso()) throw new Error("la fecha objetivo no puede estar en el pasado");

    const context = await this.studyContext(subject, data.focus);
    if (!context.text) throw new Error("no encontré notas ni resúmenes académicos para preparar el plan");
    const dates = this.studyDates(endDate);

    const aiPlugin = (this.app.plugins && typeof this.app.plugins.getPlugin === "function")
      ? this.app.plugins.getPlugin("vault-ai")
      : (this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["vault-ai"] : null);

    const systemPrompt = `Eres el tutor académico de ${this.profileName()} dentro de Obsidian. Crea planes prácticos usando solamente las fuentes proporcionadas. No inventes temas ni hechos. Explica de forma progresiva, incluye práctica activa y repasos espaciados. Responde en español y Markdown.`;
    const userPrompt = [
      `CURSO O TEMA: ${subject}`,
      `FECHA INICIAL: ${this.todayIso()}`,
      `FECHA OBJETIVO: ${endDate}`,
      `TIEMPO DIARIO: ${minutes} minutos`,
      `ENFOQUE ADICIONAL: ${String(data.focus || "Sin indicación adicional").trim()}`,
      `DÍAS DISPONIBLES: ${dates.join(", ")}`,
      "Crea exactamente estas secciones: ## Objetivo, ## Diagnóstico del material, ## Plan por día, ## Método para aprender, ## Comprobación final.",
      "En Plan por día usa un subtítulo ### YYYY-MM-DD por cada fecha utilizada e indica tema, actividad, práctica y resultado esperado.",
      "Adapta la cantidad de trabajo al tiempo diario. El último día debe incluir repaso o autoevaluación.",
      "FUENTES DE LA BÓVEDA:", context.text,
    ].join("\n\n");

    let planText = "";
    if (aiPlugin && typeof aiPlugin.callAI === "function") {
      planText = await aiPlugin.callAI(userPrompt, systemPrompt);
    } else {
      if (!Platform.isDesktopApp) throw new Error("Abre Obsidian en la PC o configura 'IA de bóveda' con Gemini para crear el plan.");
      const response = await requestUrl({
        url: "http://127.0.0.1:11434/api/generate",
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          model: this.settings.model || "llama3.2", stream: false,
          system: systemPrompt,
          prompt: userPrompt,
          options: { temperature: 0.15, num_ctx: 8192 },
        }),
        throw: false,
      });
      if (response.status !== 200 || !response.json || !response.json.response) throw new Error("No se pudo generar el plan con la IA");
      planText = response.json.response;
    }

    await this.ensureFolder(STUDY_PLANS_FOLDER);
    const desired = `${STUDY_PLANS_FOLDER}/${this.safeName(subject)} - Plan hasta ${endDate}.md`;
    const path = await this.uniquePath(desired);
    const sourceLinks = context.sources.map((source) => `- [[${source.replace(/\.md$/i, "")}]]`).join("\n");
    const content = [
      "---", "tipo: plan_estudio", `curso: "${subject.replace(/"/g, '\\"')}"`, `fecha_inicio: ${this.todayIso()}`,
      `fecha_objetivo: ${endDate}`, `minutos_diarios: ${minutes}`, "estado: activo", "---", "",
      `# Plan de estudio — ${subject}`, "", planText.trim(), "", "## Fuentes consultadas", "", sourceLinks,
    ].join("\n") + "\n";
    const file = await this.app.vault.create(path, content);

    if (data.createReminders) {
      const reminders = await this.ensureFile(REMINDERS_FILE, "# Recordatorios\n\n## Pendientes\n\n");
      const current = await this.app.vault.read(reminders);
      const link = file.path.replace(/\.md$/i, "");
      const lines = dates.map((date) => `- [ ] ${date} — Estudiar ${subject} durante ${minutes} minutos — [[${link}]]`);
      await this.app.vault.modify(reminders, current.replace(/\s*$/, "") + "\n" + lines.join("\n") + "\n");
    }
    await this.appendDailyActivity(`📚 Plan de estudio creado: [[${file.path.replace(/\.md$/i, "")}]]`);
    await this.app.workspace.getLeaf(false).openFile(file);
    this.scheduleRefresh();
    new Notice(data.createReminders ? `Plan creado con ${dates.length} recordatorio(s).` : "Plan de estudio creado.", 7000);
    return file;
  }

  cleanDisplayText(value) {
    return String(value || "")
      .replace(/<!--\s*ESTUDIO_AUTO:[^>]+-->/gi, "")
      .replace(/<!--\s*ESTUDIO_AUTO_(?:INICIO|FIN)\s*-->/gi, "")
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, (_, target) => target.split("/").pop())
      .replace(/\s+/g, " ").trim();
  }

  cleanReminderDisplayText(value) {
    const raw = String(value || "");
    const isAutoStudy = /<!--\s*ESTUDIO_AUTO:/i.test(raw);
    let cleaned = raw.replace(/<!--\s*ESTUDIO_AUTO:[^>]+-->/gi, "").trim();
    if (isAutoStudy) cleaned = cleaned.replace(/\s+—\s+\[\[[^\]]+\]\]\s*$/i, "");
    const visible = this.cleanDisplayText(cleaned);
    const parts = visible.split(/\s+—\s+/);
    if (parts.length === 2) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      const projectName = left.replace(/^continuar proyecto:\s*/i, "").trim();
      if (projectName && this.normalizeSpeech(projectName) === this.normalizeSpeech(right)) return left;
    }
    return visible;
  }

  parseMovement(content) {
    if (!/^---\s*[\r\n]+[\s\S]*?[\r\n]+---/m.test(content)) return null;
    const get = (key) => {
      const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return match ? match[1].trim().replace(/^"|"$/g, "") : "";
    };
    if (get("tipo") !== "movimiento_financiero") return null;
    return { type: get("movimiento"), date: get("fecha"), amount: Number(get("monto")) || 0, description: get("descripcion") };
  }

  async getFinanceSummary(month) {
    const summary = { ingreso: 0, gasto: 0, pago_deuda: 0, ahorro: 0, transferencia: 0, recent: [] };
    const prefix = normalizePath(`${MOVEMENTS_ROOT}/${month}`) + "/";
    const files = this.app.vault.getMarkdownFiles().filter((file) => normalizePath(file.path).startsWith(prefix));
    for (const file of files) {
      const movement = this.parseMovement(await this.app.vault.cachedRead(file));
      if (!movement) continue;
      if (Object.prototype.hasOwnProperty.call(summary, movement.type)) summary[movement.type] += movement.amount;
      summary.recent.push({ file, ...movement });
    }
    summary.recent.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
    summary.available = summary.ingreso - summary.gasto - summary.pago_deuda - summary.ahorro;
    return summary;
  }

  async getDueReminders() {
    const today = this.todayIso();
    const file = this.app.vault.getAbstractFileByPath(REMINDERS_FILE);
    if (!(file instanceof TFile)) return [];
    const lines = (await this.app.vault.cachedRead(file)).split(/\r?\n/);
    return lines.map((line, index) => {
      const match = line.match(/^- \[ \] (\d{4}-\d{2}-\d{2}) — (.+)$/);
      if (!match) return null;
      const visible = this.cleanReminderDisplayText(match[2]);
      if (this.isPendingQuery(visible)) return null;
      return { date: match[1], text: match[2], overdue: match[1] < today, line: index + 1 };
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  }

  async cleanupConversationalReminders() {
    const file = this.app.vault.getAbstractFileByPath(REMINDERS_FILE);
    if (!(file instanceof TFile)) return 0;
    const current = await this.app.vault.read(file);
    const newline = current.includes("\r\n") ? "\r\n" : "\n";
    const lines = current.split(/\r?\n/);
    let removed = 0;
    const kept = lines.filter((line) => {
      const match = line.match(/^- \[ \] \d{4}-\d{2}-\d{2} — (.+)$/);
      if (!match) return true;
      const visible = this.cleanReminderDisplayText(match[1]);
      if (!this.isPendingQuery(visible)) return true;
      removed += 1;
      return false;
    });
    if (removed) await this.app.vault.modify(file, kept.join(newline).replace(/\s*$/, "") + newline);
    return removed;
  }

  async getOpenTasks() {
    const relevant = this.app.vault.getMarkdownFiles().filter((file) => {
      if (file.path === REMINDERS_FILE || file.stat.size > 250000) return false;
      return /(^01 - Hoy\/|^03 - Trabajo\/|^04 - Proyectos\/|^06 - Personal\/|tareas|pendientes)/i.test(file.path);
    });
    const tasks = [];
    for (const file of relevant) {
      const lines = (await this.app.vault.cachedRead(file)).split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^\s*- \[ \] (.+\S)\s*$/);
        if (match) tasks.push({ file, text: match[1] });
        if (tasks.length >= 40) return tasks;
      }
    }
    return tasks;
  }

  searchNormalize(value) {
    return String(value || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .replace(/\s+/g, " ")
      .trim();
  }

  async buildSearchIndex() {
    if (this.searchIndex) return this.searchIndex;
    if (this.searchIndexBuilding) return this.searchIndexBuilding;
    this.searchIndexBuilding = (async () => {
      const index = [];
      const files = this.app.vault.getFiles().filter((file) => !normalizePath(file.path).startsWith(".obsidian/"));
      for (const file of files) {
        let content = "";
        if (file.extension === "md" && file.stat.size <= 650000) {
          try { content = await this.app.vault.cachedRead(file); } catch (_) { content = ""; }
        }
        const sample = content.slice(0, 180000);
        index.push({
          file,
          title: file.basename,
          path: file.path,
          titleNorm: this.searchNormalize(file.basename),
          pathNorm: this.searchNormalize(file.path),
          content: sample,
          contentNorm: this.searchNormalize(sample),
        });
      }
      this.searchIndex = index;
      this.searchIndexBuilding = null;
      return index;
    })();
    return this.searchIndexBuilding;
  }

  searchSnippet(content, terms) {
    if (!content) return "";
    const lines = String(content).split(/\r?\n/);
    let picked = "";
    for (const line of lines) {
      const clean = line
        .replace(/^---\s*$/, "")
        .replace(/^#{1,6}\s+/, "")
        .replace(/<!--.*?-->/g, "")
        .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
        .replace(/[*_`>#]/g, "")
        .trim();
      if (!clean || clean.length < 3) continue;
      const normalized = this.searchNormalize(clean);
      if (terms.some((term) => normalized.includes(term))) { picked = clean; break; }
    }
    if (!picked) {
      picked = String(content)
        .replace(/---[\s\S]*?---/m, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/[#*_`>\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return picked.length > 150 ? `${picked.slice(0, 147)}…` : picked;
  }

  async searchVault(query, limit = 10) {
    const normalized = this.searchNormalize(query);
    if (!normalized) return [];
    const terms = normalized.split(" ").filter(Boolean);
    const index = await this.buildSearchIndex();
    const results = [];

    for (const item of index) {
      const haystack = `${item.titleNorm} ${item.pathNorm} ${item.contentNorm}`;
      if (!terms.every((term) => haystack.includes(term))) continue;

      let score = 0;
      if (item.titleNorm === normalized) score += 120;
      else if (item.titleNorm.startsWith(normalized)) score += 90;
      else if (item.titleNorm.includes(normalized)) score += 70;
      if (item.pathNorm.includes(normalized)) score += 35;
      for (const term of terms) {
        if (item.titleNorm.includes(term)) score += 18;
        if (item.pathNorm.includes(term)) score += 8;
        if (item.contentNorm.includes(term)) score += 4;
      }
      if (item.file.extension === "md") score += 4;
      score += Math.min(6, Math.max(0, (item.file.stat.mtime || 0) / 1e13));

      results.push({
        file: item.file,
        score,
        snippet: this.searchSnippet(item.content, terms),
      });
    }

    return results
      .sort((a, b) => b.score - a.score || b.file.stat.mtime - a.file.stat.mtime)
      .slice(0, Math.max(1, limit));
  }

  getRecentNotes() {
    return this.app.vault.getMarkdownFiles()
      .filter((file) => !file.path.startsWith(".obsidian/") && !file.path.includes("/Movimientos/"))
      .sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, 6);
  }

  getSuggestedNote() {
    const roots = ["02 - Universidad/", "03 - Trabajo/", "04 - Proyectos/", "05 - Conocimiento/"];
    const candidates = this.app.vault.getMarkdownFiles().filter((file) => {
      if (!roots.some((root) => normalizePath(file.path).startsWith(root))) return false;
      if (/ - Inicio$/i.test(file.basename)) return false;
      if (/^(calificaciones|calendario de evaluaciones|pendientes del semestre)$/i.test(file.basename)) return true;
      return file.stat.size > 80;
    }).sort((a, b) => a.path.localeCompare(b.path, "es"));
    if (!candidates.length) return null;
    const start = new Date(`${this.todayIso()}T00:00:00`);
    const yearStart = new Date(start.getFullYear(), 0, 0);
    const day = Math.floor((start - yearStart) / 86400000);
    return candidates[day % candidates.length];
  }

  getAreaStats() {
    const definitions = [
      ["🎓", this.educationAreaLabel(), `${EDUCATION_ROOT}/`, this.getEducationHomePath()],
      ["💼", this.workAreaLabel(), `${WORK_ROOT}/`, this.getWorkHomePath()],
      ["🚀", "Proyectos", "04 - Proyectos/", "04 - Proyectos/Proyectos - Inicio.md"],
      ["🧠", "Conocimiento", "05 - Conocimiento/", "05 - Conocimiento/Conocimiento - Inicio.md"],
      ["👤", "Personal", "06 - Personal/", "06 - Personal/Personal - Inicio.md"],
      ["📚", "Recursos", "07 - Recursos/", "07 - Recursos/Recursos - Inicio.md"],
    ];
    const files = this.app.vault.getFiles();
    return definitions.map(([icon, name, prefix, home]) => ({
      icon, name, home,
      count: files.filter((file) => normalizePath(file.path).startsWith(prefix)).length,
    }));
  }

  getOrganizationStats() {
    const files = this.app.vault.getFiles().filter((file) => !file.path.startsWith(".obsidian/"));
    const groups = new Map();
    for (const file of files) {
      const key = file.basename.toLowerCase().replace(/\s+\d+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file.path);
    }
    return {
      duplicateGroups: [...groups.values()].filter((items) => items.length > 1),
      encoded: files.filter((file) => /%[0-9a-f]{2}/i.test(file.name)),
      intake: files.filter((file) => normalizePath(file.path).startsWith("07 - Recursos/00 - Por clasificar/")),
    };
  }

  async createOrganizationReport(openAfter) {
    const stats = this.getOrganizationStats();
    const lines = [
      "# Reporte de organización", "", `Actualizado: ${this.todayIso()}`, "",
      "> Este reporte no elimina ni mueve archivos. Sirve para decidir con calma.", "",
      `## Posibles duplicados — ${stats.duplicateGroups.length}`, "",
    ];
    if (!stats.duplicateGroups.length) lines.push("No se detectaron grupos duplicados.", "");
    for (const group of stats.duplicateGroups) lines.push(...group.map((path) => `- [ ] Revisar: [[${path}]]`), "");
    lines.push(`## Nombres codificados — ${stats.encoded.length}`, "");
    if (!stats.encoded.length) lines.push("No se detectaron nombres codificados.", "");
    for (const file of stats.encoded) lines.push(`- [ ] Renombrar desde Obsidian: [[${file.path}]]`);
    lines.push("", `## Por clasificar — ${stats.intake.length}`, "");
    for (const file of stats.intake) lines.push(`- [ ] Clasificar: [[${file.path}]]`);
    const report = await this.ensureFile(ORGANIZATION_REPORT_FILE, lines.join("\n") + "\n");
    await this.app.vault.modify(report, lines.join("\n") + "\n");
    if (openAfter) await this.app.workspace.getLeaf(false).openFile(report);
    new Notice("Reporte actualizado; no se movió ni eliminó nada.");
  }

  addDays(days) {
    const date = new Date(`${this.todayIso()}T12:00:00`);
    date.setDate(date.getDate() + days);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  normalizeSpeech(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!]/g, "").replace(/\s+/g, " ").trim();
  }

  isPendingQuery(value) {
    const text = this.normalizeSpeech(value);
    return /^(?:dime|muestrame|mostrame|ensename|indicame)?\s*(?:que\s+)?(?:tengo|hay)\s+(?:de\s+)?pendientes?$/.test(text)
      || /^(?:mis|los)\s+pendientes$/.test(text)
      || /^que\s+hay\s+para\s+hoy$/.test(text)
      || /^que\s+tengo(?:\s+para\s+hoy)?$/.test(text)
      || /^como\s+voy$/.test(text);
  }

  dateFromSpeech(value, fallbackToToday = true) {
    const text = this.normalizeSpeech(value);
    if (text.includes("pasado manana")) return this.addDays(2);
    if (text.includes("manana")) return this.addDays(1);
    if (text.includes("proxima semana") || text.includes("en una semana")) return this.addDays(7);
    const inDays = text.match(/\ben\s+(\d{1,2})\s+dias?\b/);
    if (inDays) return this.addDays(Math.max(0, Math.min(365, Number(inDays[1]) || 0)));
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const match = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (match) {
      const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : this.todayIso().slice(0, 4);
      return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
    }
    const weekdays = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
    const now = new Date(`${this.todayIso()}T12:00:00`);
    for (const [name, weekday] of Object.entries(weekdays)) {
      if (!new RegExp(`\\b${name}\\b`).test(text)) continue;
      let diff = (weekday - now.getDay() + 7) % 7;
      if (diff === 0 && !text.includes("hoy")) diff = 7;
      return this.addDays(diff);
    }
    if (text.includes("hoy")) return this.todayIso();
    return fallbackToToday ? this.todayIso() : "";
  }

  async systemStatus() {
    const reminders = await this.getDueReminders();
    const tasks = await this.getOpenTasks();
    const finance = await this.getFinanceSummary(this.currentMonth());
    const due = reminders.filter((item) => item.date <= this.todayIso());
    const study = await this.getAcademicRecommendations(3);
    return [
      `Hoy ${this.getTodayFile() ? "ya tiene actividad registrada" : "todavía no tiene una nota porque no has guardado actividad"}.`,
      `Tienes ${due.length} recordatorio(s) para hoy o atrasados y ${tasks.length} tarea(s) abierta(s) en tus notas principales.`,
      `Este mes: ingresos ${this.formatMoney(finance.ingreso)}, gastos ${this.formatMoney(finance.gasto)}, pagos de deuda ${this.formatMoney(finance.pago_deuda)} y disponible ${this.formatMoney(finance.available)}.`,
      study.length ? `Estudio: ${study.map((item) => item.subject.name).join(", ")}.` : "No detecté materias académicas para priorizar.",
    ].join("\n");
  }

  async systemPlan() {
    const reminders = await this.getDueReminders();
    const tasks = await this.getOpenTasks();
    const study = await this.getAcademicRecommendations(3);
    const today = this.todayIso();
    const urgent = reminders.filter((item) => item.date <= today && !/ESTUDIO_AUTO:/i.test(item.text));
    const steps = [];
    if (urgent.length) steps.push(`1. Atender: ${this.cleanDisplayText(urgent[0].text)}${urgent[0].overdue ? " (atrasado)" : ""}.`);
    if (tasks.length) steps.push(`${steps.length + 1}. Continuar: ${this.cleanDisplayText(tasks[0].text)} — ${tasks[0].file.basename}.`);
    for (const item of study) {
      if (steps.length >= 4) break;
      steps.push(`${steps.length + 1}. Estudiar ${item.subject.name}: ${item.topic ? item.topic.basename : item.reason}.`);
    }
    if (!steps.length) steps.push("1. No hay una urgencia detectada. Registra tu siguiente acción o crea una nota.");
    return `Plan sugerido para hoy:\n${steps.slice(0, 4).join("\n")}\n\nEl estudio rota entre materias y se actualiza automáticamente con tus documentos.`;
  }

  async relevantContext(query) {
    const words = this.normalizeSpeech(query).split(/[^a-z0-9ñ]+/).filter((word) => word.length > 3);
    if (!words.length) return "";
    const scored = this.app.vault.getMarkdownFiles().map((file) => {
      const path = this.normalizeSpeech(file.path);
      return { file, score: words.reduce((sum, word) => sum + (path.includes(word) ? 1 : 0), 0) };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.file.stat.mtime - a.file.stat.mtime).slice(0, 4);
    const parts = [];
    for (const item of scored) {
      const content = (await this.app.vault.cachedRead(item.file)).slice(0, 3500);
      parts.push(`NOTA: ${item.file.path}\n${content}`);
    }
    return parts.join("\n\n---\n\n");
  }

  agentTerms(value) {
    const stop = new Set(["de", "la", "el", "en", "a", "y", "o", "mi", "un", "una", "para", "como", "esto", "esta", "este", "estos", "estas", "quiero", "necesito", "hacer", "tengo", "agrega", "anota", "guarda", "crear", "crea", "nueva", "nuevo", "nota", "tarea", "proyecto", "recordatorio", "pendiente", "donde", "sobre", "porque", "tambien", "cuando", "desde", "hasta", "algo", "assistant", "que"]);
    return [...new Set(this.normalizeSpeech(value).split(/[^a-z0-9ñ]+/).filter((word) => word.length >= 2 && !stop.has(word)))];
  }

  agentCandidateNotes(input, limit = 14) {
    const terms = this.agentTerms(input);
    const query = this.normalizeSpeech(input);
    const active = this.app.workspace.getActiveFile();
    const contextNames = [...this.detectEducationContexts(), ...this.detectWorkContexts()]
      .map((context) => this.normalizeSpeech(context))
      .filter(Boolean);
    const roots = ["00 - Inbox/", "02 - Universidad/", "03 - Trabajo/", "04 - Proyectos/", "05 - Conocimiento/", "06 - Personal/"];
    const candidates = this.app.vault.getMarkdownFiles().filter((file) => {
      const path = normalizePath(file.path);
      if (!roots.some((root) => path.startsWith(root))) return false;
      if (path === REMINDERS_FILE || path === AUTO_STUDY_PLAN_FILE || path.includes("/Movimientos/") || path.includes("/Notas diarias/") || path.startsWith("06 - Personal/Finanzas/")) return false;
      return true;
    }).map((file) => {
      const title = this.normalizeSpeech(file.basename);
      const titleBase = title.replace(/\s+-\s+(inicio|tareas|apuntes.*|notas.*|pendientes)$/i, "").trim();
      const path = this.normalizeSpeech(file.path);
      let score = 0;
      if (titleBase.length >= 4 && query.includes(titleBase)) score += 140;
      if (title.length >= 4 && query.includes(title)) score += 110;
      for (const context of contextNames) {
        if (query.includes(context) && titleBase === context) score += 180;
      }
      for (const term of terms) {
        if (title === term) score += 60;
        if (title.includes(term)) score += term.length <= 2 ? 18 : 24;
        if (path.includes(term)) score += term.length <= 2 ? 5 : 9;
      }
      if (active instanceof TFile && active.path === file.path) score += 28;
      if (/ - Inicio$/i.test(file.basename)) score += 2;
      return { file, score };
    }).filter((item) => item.score > 0 || (active instanceof TFile && active.path === item.file.path));
    candidates.sort((a, b) => b.score - a.score || b.file.stat.mtime - a.file.stat.mtime);
    return candidates.slice(0, Math.max(1, limit)).map((item) => item.file);
  }

  agentAreaFolder(area, options = {}) {
    if (area === "trabajo") {
      const context = String(options.work_context || this.settings.activeWorkContext || "").trim();
      return this.workNotesFolder(context);
    }
    if (area === "universidad") {
      const context = String(options.education_context || this.settings.activeEducationContext || "").trim();
      return this.educationNotesFolder(context);
    }
    return ({
      inbox: "00 - Inbox",
      proyectos: "04 - Proyectos/Notas",
      conocimiento: "05 - Conocimiento/Notas",
      personal: "06 - Personal/Notas",
    })[area] || "00 - Inbox";
  }

  cleanAgentCapturedContent(value) {
    let clean = String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    const patterns = [
      /^(?:guarda|guardar|anota|anotar)\s+esta\s+idea\s*:?\s*/i,
      /^(?:idea\s*:|nota\s*:|anota|anotar|guarda|guardar|apunta|pon\s+esto|crear\s+nota|crea\s+una\s+nota)\s*:?\s*/i,
    ];
    for (const pattern of patterns) clean = clean.replace(pattern, "").trim();
    return clean;
  }

  agentTitleFromContent(content, fallback = "Nota de sistema") {
    const clean = this.cleanAgentCapturedContent(content);
    if (!clean) return fallback;
    return this.safeName(clean.replace(/[.!?].*$/, "").slice(0, 65) || fallback);
  }

  async appendLineToSection(file, heading, line) {
    if (!(file instanceof TFile) || file.extension !== "md") throw new Error("destino invalido");
    let current = await this.app.vault.read(file);
    const normalizedLine = String(line || "").trim();
    if (!normalizedLine) return file;
    if (this.normalizeSpeech(current).includes(this.normalizeSpeech(normalizedLine).slice(0, 160))) return file;
    const newline = current.includes("\r\n") ? "\r\n" : "\n";
    const lines = current.split(/\r?\n/);
    const headingNorm = this.normalizeSpeech(heading.replace(/^#+\s*/, ""));
    let start = -1;
    let level = 2;
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(/^(#{2,6})\s+(.+?)\s*$/);
      if (match && this.normalizeSpeech(match[2]) === headingNorm) { start = i; level = match[1].length; break; }
    }
    if (start < 0) {
      const suffix = `${newline}${newline}${heading}${newline}${newline}${normalizedLine}${newline}`;
      await this.app.vault.modify(file, current.replace(/\s*$/, "") + suffix);
      return file;
    }
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      const match = lines[i].match(/^(#{1,6})\s+/);
      if (match && match[1].length <= level) { end = i; break; }
    }
    let insertAt = end;
    while (insertAt > start + 1 && !lines[insertAt - 1].trim()) insertAt -= 1;
    lines.splice(insertAt, 0, normalizedLine);
    await this.app.vault.modify(file, lines.join(newline).replace(/\s*$/, "") + newline);
    return file;
  }

  async appendAgentNote(file, content) {
    const clean = this.cleanAgentCapturedContent(content);
    if (!clean) throw new Error("no hay contenido para guardar");
    const line = `- **${this.todayIso()} ${this.localTime()}** — ${clean}`;
    await this.appendLineToSection(file, "## Notas", line);
    return file;
  }

  async appendAgentTask(file, task) {
    const clean = String(task || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) throw new Error("la tarea esta vacia");
    const current = await this.app.vault.cachedRead(file);
    const needle = this.normalizeSpeech(clean);
    const exists = current.split(/\r?\n/).some((line) => {
      const match = line.match(/^\s*- \[.\]\s+(.+?)\s*$/);
      return match && this.normalizeSpeech(match[1]) === needle;
    });
    if (exists) return file;
    await this.appendLineToSection(file, "## Tareas", `- [ ] ${clean}`);
    return file;
  }

  async createClassifiedAgentNote({ title, content, area = "inbox", work_context = "", education_context = "" }) {
    const folder = this.agentAreaFolder(area, { work_context, education_context });
    await this.ensureFolder(folder);
    const cleanContent = this.cleanAgentCapturedContent(content);
    const finalTitle = this.safeName(title || this.agentTitleFromContent(cleanContent));
    const path = await this.uniquePath(`${folder}/${finalTitle}.md`);
    const body = [
      "---", `creado: ${this.todayIso()}`, "tipo: nota_sistema", `area: ${area}`, "estado: clasificado", "---", "",
      `# ${finalTitle}`, "", cleanContent || "Nota creada por el asistente.", "", "## Tareas", "", "## Notas", "",
    ].join("\n");
    const file = await this.app.vault.create(path, body);
    await this.removeRedundantTitleForFile(file).catch(() => false);
    return file;
  }

  findSubjectNote(subject, kind = "apuntes") {
    if (!subject) return null;
    const files = this.app.vault.getMarkdownFiles().filter((file) => normalizePath(file.path).startsWith(subject.folderPath + "/"));
    const patterns = kind === "tareas" ? [/ - Tareas$/i, /\bTareas\b/i, /\bPendientes\b/i] : [/ - Apuntes/i, /\bApuntes\b/i, /\bNotas\b/i];
    return files.find((file) => patterns.some((pattern) => pattern.test(file.basename))) || null;
  }

  async saveUniversityAgentNote(subjectPath, content, title = "") {
    const subjects = this.detectAcademicSubjects();
    const subject = subjects.find((item) => item.folderPath === subjectPath);
    if (!subject) throw new Error("no pude validar la materia");
    let file = this.findSubjectNote(subject, "apuntes");
    if (!file) {
      const finalTitle = this.safeName(title || `${subject.name} - Apuntes`);
      const path = await this.uniquePath(`${subject.folderPath}/${finalTitle}.md`);
      file = await this.app.vault.create(path, [
        "---", `creado: ${this.todayIso()}`, "tipo: apuntes", `materia: \"${subject.name.replace(/\"/g, "'")}\"`, "---", "",
        `# ${finalTitle}`, "", "## Apuntes", "",
      ].join("\n"));
      await this.removeRedundantTitleForFile(file).catch(() => false);
    }
    await this.appendAgentNote(file, content);
    this.scheduleAutomaticStudyRefresh(file);
    return { file, subject };
  }

  async cleanupBrokenAgentProjectTasks() {
    const projects = this.app.vault.getMarkdownFiles().filter((file) => normalizePath(file.path).startsWith("04 - Proyectos/"));
    let cleanedCount = 0;
    for (const file of projects) {
      const current = await this.app.vault.cachedRead(file);
      const next = current.replace(/^\s*- \[ \] \[object Object\]\s*\r?\n?/gmi, "");
      if (next !== current) {
        await this.app.vault.modify(file, next);
        cleanedCount += 1;
      }
    }
    return cleanedCount;
  }

  async createOrUpdateProject(action) {
    await this.cleanupBrokenAgentProjectTasks();
    const projectName = this.safeName(action.project_name || action.title || this.agentTitleFromContent(action.content, "Nuevo proyecto"));
    const norm = this.normalizeSpeech(projectName);
    const existing = this.app.vault.getMarkdownFiles()
      .filter((file) => normalizePath(file.path).startsWith("04 - Proyectos/"))
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length)
      .find((file) => {
        const name = this.normalizeSpeech(file.basename.replace(/ - Inicio$/i, ""));
        return name === norm || name.includes(norm) || norm.includes(name);
      });
    let file = existing;
    let created = false;
    if (!file) {
      const folder = `04 - Proyectos/${projectName}`;
      await this.ensureFolder(folder);
      const path = `${folder}/${projectName}.md`;
      const contextMeta = [];
      if (action.work_context) contextMeta.push(`contexto_laboral: "${String(action.work_context).replace(/"/g, "'")}"`);
      if (action.education_context) contextMeta.push(`contexto_educativo: "${String(action.education_context).replace(/"/g, "'")}"`);
      const contextLinks = [];
      if (action.work_context) contextLinks.push(`- [[${WORK_ROOT}/${this.safeName(action.work_context)}/${this.safeName(action.work_context)} - Inicio|Trabajo · ${action.work_context}]]`);
      if (action.education_context) contextLinks.push(`- [[${EDUCATION_ROOT}/${this.safeName(action.education_context)}/${this.safeName(action.education_context)} - Inicio|Universidad · ${action.education_context}]]`);
      const body = [
        "---", `creado: ${this.todayIso()}`, "tipo: proyecto", "estado: activo", ...contextMeta, "---", "",
        `# ${projectName}`, "", "## Objetivo", "", String(action.content || "Proyecto creado por el asistente.").trim(), "",
        "## Tareas", "", "## Notas", "", "## Fechas", "",
        ...(contextLinks.length ? ["## Contexto", "", ...contextLinks, ""] : []),
      ].join("\n");
      file = await this.app.vault.create(path, body);
      await this.removeRedundantTitleForFile(file).catch(() => false);
      created = true;
    } else if (action.content) {
      await this.appendAgentNote(file, action.content);
    }
    const tasks = Array.isArray(action.tasks) ? action.tasks.slice(0, 12) : [];
    if (action.task) tasks.unshift(action.task);
    for (const task of tasks) await this.appendAgentTask(file, task);
    if (action.date && /^20\d{2}-\d{2}-\d{2}$/.test(action.date)) {
      await this.appendLineToSection(file, "## Fechas", `- ${action.date} — objetivo / seguimiento`);
      await this.addReminder({ text: `Continuar proyecto: ${projectName}`, date: action.date, linkPath: file.path });
    }
    return { file, created, projectName };
  }

  findExactAgentTarget(path) {
    const normalized = normalizePath(path || "");
    if (!normalized) return null;
    const file = this.app.vault.getAbstractFileByPath(normalized);
    return file instanceof TFile && file.extension === "md" ? file : null;
  }

  async agentPlannerContext(input) {
    const subjects = this.detectAcademicSubjects().map((subject) => ({
      name: subject.name,
      path: subject.folderPath,
      institution: subject.institution || "",
      period: subject.period || "",
    }));
    const candidates = this.agentCandidateNotes(input).map((file) => ({ title: file.basename, path: file.path }));
    const active = this.app.workspace.getActiveFile();
    return {
      today: this.todayIso(),
      profile_name: this.profileName(),
      education_contexts: this.detectEducationContexts(),
      work_contexts: this.detectWorkContexts(),
      active_education_context: this.settings.activeEducationContext || "",
      active_work_context: this.settings.activeWorkContext || "",
      subjects,
      candidates,
      active_path: active instanceof TFile ? active.path : "",
    };
  }

  normalizeAgentTaskItem(item) {
    if (typeof item === "string" || typeof item === "number") return String(item).trim();
    if (!item || typeof item !== "object") return "";
    for (const key of ["task", "text", "title", "content", "description", "name"]) {
      const value = item[key];
      if (typeof value === "string" || typeof value === "number") {
        const clean = String(value).trim();
        if (clean) return clean;
      }
    }
    return "";
  }

  parseProjectCommand(input) {
    const original = String(input || "").trim();
    const originalParts = original.split(/\s+con\s+tareas?\s+/i);
    const projectHead = (originalParts.shift() || "").trim();
    let rest = projectHead.replace(/^.*?\bproyecto\b\s*/i, "").trim();
    if (!rest || rest === projectHead) return null;
    const called = rest.match(/\bllamado\s+(.+)$/i);
    if (called && called[1]) rest = called[1].trim();
    else rest = rest.replace(/^(?:(?:llamado|para|de)\s+)?/i, "").trim();
    const projectName = this.safeName((rest || "Nuevo proyecto").replace(/[.;:]\s*$/, "").trim().slice(0, 100)) || "Nuevo proyecto";
    let tasksText = originalParts.join(" con tareas ").trim();
    const date = this.dateFromSpeech(original, false);
    const tasks = [];
    if (tasksText) {
      const chunks = tasksText.split(/\s*,\s*/).filter(Boolean);
      for (const chunk of chunks) {
        const sub = chunk.split(/\s+y\s+(?=(?:hacer|probar|migrar|revisar|validar|crear|configurar|actualizar|instalar|comprobar|subir|bajar|respaldar|verificar|corregir|preparar|documentar|enviar|consultar)\b)/i);
        for (const item of sub) {
          const clean = String(item || "").replace(/[.;]+$/g, "").trim();
          if (clean) tasks.push(clean);
        }
      }
    }
    const normalizedOriginal = this.normalizeSpeech(original);
    const namedWork = this.detectWorkContexts().find((context) => normalizedOriginal.includes(this.normalizeSpeech(context)));
    const namedEducation = this.detectEducationContexts().find((context) => normalizedOriginal.includes(this.normalizeSpeech(context)));
    const workContext = namedWork || (/\b(trabajo|empresa|cliente|laboral|oficina)\b/.test(normalizedOriginal) ? String(this.settings.activeWorkContext || "") : "");
    const educationContext = namedEducation || (/\b(universidad|instituto|academia|curso|estudio)\b/.test(normalizedOriginal) ? String(this.settings.activeEducationContext || "") : "");
    return {
      mode: "actions",
      actions: [{
        type: "create_project",
        project_name: projectName,
        title: projectName,
        content: "",
        tasks: tasks.slice(0, 12),
        date,
        work_context: workContext,
        education_context: educationContext,
      }],
    };
  }

  sanitizeAgentPlan(plan) {
    const allowedTypes = new Set(["append_note", "create_note", "create_project", "add_task", "create_reminder", "university_note"]);
    const allowedAreas = new Set(["inbox", "universidad", "trabajo", "proyectos", "conocimiento", "personal"]);
    const validSubjects = new Set(this.detectAcademicSubjects().map((subject) => subject.folderPath));
    const workContexts = new Map(this.detectWorkContexts().map((context) => [this.normalizeSpeech(context), context]));
    const educationContexts = new Map(this.detectEducationContexts().map((context) => [this.normalizeSpeech(context), context]));
    const clean = { mode: ["actions", "clarify", "answer"].includes(plan && plan.mode) ? plan.mode : "actions", reply: String(plan && plan.reply || "").slice(0, 1200), actions: [] };
    const actions = Array.isArray(plan && plan.actions) ? plan.actions.slice(0, 5) : [];
    for (const raw of actions) {
      if (!raw || !allowedTypes.has(raw.type)) continue;
      const target = this.findExactAgentTarget(raw.target_path);
      const action = {
        type: raw.type,
        title: String(raw.title || "").slice(0, 120),
        content: String(raw.content || "").slice(0, 12000),
        target_path: target ? target.path : "",
        area: allowedAreas.has(raw.area) ? raw.area : "inbox",
        subject_path: validSubjects.has(raw.subject_path) ? raw.subject_path : "",
        work_context: workContexts.get(this.normalizeSpeech(raw.work_context || "")) || "",
        education_context: educationContexts.get(this.normalizeSpeech(raw.education_context || "")) || "",
        project_name: String(raw.project_name || "").slice(0, 120),
        task: String(raw.task || "").slice(0, 800),
        tasks: Array.isArray(raw.tasks) ? raw.tasks.map((item) => this.normalizeAgentTaskItem(item).slice(0, 800)).filter(Boolean).slice(0, 12) : [],
        date: /^20\d{2}-\d{2}-\d{2}$/.test(String(raw.date || "")) ? String(raw.date) : "",
        reminder_text: String(raw.reminder_text || "").slice(0, 800),
      };
      clean.actions.push(action);
    }
    if (clean.mode === "actions" && !clean.actions.length) clean.mode = clean.reply ? "answer" : "clarify";
    return clean;
  }

  heuristicAgentPlan(input) {
    const original = String(input || "").trim();
    const text = this.normalizeSpeech(original);
    if (this.isPendingQuery(text)) return { mode: "answer", reply: "", actions: [] };
    const subjects = this.detectAcademicSubjects();
    const subject = subjects.find((item) => this.subjectMatchesText(item, original));
    const candidates = this.agentCandidateNotes(original, 5);
    const target = candidates[0] || null;
    const namedWorkContext = this.detectWorkContexts().find((context) => text.includes(this.normalizeSpeech(context))) || "";
    const namedEducationContext = this.detectEducationContexts().find((context) => text.includes(this.normalizeSpeech(context))) || "";
    const strip = () => original.replace(/^(guarda|guardar|anota|anotar)\s+esta\s+idea\s*:?\s*/i, "").replace(/^(idea\s*:|anota|anotar|guarda|guardar|agrega|agregar|añade|anade|crear nota|crea una nota|nota:|pon esto|apunta)\s*:?\s*/i, "").trim();
    if (/^(recuerdame|recordarme|crear recordatorio|crea un recordatorio)/.test(text)) {
      const explicitDate = this.dateFromSpeech(original, false);
      const date = explicitDate || this.todayIso();
      let content = original
        .replace(/^(recu[eé]rdame|recordarme|crear recordatorio|crea un recordatorio)\s*/i, "")
        .replace(/\b(hoy|mañana|pasado mañana|el?\s*(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)|la próxima semana|en una semana|en\s+\d+\s+d[ií]as?)\b/ig, "")
        .trim()
        .replace(/^(que\s+)?(tengo\s+que|debo|necesito)\s+/i, "")
        .trim();
      if (!content) content = "Revisar pendiente indicado al asistente";
      const actions = [];
      if (target) actions.push({ type: "add_task", task: content, content, target_path: target.path });
      else if (subject) actions.push({ type: "add_task", task: content, content, subject_path: subject.folderPath });
      actions.push({ type: "create_reminder", content, reminder_text: content, date, target_path: target ? target.path : "" });
      return { mode: "actions", actions };
    }
    if (/(crea|crear|nuevo|nueva)\s+(un\s+)?proyecto/.test(text)) {
      return this.parseProjectCommand(original) || { mode: "actions", actions: [{ type: "create_project", project_name: "Nuevo proyecto", title: "Nuevo proyecto", content: "", date: this.dateFromSpeech(original, false) }] };
    }
    if (/\b(tarea|pendiente)\b/.test(text) && /^(agrega|añade|anade|crea|crear|pon|anota)/.test(text)) {
      const task = strip().replace(/^(una\s+)?(tarea|pendiente)\s*/i, "").trim();
      return { mode: "actions", actions: [{ type: "add_task", task, content: task, target_path: target ? target.path : "", subject_path: subject ? subject.folderPath : "", work_context: namedWorkContext, education_context: namedEducationContext }] };
    }
    if (/^(anota|anotar|guarda|guardar|agrega|agregar|añade|anade|crear nota|crea una nota|nota:|pon esto|apunta)/.test(text)) {
      let content = strip();
      if (target && /\b(para|en|a)\b/.test(text)) {
        const labels = [target.basename, namedWorkContext, namedEducationContext].filter(Boolean);
        for (const label of labels) {
          const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          content = content.replace(new RegExp(`^(para|en|a)\\s+${escaped}\\s+(que\\s+)?`, "i"), "").trim();
        }
        return { mode: "actions", actions: [{ type: "append_note", content: content || strip(), target_path: target.path }] };
      }
      if (subject) return { mode: "actions", actions: [{ type: "university_note", content, subject_path: subject.folderPath, title: `${subject.name} - Apuntes` }] };
      const activeWorkNorm = this.normalizeSpeech(this.settings.activeWorkContext || "");
      const activeEducationNorm = this.normalizeSpeech(this.settings.activeEducationContext || "");
      const isWork = Boolean(namedWorkContext) || /\b(trabajo|oficina|empresa|cliente|servidor|sap|power bi)\b/.test(text) || (activeWorkNorm && text.includes(activeWorkNorm));
      const isEducation = Boolean(namedEducationContext) || /\b(universidad|instituto|academia|clase|curso|estudio)\b/.test(text) || (activeEducationNorm && text.includes(activeEducationNorm));
      const area = isEducation ? "universidad" : isWork ? "trabajo" : /\b(proyecto|app|sistema|webapp)\b/.test(text) ? "proyectos" : /\b(aprendi|concepto|conocimiento|referencia)\b/.test(text) ? "conocimiento" : "inbox";
      return { mode: "actions", actions: [{
        type: "create_note",
        content,
        title: this.agentTitleFromContent(content),
        area,
        work_context: namedWorkContext || (isWork ? String(this.settings.activeWorkContext || "") : ""),
        education_context: namedEducationContext || (isEducation ? String(this.settings.activeEducationContext || "") : ""),
      }] };
    }
    return { mode: "answer", reply: "", actions: [] };
  }

  async planAgentActions(input) {
    const fallback = this.heuristicAgentPlan(input);
    const deterministic = this.normalizeSpeech(input);
    // Las intenciones inequívocas se resuelven por código antes de consultar a la IA.
    // Evita que "recuérdame" termine clasificado accidentalmente como una nota.
    if (/^(recuerdame|recordarme|crear recordatorio|crea un recordatorio)/.test(deterministic)) {
      return this.sanitizeAgentPlan(fallback);
    }
    if (/(crea|crear|nuevo|nueva)\s+(un\s+)?proyecto/.test(deterministic)) {
      return this.sanitizeAgentPlan(this.parseProjectCommand(input) || fallback);
    }
    const aiPlugin = (this.app.plugins && typeof this.app.plugins.getPlugin === "function")
      ? this.app.plugins.getPlugin("vault-ai")
      : (this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["vault-ai"] : null);

    if (!aiPlugin && !Platform.isDesktopApp) return this.sanitizeAgentPlan(fallback);
    try {
      const context = await this.agentPlannerContext(input);
      const plannerSystem = [
        "Eres el planificador de acciones del sistema dentro de Obsidian.",
        "Devuelve EXCLUSIVAMENTE JSON valido. Nunca inventes rutas.",
        "Tu trabajo es convertir la orden del usuario en acciones seguras y concretas.",
        "Tipos permitidos: append_note, create_note, create_project, add_task, create_reminder, university_note.",
        "Usa append_note cuando ya existe una nota/proyecto candidato claramente relacionado; target_path debe copiarse EXACTAMENTE de CANDIDATOS.",
        "Usa university_note cuando el texto corresponde a una materia; subject_path debe copiarse EXACTAMENTE de MATERIAS.",
        "Usa create_project para un proyecto nuevo y extrae sus tareas en tasks. Si hay fecha clara, usa YYYY-MM-DD en date.",
        "Usa add_task para un pendiente y enlazalo a target_path o subject_path cuando sea claro.",
        "Usa create_reminder solo si existe una fecha clara. Si falta una fecha necesaria, mode=clarify y formula una sola pregunta.",
        "Usa create_note para informacion nueva y area en: inbox, universidad, trabajo, proyectos, conocimiento, personal.",
        "Si area=trabajo y la orden menciona un CONTEXTO LABORAL existente, copia su nombre EXACTO en work_context; si no, puede quedar vacio y el sistema usará el activo.",
        "Si area=universidad y no hay una materia concreta, usa education_context copiando EXACTAMENTE un CONTEXTO EDUCATIVO existente; si hay materia, prefiere university_note.",
        "Si creas un proyecto relacionado con trabajo o estudio, incluye work_context o education_context cuando sea claro.",
        "No asumas nombres de empresas, universidades, países o monedas: usa solo los CONTEXTOS y MATERIAS proporcionados.",
        "No propongas borrar, renombrar o mover archivos. Nunca modifiques finanzas mediante este planificador.",
        "Si no se solicita guardar/modificar nada, mode=answer y actions=[]; reply puede quedar vacio para que responda el asistente conversacional.",
        "Esquema: {\"mode\":\"actions|clarify|answer\",\"reply\":\"\",\"actions\":[{\"type\":\"...\",\"title\":\"\",\"content\":\"\",\"target_path\":\"\",\"area\":\"inbox\",\"subject_path\":\"\",\"work_context\":\"\",\"education_context\":\"\",\"project_name\":\"\",\"task\":\"\",\"tasks\":[],\"date\":\"\",\"reminder_text\":\"\"}]}",
      ].join("\n");
      const plannerPrompt = `HOY: ${context.today}\nUSUARIO: ${context.profile_name}\nCONTEXTO EDUCATIVO ACTIVO: ${context.active_education_context || "ninguno"}\nCONTEXTOS EDUCATIVOS: ${JSON.stringify(context.education_contexts)}\nCONTEXTO LABORAL ACTIVO: ${context.active_work_context || "ninguno"}\nCONTEXTOS LABORALES: ${JSON.stringify(context.work_contexts)}\nARCHIVO ACTIVO: ${context.active_path || "ninguno"}\nMATERIAS: ${JSON.stringify(context.subjects)}\nCANDIDATOS: ${JSON.stringify(context.candidates)}\nORDEN: ${input}`;

      let rawResponse = "";
      if (aiPlugin && typeof aiPlugin.callAI === "function") {
        rawResponse = await aiPlugin.callAI(plannerPrompt, plannerSystem);
      } else if (Platform.isDesktopApp) {
        const response = await requestUrl({
          url: "http://127.0.0.1:11434/api/generate",
          method: "POST",
          contentType: "application/json",
          body: JSON.stringify({
            model: this.settings.model || "llama3.2",
            stream: false,
            format: "json",
            system: plannerSystem,
            prompt: plannerPrompt,
            options: { temperature: 0.05, num_ctx: 8192 },
          }),
          throw: false,
        });
        if (response.status === 200 && response.json && response.json.response) {
          rawResponse = response.json.response;
        }
      }

      if (!rawResponse) throw new Error("sin respuesta JSON");
      const raw = String(rawResponse).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(raw);
      const clean = this.sanitizeAgentPlan(parsed);
      if (clean.mode === "actions" && clean.actions.length) return clean;
      if (clean.mode === "clarify" && clean.reply) return clean;
      return this.sanitizeAgentPlan(fallback);
    } catch (_) {
      return this.sanitizeAgentPlan(fallback);
    }
  }

  async executeAgentPlan(plan, original) {
    const clean = this.sanitizeAgentPlan(plan);
    if (clean.mode === "clarify") return clean.reply || "Necesito un dato mas antes de guardar eso.";
    if (clean.mode !== "actions" || !clean.actions.length) return "";
    const receipts = [];
    for (const action of clean.actions) {
      try {
        if (action.type === "append_note") {
          const file = this.findExactAgentTarget(action.target_path);
          if (!file) throw new Error("no encontre la nota destino");
          await this.appendAgentNote(file, action.content || original);
          receipts.push(`✓ Agregue la informacion a ${file.basename}.`);
        } else if (action.type === "university_note") {
          const saved = await this.saveUniversityAgentNote(action.subject_path, action.content || original, action.title);
          receipts.push(`✓ Guarde el apunte en ${saved.subject.name} · ${saved.file.basename}.`);
        } else if (action.type === "create_project") {
          const saved = await this.createOrUpdateProject(action);
          receipts.push(`✓ ${saved.created ? "Cree" : "Actualice"} el proyecto ${saved.projectName}${action.tasks.length ? ` con ${action.tasks.length} tarea(s)` : ""}.`);
        } else if (action.type === "add_task") {
          let file = this.findExactAgentTarget(action.target_path);
          if (!file && action.subject_path) {
            const subject = this.detectAcademicSubjects().find((item) => item.folderPath === action.subject_path);
            file = this.findSubjectNote(subject, "tareas");
            if (!file && subject) {
              const path = await this.uniquePath(`${subject.folderPath}/${subject.name} - Tareas.md`);
              file = await this.app.vault.create(path, `# ${subject.name} - Tareas\n\n## Tareas\n\n`);
              await this.removeRedundantTitleForFile(file).catch(() => false);
            }
          }
          if (!file && action.work_context) {
            const safe = this.safeName(action.work_context);
            const path = `${WORK_ROOT}/${safe}/${safe} - Inicio.md`;
            file = await this.ensureFile(path, `# ${safe}\n\n## Pendientes\n\n## Notas\n\n`);
          }
          if (!file && action.education_context) {
            const safe = this.safeName(action.education_context);
            const path = `${EDUCATION_ROOT}/${safe}/${safe} - Inicio.md`;
            file = await this.ensureFile(path, `# ${safe}\n\n## Pendientes\n\n## Notas\n\n`);
          }
          if (!file) file = await this.ensureFile("00 - Inbox/Pendientes.md", "# Pendientes\n\n## Tareas\n\n");
          await this.appendAgentTask(file, action.task || action.content || original);
          receipts.push(`✓ Agregue la tarea en ${file.basename}.`);
        } else if (action.type === "create_reminder") {
          if (!action.date) throw new Error("falta la fecha del recordatorio");
          const text = action.reminder_text || action.content || original;
          const savedReminder = await this.addReminder({ text, date: action.date, linkPath: action.target_path || "" });
          const when = action.date === this.todayIso() ? `hoy (${action.date})` : action.date;
          receipts.push(savedReminder && savedReminder.duplicate ? `✓ El recordatorio para ${when} ya existía; no lo dupliqué.` : `✓ Recordatorio guardado para ${when}.`);
        } else if (action.type === "create_note") {
          const file = await this.createClassifiedAgentNote({
            title: action.title,
            content: action.content || original,
            area: action.area,
            work_context: action.work_context,
            education_context: action.education_context,
          });
          const contextLabel = action.work_context || action.education_context || "";
          receipts.push(`✓ Cree ${file.basename} y la clasifique en ${action.area}${contextLabel ? ` · ${contextLabel}` : ""}.`);
        }
      } catch (error) {
        receipts.push(`⚠ No pude completar una accion: ${error.message}.`);
      }
    }
    this.invalidateSearchIndex();
    this.scheduleRefresh();
    if (receipts.some((line) => line.startsWith("✓"))) {
      await this.appendDailyActivity(`🤖 Asistente proceso: ${String(original).replace(/[\r\n]+/g, " ").slice(0, 180)}`).catch(() => {});
    }
    return receipts.join("\n");
  }

  looksLikeAgentAction(value) {
    const text = this.normalizeSpeech(value);
    if (this.isPendingQuery(text)) return "";
    if (/(borra|borrar|elimina|eliminar|vaciar|mueve todo|mover todo|renombra|renombrar)/.test(text)) return "destructive";
    return /\b(anota|anotar|guarda|guardar|agrega|agregar|añade|anade|crea|crear|registra|registrar|actualiza|actualizar|proyecto|tarea|pendiente|recuerdame|recordarme|recordatorio|apunta|pon|clasifica|clasificar|archiva|archivar)\b/.test(text) ? "action" : "";
  }

  async askAiAssistant(query) {
    try {
      let activeNoteContext = "";
      try {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile instanceof TFile && activeFile.extension.toLowerCase() === "md") {
          const noteText = (await this.app.vault.read(activeFile)).trim();
          if (noteText) {
            activeNoteContext = `NOTA ACTIVA ACTUAL EN PANTALLA ("${activeFile.basename}"):\n${noteText.slice(0, 18000)}\n\n`;
          }
        }
      } catch (_) {}

      const context = await this.relevantContext(query);
      const status = await this.systemStatus();
      const system = `Eres el asistente personal de ${this.profileName()} dentro de Obsidian. Ayuda a convertir información en decisiones y siguientes acciones. Responde en español, claro y breve. Usa solamente el contexto proporcionado; si falta información, dilo y formula una sola pregunta concreta. No inventes fechas, saldos ni hechos. Nunca afirmes haber guardado o modificado algo si la aplicación no confirmó esa acción.`;
      const prompt = `${activeNoteContext}ESTADO ACTUAL:\n${status}\n\nNOTAS RELACIONADAS:\n${context || "No se encontraron notas relacionadas."}\n\nUSUARIO PREGUNTA:\n${query}`;

      const aiPlugin = (this.app.plugins && typeof this.app.plugins.getPlugin === "function")
        ? this.app.plugins.getPlugin("vault-ai")
        : (this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["vault-ai"] : null);

      if (aiPlugin && typeof aiPlugin.callAI === "function") {
        return (await aiPlugin.callAI(prompt, system)).trim();
      }

      if (!Platform.isDesktopApp) {
        return "Para una conversación libre con IA en móvil, activa el complemento 'IA de bóveda' con Google Gemini.";
      }

      const response = await requestUrl({
        url: "http://127.0.0.1:11434/api/generate",
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          model: this.settings.model || "llama3.2", stream: false,
          system,
          prompt,
          options: { temperature: 0.2, num_ctx: 8192 },
        }),
        throw: false,
      });
      if (response.status !== 200 || !response.json || !response.json.response) throw new Error("La IA no respondió");
      return response.json.response.trim();
    } catch (error) {
      return `No pude comunicarme con la IA (${error.message}). Aún puedes pedirme crear notas, registrar dinero, crear recordatorios o mostrar tus pendientes.`;
    }
  }

  async handleAssistant(input, modal) {
    const original = String(input || "").trim();
    const text = this.normalizeSpeech(original);
    if (!text) return "Dime que necesitas.";

    if (/(plan de estudio|modo estudio|preparar examen|aprender con (mis )?(notas|libros|documentos))/.test(text)) {
      const result = await this.refreshAutomaticStudySystem(true);
      const names = result && result.ranked ? result.ranked.map((item) => item.subject.name).join(", ") : "";
      return names ? `Actualice el estudio automatico con todas las materias detectadas: ${names}.` : "No encontre materias para actualizar.";
    }
    if (/^(organiza mi dia|organizar mi dia|prioriza|que hago primero|hazme un plan|plan para hoy)/.test(text)) return this.systemPlan();
    if (this.isPendingQuery(text) || /^(que tengo|como voy|resumen|estado|que hay para hoy|mis pendientes)/.test(text)) return this.systemStatus();

    const destinations = [
      [/abre? (la |mi )?universidad|ir a universidad/, this.getEducationHomePath(), this.educationAreaLabel()],
      [/abre? (el |mi )?trabajo|ir a trabajo/, this.getWorkHomePath(), this.workAreaLabel()],
      [/abre? (los |mis )?proyectos|ir a proyectos/, "04 - Proyectos/Proyectos - Inicio.md", "Proyectos"],
      [/abre? (las |mis )?finanzas|ir a finanzas/, "06 - Personal/Finanzas/Control personal/Mi control financiero - Inicio.md", "Finanzas"],
      [/abre? (los |mis )?recursos|ir a recursos/, "07 - Recursos/Recursos - Inicio.md", "Recursos"],
    ];
    for (const [pattern, path, name] of destinations) {
      if (pattern.test(text)) { modal.close(); await this.openPath(path); return `Abriendo ${name}.`; }
    }

    const amountMatch = original.match(/(\d+(?:[.,]\d{1,2})?)/i);
    const isDebt = /(deuda|cuota|prestamo|préstamo|credito|crédito)/.test(text);
    let movementType = "";
    if (/(gaste|compre|pague)/.test(text)) movementType = isDebt ? "pago_deuda" : "gasto";
    else if (/(recibi|ingrese|me pagaron|cobre)/.test(text)) movementType = "ingreso";
    else if (/(ahorre|guardar para ahorro)/.test(text)) movementType = "ahorro";
    if (movementType && amountMatch) {
      const description = original.replace(amountMatch[0], "").replace(/^(gast[eé]|compr[eé]|pagu[eé]|recib[ií]|ingres[eé]|me pagaron|cobr[eé]|ahorr[eé])\s*/i, "").replace(/^en\s+/i, "").trim();
      modal.close();
      new MovementModal(this.app, this, { type: movementType, amount: amountMatch[1], description: description || this.labelMovement(movementType), category: isDebt ? "Deudas y cuotas" : "Otros" }).open();
      return "Prepare el movimiento para que lo confirmes. Los movimientos financieros siguen requiriendo confirmacion.";
    }

    const actionMode = this.looksLikeAgentAction(original);
    if (actionMode === "destructive") {
      return "Por seguridad no borro, renombro ni muevo informacion de forma automatica. Puedo ayudarte a localizarla y preparar el cambio, pero una accion destructiva debe confirmarse manualmente.";
    }
    if (actionMode === "action") {
      const plan = await this.planAgentActions(original);
      if (plan.mode === "clarify") return plan.reply || "Necesito un dato mas antes de guardar eso.";
      const receipt = await this.executeAgentPlan(plan, original);
      if (receipt) return receipt;
    }

    return this.askAiAssistant(original);
  }

  runLocalSupport() {
    const active = this.app.workspace.getActiveFile();
    if (!(active instanceof TFile) || active.extension !== "md") {
      new Notice("Abra primero la nota que desea revisar.");
      return;
    }
    const ok = this.app.commands.executeCommandById("vault-ai:sugerir-apoyo-nota-activa");
    if (!ok) new Notice("El apoyo de Ollama estará disponible al abrir esta bóveda en la PC.", 7000);
  }
};

class ControlCenterView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Centro de control"; }
  getIcon() { return "layout-dashboard"; }
  async onOpen() { await this.render(); }

  renderControlTile(parent, icon, title, subtitle, onClick, gradientClass = "is-blue") {
    const tile = parent.createEl("button", { cls: `sistema-apple-tile ${gradientClass}` });
    const iconWrap = tile.createEl("span", { cls: "sistema-tile-icon-wrap" });
    iconWrap.createEl("span", { cls: "sistema-tile-icon", text: icon });
    const copy = tile.createEl("div", { cls: "sistema-tile-copy" });
    copy.createEl("strong", { text: title });
    copy.createEl("small", { text: subtitle });
    tile.addEventListener("click", onClick);
    return tile;
  }

  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("sistema-dashboard-container");
    const root = container.createEl("div", { cls: "sistema-dashboard" });
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    const profile = this.plugin.profileName() || "Luis";

    // ------------------------------------------------------------------------
    // 1. APPLE DYNAMIC STATUS BAR & HERO
    // ------------------------------------------------------------------------
    const topBar = root.createEl("header", { cls: "sistema-dynamic-bar" });

    // Left: Calendar Date Badge & Greeting
    const identity = topBar.createEl("div", { cls: "sistema-apple-identity" });
    const calBadge = identity.createEl("div", { cls: "sistema-apple-calendar-badge" });
    const monthName = now.toLocaleDateString("es", { month: "short" }).toUpperCase().replace(".", "").slice(0, 3);
    calBadge.createEl("span", { cls: "cal-badge-month", text: monthName });
    calBadge.createEl("span", { cls: "cal-badge-day", text: String(now.getDate()) });

    const identityCopy = identity.createEl("div", { cls: "sistema-apple-identity-copy" });
    const fullDate = now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
    identityCopy.createEl("span", { cls: "sistema-apple-eyebrow", text: fullDate.toUpperCase() });
    identityCopy.createEl("h1", { cls: "sistema-apple-title", text: `${greeting}, ${profile}` });

    // Right: Apple Dynamic Island Pill & Quick Toggles
    const barTools = topBar.createEl("div", { cls: "sistema-apple-bar-tools" });

    // Dynamic Island AI status pill
    const dynamicPill = barTools.createEl("button", { cls: "sistema-dynamic-pill", attr: { "aria-label": "Estado de Apple Intelligence" } });
    const pillGlow = dynamicPill.createEl("span", { cls: "sistema-pill-dot" });
    const pillText = dynamicPill.createEl("span", { cls: "sistema-pill-text", text: "Gemini IA listo" });
    dynamicPill.addEventListener("click", async () => {
      pillText.setText("Verificando…");
      const status = await this.plugin.getAiStatus();
      pillText.setText(status.label);
      pillGlow.className = `sistema-pill-dot is-${status.state}`;
    });
    this.plugin.getAiStatus().then((status) => {
      if (status && status.label) {
        pillText.setText(status.label);
        pillGlow.className = `sistema-pill-dot is-${status.state}`;
      }
    });

    // Theme toggle
    const themeBtn = barTools.createEl("button", { cls: "sistema-apple-circle-btn", text: "◐", attr: { "title": `Tema: ${this.plugin.appearanceLabel()}` } });
    themeBtn.addEventListener("click", (event) => {
      const menu = new Menu();
      for (const [value, title, icon] of [["auto", "Automático (Sistema)", "monitor"], ["dark", "Modo Oscuro", "moon"], ["light", "Modo Claro", "sun"]]) {
        menu.addItem((item) => item.setTitle(title).setIcon(icon).setChecked(this.plugin.settings.appearance === value).onClick(() => this.plugin.setAppearance(value)));
      }
      menu.showAtMouseEvent(event);
    });

    // Refresh button
    const refreshBtn = barTools.createEl("button", { cls: "sistema-apple-circle-btn", text: "↻", attr: { "title": "Actualizar" } });
    refreshBtn.addEventListener("click", () => this.render());

    // ------------------------------------------------------------------------
    // 2. APPLE INTELLIGENCE (THE PULSATING NEURAL HERO)
    // ------------------------------------------------------------------------
    const aiHero = root.createEl("section", { cls: "sistema-apple-intelligence-hero" });
    const aiHeader = aiHero.createEl("div", { cls: "sistema-ai-hero-header" });

    const siriOrb = aiHeader.createEl("div", { cls: "sistema-siri-orb-wrapper" });
    siriOrb.createEl("div", { cls: "sistema-siri-orb-glow" });
    const siriCore = siriOrb.createEl("div", { cls: "sistema-siri-orb-core" });
    siriCore.createEl("span", { text: "✨" });

    const aiCopy = aiHeader.createEl("div", { cls: "sistema-ai-hero-copy" });
    aiCopy.createEl("h2", { text: "¿En qué puedo ayudarte hoy?" });
    aiCopy.createEl("p", { text: "Apple Intelligence para organizar tu conocimiento, resumir lecturas y planificar tu día." });

    // Apple Spotlight-Style Prompt Capsule
    const promptCapsule = aiHero.createEl("div", { cls: "sistema-ai-prompt-capsule" });
    promptCapsule.createEl("span", { cls: "sistema-ai-capsule-icon", text: "✨" });
    const promptInput = promptCapsule.createEl("input", {
      cls: "sistema-ai-capsule-input",
      attr: {
        type: "text",
        placeholder: "Pídele a Gemini resumir notas, crear tareas o responder dudas…",
        autocomplete: "off",
        spellcheck: "false",
      },
    });
    const promptSend = promptCapsule.createEl("button", { cls: "sistema-ai-capsule-send", text: "↑", attr: { "aria-label": "Enviar a Gemini" } });

    const sendToAi = (text) => {
      const q = String(text || "").trim();
      const modal = new AsistenteModal(this.app, this.plugin);
      modal.open();
      if (q && typeof modal.sendSystemMessage === "function") {
        window.setTimeout(() => modal.sendSystemMessage(q), 120);
      }
    };

    promptSend.addEventListener("click", () => {
      const q = promptInput.value.trim();
      sendToAi(q);
      promptInput.value = "";
    });
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = promptInput.value.trim();
        sendToAi(q);
        promptInput.value = "";
      }
    });

    // Intelligent Action Chips (Siri Quick Prompts)
    const chipsCarousel = aiHero.createEl("div", { cls: "sistema-ai-chips-carousel" });
    const quickPrompts = [
      { label: "✨ Resumir mi día", query: "Hazme un resumen ejecutivo de mis notas y pendientes de hoy." },
      { label: "✍️ Nota rápida", action: () => new QuickNoteModal(this.app, this.plugin).open() },
      { label: "📚 Modo estudio", action: () => this.plugin.refreshAutomaticStudySystem(true) },
      { label: "💳 Balance financiero", query: "Revisa mis movimientos del mes y dame un balance financiero conciso." },
      { label: "🎯 Prioridades de hoy", query: "¿Cuáles son las prioridades más importantes que debería atender hoy?" },
      { label: "💬 Abrir Asistente IA", action: () => new AsistenteModal(this.app, this.plugin).open() },
    ];
    for (const item of quickPrompts) {
      const chip = chipsCarousel.createEl("button", { cls: "sistema-ai-suggestion-chip", text: item.label });
      chip.addEventListener("click", () => {
        if (item.action) item.action();
        else if (item.query) sendToAi(item.query);
      });
    }

    // ------------------------------------------------------------------------
    // 3. SPOTLIGHT GLOBAL SEARCH (macOS & iOS SEARCH EXPERIENCE)
    // ------------------------------------------------------------------------
    const spotlightSection = root.createEl("section", { cls: "sistema-spotlight-section" });
    const spotlightBar = spotlightSection.createEl("div", { cls: "sistema-spotlight-bar" });
    spotlightBar.createEl("span", { cls: "sistema-spotlight-icon", text: "⌕" });
    const searchInput = spotlightBar.createEl("input", {
      cls: "sistema-spotlight-input",
      attr: {
        type: "search",
        placeholder: "Spotlight: buscar notas, materias, proyectos, finanzas, tareas…",
        autocomplete: "off",
        spellcheck: "false",
      },
    });
    const clearBtn = spotlightBar.createEl("button", { cls: "sistema-spotlight-clear", text: "×", attr: { "aria-label": "Limpiar" } });
    clearBtn.style.display = "none";
    const kbd = spotlightBar.createEl("kbd", { cls: "sistema-spotlight-kbd", text: Platform.isMacOS || Platform.isIosApp ? "⌘K" : "Ctrl+K" });
    kbd.addEventListener("click", () => searchInput.focus());

    const searchDropdown = spotlightSection.createEl("div", { cls: "sistema-spotlight-dropdown" });
    searchDropdown.style.display = "none";
    let searchDebounce = null;
    let firstResult = null;

    const closeSpotlight = () => {
      searchDropdown.empty();
      searchDropdown.style.display = "none";
      firstResult = null;
    };

    const runSpotlight = async () => {
      const query = searchInput.value.trim();
      clearBtn.style.display = query ? "" : "none";
      if (!query) { closeSpotlight(); return; }
      searchDropdown.style.display = "";
      searchDropdown.empty();
      searchDropdown.createEl("div", { cls: "sistema-spotlight-loading", text: "Buscando en la bóveda…" });
      const matches = await this.plugin.searchVault(query, 6);
      if (searchInput.value.trim() !== query) return;
      searchDropdown.empty();
      firstResult = matches[0] || null;
      if (!matches.length) {
        searchDropdown.createEl("div", { cls: "sistema-spotlight-empty", text: "Sin coincidencias en la bóveda." });
        return;
      }
      for (const item of matches) {
        const row = searchDropdown.createEl("button", { cls: "sistema-spotlight-row" });
        row.createEl("span", { cls: "sistema-spotlight-type-icon", text: item.file.extension === "md" ? "📄" : "📎" });
        const textWrap = row.createEl("div", { cls: "sistema-spotlight-row-copy" });
        textWrap.createEl("strong", { text: item.file.basename });
        textWrap.createEl("small", { text: item.file.parent ? item.file.parent.path : "Bóveda" });
        row.createEl("span", { cls: "sistema-spotlight-chevron", text: "›" });
        row.addEventListener("click", async () => {
          await this.app.workspace.getLeaf(false).openFile(item.file);
          closeSpotlight();
        });
      }
    };

    searchInput.addEventListener("input", () => {
      if (searchDebounce) window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(runSpotlight, 160);
    });
    searchInput.addEventListener("keydown", async (e) => {
      if (e.key === "Escape") {
        searchInput.value = "";
        clearBtn.style.display = "none";
        closeSpotlight();
        searchInput.blur();
      } else if (e.key === "Enter" && firstResult) {
        e.preventDefault();
        await this.app.workspace.getLeaf(false).openFile(firstResult.file);
        closeSpotlight();
      }
    });
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearBtn.style.display = "none";
      closeSpotlight();
      searchInput.focus();
    });

    // ------------------------------------------------------------------------
    // 4. iOS 18 CONTROL CENTER: TACTILE SQUIRCLE TILES
    // ------------------------------------------------------------------------
    const ccSection = root.createEl("section", { cls: "sistema-cc-grid-section" });
    const ccTitle = ccSection.createEl("div", { cls: "sistema-apple-section-header" });
    ccTitle.createEl("span", { cls: "sistema-apple-eyebrow", text: "CONTROL CENTER" });
    ccTitle.createEl("h2", { text: "Acciones Rápidas" });

    const ccGrid = ccSection.createEl("div", { cls: "sistema-cc-grid" });
    this.renderControlTile(ccGrid, "✍️", "Nueva Nota", "Capturar idea al instante", () => new QuickNoteModal(this.app, this.plugin).open(), "is-amber");
    this.renderControlTile(ccGrid, "📅", "Mi Día", "Nota diaria y bitácora", () => this.plugin.openToday(), "is-crimson");
    this.renderControlTile(ccGrid, "📚", "Modo Estudio", "Planes de estudio automáticos", () => this.plugin.refreshAutomaticStudySystem(true), "is-blue");
    this.renderControlTile(ccGrid, "💳", "Finanzas", "Registrar ingreso o gasto", () => new MovementModal(this.app, this.plugin).open(), "is-emerald");
    this.renderControlTile(ccGrid, "⏰", "Recordatorio", "Pendiente con fecha límite", () => new ReminderModal(this.app, this.plugin).open(), "is-coral");
    this.renderControlTile(ccGrid, "📥", "Por Clasificar", "Bandeja de recursos nuevos", () => this.plugin.openPath("07 - Recursos/Recursos - Inicio.md"), "is-indigo");

    // ------------------------------------------------------------------------
    // 5. APPLE BENTO GRID: LIVE INTERACTIVE WIDGETS
    // ------------------------------------------------------------------------
    const bentoSection = root.createEl("section", { cls: "sistema-bento-section" });
    const bentoHeader = bentoSection.createEl("div", { cls: "sistema-apple-section-header" });
    bentoHeader.createEl("span", { cls: "sistema-apple-eyebrow", text: "RESUMEN EN VIVO" });
    bentoHeader.createEl("h2", { text: "Tu Bóveda al Instante" });

    const bentoGrid = bentoSection.createEl("div", { cls: "sistema-bento-grid" });

    // WIDGET 1: MI DÍA (iOS StandBy / Calendar Style)
    const todayFile = this.plugin.getTodayFile();
    const dayWidget = bentoGrid.createEl("div", { cls: "sistema-bento-widget sistema-widget-day" });
    const dayTop = dayWidget.createEl("div", { cls: "sistema-widget-top" });
    dayTop.createEl("span", { cls: "sistema-widget-label", text: "MI DÍA" });
    dayTop.createEl("span", { cls: `sistema-widget-badge ${todayFile ? "is-live" : "is-pending"}`, text: todayFile ? "● Al día" : "○ Pendiente" });

    const dayBody = dayWidget.createEl("div", { cls: "sistema-widget-day-body" });
    if (todayFile) {
      dayBody.createEl("strong", { text: todayFile.basename });
      dayBody.createEl("p", { text: "Tienes actividad registrada para hoy. Sigue plasmando ideas y avances." });
      const openBtn = dayWidget.createEl("button", { cls: "sistema-apple-btn is-primary", text: "Continuar nota de hoy ›" });
      openBtn.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(todayFile));
    } else {
      dayBody.createEl("strong", { text: "Sin registro todavía hoy" });
      dayBody.createEl("p", { text: "No se crean notas vacías. Guarda cualquier pensamiento o apunte del día." });
      const capBtn = dayWidget.createEl("button", { cls: "sistema-apple-btn is-primary", text: "+ Registrar mi día" });
      capBtn.addEventListener("click", () => new DailyCaptureModal(this.app, this.plugin).open());
    }

    // WIDGET 2: APPLE CARD / WALLET (Financial Overview)
    const month = this.plugin.currentMonth();
    const finance = await this.plugin.getFinanceSummary(month);
    const walletWidget = bentoGrid.createEl("div", { cls: "sistema-bento-widget sistema-widget-wallet" });
    const walletTop = walletWidget.createEl("div", { cls: "sistema-widget-top" });
    walletTop.createEl("span", { cls: "sistema-widget-label", text: "APPLE WALLET · FINANZAS" });
    const walletLink = walletTop.createEl("button", { cls: "sistema-widget-link", text: "Abrir ›" });
    walletLink.addEventListener("click", () => this.plugin.openPath("06 - Personal/Finanzas/Control personal/Mi control financiero - Inicio.md"));

    const walletCard = walletWidget.createEl("div", { cls: "sistema-apple-card-surface" });
    const balanceWrap = walletCard.createEl("div", { cls: "sistema-wallet-balance-wrap" });
    balanceWrap.createEl("span", { cls: "sistema-wallet-balance-label", text: "Saldo disponible este mes" });
    balanceWrap.createEl("strong", { cls: "sistema-wallet-balance-amount", text: this.plugin.formatMoney(finance.available) });

    // Apple Wallet Cashflow Breakdown Bar
    const cashflowRow = walletCard.createEl("div", { cls: "sistema-wallet-cashflow-row" });
    const cfInc = cashflowRow.createEl("div", { cls: "sistema-cf-pill is-income" });
    cfInc.createEl("span", { text: "↗ Ingresos" });
    cfInc.createEl("strong", { text: this.plugin.formatMoney(finance.ingreso) });

    const cfExp = cashflowRow.createEl("div", { cls: "sistema-cf-pill is-expense" });
    cfExp.createEl("span", { text: "↘ Gastos" });
    cfExp.createEl("strong", { text: this.plugin.formatMoney(finance.gasto) });

    const cfDebt = cashflowRow.createEl("div", { cls: "sistema-cf-pill is-debt" });
    cfDebt.createEl("span", { text: "↺ Deudas" });
    cfDebt.createEl("strong", { text: this.plugin.formatMoney(finance.pago_deuda) });

    // WIDGET 3: ESTUDIO Y UNIVERSIDAD (Apple Education Widget)
    const studySuggestions = await this.plugin.getAcademicRecommendations(3);
    const studyWidget = bentoGrid.createEl("div", { cls: "sistema-bento-widget sistema-widget-study" });
    const studyTop = studyWidget.createEl("div", { cls: "sistema-widget-top" });
    studyTop.createEl("span", { cls: "sistema-widget-label", text: "MODO ESTUDIO · MATERIAS" });
    studyTop.createEl("span", { cls: "sistema-widget-badge is-blue", text: `${studySuggestions.length} en curso` });

    if (studySuggestions.length) {
      const studyList = studyWidget.createEl("div", { cls: "sistema-apple-inset-list" });
      for (const item of studySuggestions) {
        const row = studyList.createEl("button", { cls: "sistema-inset-row" });
        row.createEl("span", { cls: "sistema-inset-icon is-study", text: "🎓" });
        const rowText = row.createEl("div", { cls: "sistema-inset-copy" });
        rowText.createEl("strong", { text: item.subject.name });
        rowText.createEl("small", { text: item.topic ? item.topic.basename : item.reason });
        row.createEl("span", { cls: "sistema-inset-arrow", text: "›" });
        row.addEventListener("click", () => item.topic ? this.app.workspace.getLeaf(false).openFile(item.topic) : this.plugin.openPath(`${item.subject.folderPath}/${item.subject.name} - Inicio.md`));
      }
      const studyPlanBtn = studyWidget.createEl("button", { cls: "sistema-apple-btn", text: "Abrir plan de estudio ›" });
      studyPlanBtn.addEventListener("click", () => this.plugin.openPath(AUTO_STUDY_PLAN_FILE));
    } else {
      studyWidget.createEl("p", { cls: "sistema-empty-text", text: "Detectará automáticamente las materias dentro de Universidad." });
    }

    // WIDGET 4: APPLE REMINDERS (Live Checklist Widget)
    const reminders = await this.plugin.getDueReminders();
    const today = this.plugin.todayIso();
    const due = reminders.filter((item) => item.date <= today);

    const remWidget = bentoGrid.createEl("div", { cls: "sistema-bento-widget sistema-widget-reminders" });
    const remTop = remWidget.createEl("div", { cls: "sistema-widget-top" });
    remTop.createEl("span", { cls: "sistema-widget-label", text: "RECORDATORIOS" });
    const remLink = remTop.createEl("button", { cls: "sistema-widget-link", text: `Ver todos (${reminders.length}) ›` });
    remLink.addEventListener("click", () => this.plugin.openPath(REMINDERS_FILE));

    if (!due.length) {
      remWidget.createEl("p", { cls: "sistema-empty-text", text: "Sin recordatorios pendientes ni para hoy. ¡Todo al día!" });
    } else {
      const remList = remWidget.createEl("div", { cls: "sistema-reminders-checklist" });
      for (const item of due.slice(0, 5)) {
        const itemRow = remList.createEl("div", { cls: `sistema-rem-item ${item.overdue ? "is-overdue" : ""}` });
        itemRow.createEl("span", { cls: "sistema-rem-circle" });
        const itemCopy = itemRow.createEl("div", { cls: "sistema-rem-copy" });
        if (item.overdue) itemCopy.createEl("span", { cls: "sistema-rem-tag", text: `Atrasado · ${this.plugin.formatDate(item.date)}` });
        itemCopy.createEl("span", { cls: "sistema-rem-title", text: this.plugin.cleanReminderDisplayText(item.text) });
      }
    }

    // WIDGET 5: NOTAS RECIENTES (Apple Notes Inset Table)
    const recentWidget = bentoGrid.createEl("div", { cls: "sistema-bento-widget sistema-widget-notes is-wide" });
    const notesTop = recentWidget.createEl("div", { cls: "sistema-widget-top" });
    notesTop.createEl("span", { cls: "sistema-widget-label", text: "APPLE NOTES · RECIENTES" });

    const notesList = recentWidget.createEl("div", { cls: "sistema-apple-inset-list" });
    for (const file of this.plugin.getRecentNotes().slice(0, 6)) {
      const row = notesList.createEl("button", { cls: "sistema-inset-row" });
      row.createEl("span", { cls: "sistema-inset-icon is-yellow", text: "📄" });
      const copy = row.createEl("div", { cls: "sistema-inset-copy" });
      copy.createEl("strong", { text: file.basename });
      copy.createEl("small", { text: file.parent ? file.parent.name : "Bóveda" });
      row.createEl("span", { cls: "sistema-inset-arrow", text: "›" });
      row.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(file));
    }

    // WIDGET 6: TAREAS EN NOTAS (Apple To-Do List)
    const openTasks = await this.plugin.getOpenTasks();
    if (openTasks.length > 0) {
      const taskWidget = bentoGrid.createEl("div", { cls: "sistema-bento-widget sistema-widget-tasks is-wide" });
      const taskTop = taskWidget.createEl("div", { cls: "sistema-widget-top" });
      taskTop.createEl("span", { cls: "sistema-widget-label", text: `TAREAS EN MIS NOTAS (${openTasks.length})` });

      const taskList = taskWidget.createEl("div", { cls: "sistema-apple-inset-list" });
      for (const task of openTasks.slice(0, 5)) {
        const row = taskList.createEl("button", { cls: "sistema-inset-row" });
        row.createEl("span", { cls: "sistema-task-ring" });
        const copy = row.createEl("div", { cls: "sistema-inset-copy" });
        copy.createEl("strong", { text: this.plugin.cleanDisplayText(task.text) });
        copy.createEl("small", { text: task.file.basename });
        row.createEl("span", { cls: "sistema-inset-arrow", text: "›" });
        row.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(task.file));
      }
    }

    // WIDGET 7: ESPACIOS DE VIDA (Apple Files Squircles)
    const areasWidget = bentoGrid.createEl("div", { cls: "sistema-bento-widget sistema-widget-areas is-wide" });
    const areasTop = areasWidget.createEl("div", { cls: "sistema-widget-top" });
    areasTop.createEl("span", { cls: "sistema-widget-label", text: "ESPACIOS Y CARPETAS · APPLE FILES" });

    const areasGrid = areasWidget.createEl("div", { cls: "sistema-areas-squircle-grid" });
    for (const area of this.plugin.getAreaStats()) {
      const card = areasGrid.createEl("button", { cls: "sistema-area-squircle" });
      card.createEl("span", { cls: "sistema-area-squircle-icon", text: area.icon });
      const areaCopy = card.createEl("div", { cls: "sistema-area-squircle-copy" });
      areaCopy.createEl("strong", { text: area.name });
      areaCopy.createEl("small", { text: `${area.count} archivos` });
      card.addEventListener("click", () => this.plugin.openPath(area.home));
    }
  }
}


class ControlCenterSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Perfil y contextos" });
    containerEl.createEl("p", {
      text: "Estos datos son locales a esta bóveda. No forman parte del repositorio Git.",
    });

    new Setting(containerEl)
      .setName("Nombre")
      .setDesc("Nombre usado en el saludo y en el contexto de la IA.")
      .addText((text) => text
        .setPlaceholder("Usuario")
        .setValue(this.plugin.settings.profileName || "")
        .onChange(async (value) => {
          this.plugin.settings.profileName = value.trim();
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.scheduleRefresh();
        }));

    const education = this.plugin.detectEducationContexts();
    new Setting(containerEl)
      .setName("Contexto educativo activo")
      .setDesc(education.length
        ? `Detectados: ${education.join(", ")}. Puede escribir cualquiera de ellos.`
        : "Opcional. Ejemplos: universidad, instituto, academia o curso externo.")
      .addText((text) => text
        .setPlaceholder("Universidad o institución")
        .setValue(this.plugin.settings.activeEducationContext || "")
        .onChange(async (value) => {
          this.plugin.settings.activeEducationContext = value.trim();
          await this.plugin.saveData(this.plugin.settings);
          await this.plugin.ensureContextHomes();
          this.plugin.scheduleRefresh();
        }));

    const work = this.plugin.detectWorkContexts();
    new Setting(containerEl)
      .setName("Contexto laboral activo")
      .setDesc(work.length
        ? `Detectados: ${work.join(", ")}. El sistema prioriza este contexto al guardar notas de Trabajo.`
        : "Opcional. Ejemplos: empresa, cliente, negocio propio o freelance.")
      .addText((text) => text
        .setPlaceholder("Empresa o contexto laboral")
        .setValue(this.plugin.settings.activeWorkContext || "")
        .onChange(async (value) => {
          this.plugin.settings.activeWorkContext = value.trim();
          await this.plugin.saveData(this.plugin.settings);
          await this.plugin.ensureContextHomes();
          this.plugin.scheduleRefresh();
        }));

    new Setting(containerEl)
      .setName("Idioma / región")
      .setDesc("Código regional para fechas, voz y formato. Ejemplos: es-GT, es-MX, es-ES, en-US.")
      .addText((text) => text
        .setPlaceholder("es-GT, es-MX, es-ES, en-US…")
        .setValue(this.plugin.settings.locale || "")
        .onChange(async (value) => {
          this.plugin.settings.locale = value.trim();
          await this.plugin.saveData(this.plugin.settings);
        }));

    new Setting(containerEl)
      .setName("Moneda")
      .setDesc("Código ISO de moneda. Ejemplos: USD, EUR, MXN, JPY.")
      .addText((text) => text
        .setPlaceholder("GTQ, USD, EUR, MXN…")
        .setValue(this.plugin.settings.currencyCode || "")
        .onChange(async (value) => {
          this.plugin.settings.currencyCode = value.trim().toUpperCase();
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.scheduleRefresh();
        }));

    new Setting(containerEl)
      .setName("Símbolo de respaldo")
      .setDesc("Se usa si el código de moneda no puede formatearse.")
      .addText((text) => text
        .setPlaceholder("Q, $, €, ¥…")
        .setValue(this.plugin.settings.currencySymbol || "")
        .onChange(async (value) => {
          this.plugin.settings.currencySymbol = value.trim();
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.scheduleRefresh();
        }));

    new Setting(containerEl)
      .setName("Modelo de Ollama")
      .setDesc("Modelo local utilizado por el Centro de control.")
      .addText((text) => text
        .setPlaceholder("llama3.2")
        .setValue(this.plugin.settings.model || "llama3.2")
        .onChange(async (value) => {
          this.plugin.settings.model = value.trim() || "llama3.2";
          await this.plugin.saveData(this.plugin.settings);
        }));

    containerEl.createEl("h3", { text: "Cómo funcionan los contextos" });
    containerEl.createEl("p", {
      text: "sistema no contiene una empresa o universidad fija. Detecta instituciones y materias desde la estructura de la bóveda y usa los contextos activos solo para priorizar y mostrar información.",
    });
  }
}

class BaseFormModal extends Modal {
  field(label, type = "text", value = "") {
    const wrap = this.contentEl.createEl("label", { cls: "sistema-field" });
    wrap.createEl("span", { text: label });
    const input = wrap.createEl(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") input.setAttr("type", type);
    input.value = value;
    return input;
  }
  select(label, options) {
    const wrap = this.contentEl.createEl("label", { cls: "sistema-field" });
    wrap.createEl("span", { text: label });
    const select = wrap.createEl("select");
    for (const [value, text] of options) select.createEl("option", { value, text });
    return select;
  }
  actions(onSave, saveText = "Guardar") {
    const row = this.contentEl.createEl("div", { cls: "sistema-form-actions" });
    const save = row.createEl("button", { cls: "mod-cta", text: saveText });
    save.addEventListener("click", onSave);
    const cancel = row.createEl("button", { text: "Cancelar" });
    cancel.addEventListener("click", () => this.close());
    return save;
  }
}

class StudyPlanModal extends BaseFormModal {
  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("sistema-study-modal");
    this.contentEl.createEl("h2", { text: "📚 Modo Estudio" });
    this.contentEl.createEl("p", { cls: "sistema-form-hint", text: "La IA usará tus apuntes de Universidad y los resúmenes de documentos para crear un plan estructurado." });
    const subject = this.field("Curso o tema", "text", this.defaults.subject || "");
    const endDate = this.field("Fecha del examen u objetivo", "date", this.plugin.addDays(7));
    const minutes = this.field("Minutos disponibles por día", "number", "60");
    minutes.setAttr("min", "15"); minutes.setAttr("max", "480"); minutes.setAttr("step", "15");
    const focus = this.field("Qué necesitas aprender o reforzar", "textarea", "");
    focus.setAttr("rows", "3");
    const reminderLabel = this.contentEl.createEl("label", { cls: "sistema-study-check" });
    const createReminders = reminderLabel.createEl("input");
    createReminders.setAttr("type", "checkbox"); createReminders.checked = true;
    reminderLabel.createEl("span", { text: "Crear recordatorios diarios hasta la fecha objetivo" });
    this.contentEl.createEl("p", { cls: "sistema-form-hint", text: "Funciona en PC y móvil con Google Gemini o en PC con Ollama local." });
    const save = this.actions(async () => {
      const aiPlugin = (this.app.plugins && typeof this.app.plugins.getPlugin === "function")
        ? this.app.plugins.getPlugin("vault-ai")
        : (this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["vault-ai"] : null);
      if (!Platform.isDesktopApp && !aiPlugin) return new Notice("Activa el complemento 'IA de bóveda' con Google Gemini para generar planes desde el móvil.", 7000);
      if (!subject.value.trim() || !endDate.value) return new Notice("Complete el curso y la fecha objetivo.");
      save.disabled = true; save.setText("Creando plan…");
      try {
        await this.plugin.createStudyPlan({ subject: subject.value, endDate: endDate.value, minutes: minutes.value, focus: focus.value, createReminders: createReminders.checked });
        this.close();
      } catch (error) {
        new Notice(`No se pudo crear el plan: ${error.message}`, 9000);
      } finally {
        save.disabled = false; save.setText("Crear plan y recordatorios");
      }
    }, "Crear plan y recordatorios");
  }
}

class DailyCaptureModal extends BaseFormModal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: `Registrar mi día · ${this.plugin.todayIso()}` });
    this.contentEl.createEl("p", { cls: "sistema-form-hint", text: "La nota del día solo se creará cuando guarde este contenido." });
    const content = this.field("¿Qué hizo, pensó o necesita recordar?", "textarea");
    content.setAttr("rows", "8");
    this.contentEl.createEl("p", { cls: "sistema-form-hint", text: "En celular puede usar el micrófono del teclado para dictar." });
    this.actions(async () => {
      try { await this.plugin.saveDailyCapture(content.value); this.close(); }
      catch (error) { new Notice(error.message); }
    });
    window.setTimeout(() => content.focus(), 50);
  }
}

class QuickNoteModal extends BaseFormModal {
  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; }
  onOpen() {
    this.contentEl.empty(); this.contentEl.createEl("h2", { text: "Nueva nota" });
    const title = this.field("Título", "text", this.defaults.title || "");
    const area = this.select("Guardar en", [["inbox", "Inbox — decidir después"], ["universidad", "Universidad"], ["trabajo", "Trabajo"], ["proyectos", "Proyectos"], ["personal", "Personal"]]);
    if (this.defaults.area) area.value = this.defaults.area;
    const content = this.field("Contenido", "textarea", this.defaults.content || ""); content.setAttr("rows", "7");
    const reviewDate = this.field("Recordarme revisar (opcional)", "date");
    this.actions(async () => {
      if (!title.value.trim()) return new Notice("Escriba un título.");
      const file = await this.plugin.createQuickNote({ title: title.value, area: area.value, content: content.value });
      if (reviewDate.value) await this.plugin.addReminder({ text: `Revisar nota: ${file.basename}`, date: reviewDate.value, linkPath: file.path });
      this.close();
    });
    window.setTimeout(() => title.focus(), 50);
  }
}

class MovementModal extends BaseFormModal {
  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; }
  onOpen() {
    this.contentEl.empty(); this.contentEl.createEl("h2", { text: "Registrar dinero" });
    const type = this.select("Tipo", [["gasto", "Gasto"], ["ingreso", "Ingreso"], ["pago_deuda", "Pago de deuda"], ["ahorro", "Ahorro"], ["transferencia", "Transferencia entre cuentas"]]);
    type.value = this.defaults.type || "gasto";
    const amount = this.field("Monto", "number", this.defaults.amount || ""); amount.setAttr("step", "0.01"); amount.setAttr("min", "0.01");
    const description = this.field("Descripción", "text", this.defaults.description || "");
    const category = this.field("Categoría", "text", this.defaults.category || "Otros");
    const account = this.field("Cuenta o medio", "text", this.defaults.account || "Efectivo");
    const date = this.field("Fecha", "date", this.defaults.date || this.plugin.todayIso());
    const notes = this.field("Notas opcionales", "textarea"); notes.setAttr("rows", "3");
    this.actions(async () => {
      if (!description.value.trim() || !date.value) return new Notice("Complete descripción y fecha.");
      try {
        await this.plugin.addMovement({ type: type.value, amount: amount.value, description: description.value, category: category.value, account: account.value, date: date.value, notes: notes.value });
        this.close();
      } catch (error) { new Notice(`No se pudo registrar: ${error.message}`); }
    });
    window.setTimeout(() => amount.focus(), 50);
  }
}

class ReminderModal extends BaseFormModal {
  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; this.viewportHandler = null; }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("sistema-reminder-modal");
    if (this.modalEl) this.modalEl.addClass("sistema-reminder-shell");
    this.contentEl.createEl("h2", { text: "Crear recordatorio" });
    const text = this.field("¿Qué debe recordar?", "text", this.defaults.text || "");
    const date = this.field("Fecha", "date", this.defaults.date || this.plugin.todayIso());
    date.setAttr("lang", this.plugin.settings.locale || "es-GT");
    const datePreview = this.contentEl.createEl("p", { cls: "sistema-date-preview" });
    const updateDatePreview = () => datePreview.setText(date.value ? this.plugin.formatDate(date.value, { day: "numeric", month: "long", year: "numeric" }) : "");
    date.addEventListener("change", updateDatePreview);
    updateDatePreview();
    const active = this.app.workspace.getActiveFile();
    if (active instanceof TFile && active.extension === "md") this.contentEl.createEl("p", { cls: "sistema-form-hint", text: `Se enlazará con: ${active.basename}` });
    this.actions(async () => {
      if (!text.value.trim() || !date.value) return new Notice("Complete el recordatorio y la fecha.");
      try {
        await this.plugin.addReminder({ text: text.value, date: date.value, linkPath: active instanceof TFile ? active.path : "" });
        this.close();
      } catch (error) { new Notice(error.message, 7000); }
    });

    const syncViewport = () => {
      if (Platform.isDesktopApp || !this.modalEl) return;
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      const keyboardOpen = height < window.innerHeight * 0.82;
      this.modalEl.style.setProperty("--sistema-visible-height", `${Math.max(280, height - 16)}px`);
      this.modalEl.toggleClass("is-keyboard-open", keyboardOpen);
      if (this.containerEl) {
        this.containerEl.style.alignItems = "flex-start";
        this.containerEl.style.paddingTop = `${Math.max(8, offsetTop + 8)}px`;
        this.containerEl.style.paddingBottom = "calc(8px + env(safe-area-inset-bottom, 0px))";
      }
    };
    this.viewportHandler = syncViewport;
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncViewport);
      window.visualViewport.addEventListener("scroll", syncViewport);
    }
    window.addEventListener("resize", syncViewport);
    text.addEventListener("focus", () => window.setTimeout(syncViewport, 40));
    text.addEventListener("blur", () => window.setTimeout(syncViewport, 160));
    syncViewport();
    if (Platform.isDesktopApp) window.setTimeout(() => text.focus(), 50);
  }
  onClose() {
    if (this.viewportHandler) {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", this.viewportHandler);
        window.visualViewport.removeEventListener("scroll", this.viewportHandler);
      }
      window.removeEventListener("resize", this.viewportHandler);
    }
    if (this.containerEl) { this.containerEl.style.alignItems = ""; this.containerEl.style.paddingTop = ""; this.containerEl.style.paddingBottom = ""; }
    this.contentEl.empty();
  }
}

class AsistenteModal extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }

  async sendSystemMessage(messageText) {
    const text = String(messageText || "").trim();
    if (!text || !this.chat) return;
    this.bubble("user", text);
    const thinking = this.bubble("assistant", "Procesando…");
    try {
      const response = await this.plugin.handleAssistant(text, this);
      if (thinking && thinking.parentElement) thinking.remove();
      if (response && this.contentEl.isConnected) {
        this.bubble("assistant", response);
        if (this.plugin.settings.voiceEnabled) this.speakText(response);
      }
    } catch (error) {
      if (thinking && thinking.parentElement) thinking.remove();
      if (this.contentEl.isConnected) this.bubble("assistant", `No pude completar eso: ${error.message}`);
    }
  }

  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("sistema-assistant-modal");
    const header = this.contentEl.createEl("div", { cls: "sistema-assistant-header" });
    header.createEl("span", { cls: "sistema-assistant-avatar", text: "✨" });
    const title = header.createEl("div");
    title.createEl("span", { cls: "sistema-eyebrow", text: "ASISTENTE INTELIGENTE" });
    title.createEl("h2", { text: "Asistente con IA" });
    const modalStatus = title.createEl("small", { text: "Comprobando sistema…" });
    this.plugin.getAiStatus().then((status) => {
      if (status && status.label) {
        modalStatus.setText(`${status.label} · ${status.detail}`);
      } else {
        modalStatus.setText(Platform.isDesktopApp ? "IA disponible" : "IA móvil con Gemini disponible");
      }
    });
    const activeFile = this.app.workspace.getActiveFile();
    const hasActiveNote = activeFile instanceof TFile && activeFile.extension && activeFile.extension.toLowerCase() === "md";
    if (hasActiveNote) {
      title.createEl("small", { text: `📄 Nota activa: ${activeFile.basename}` });
    }
    const helpToggle = header.createEl("button", { cls: "sistema-help-toggle", text: "?" });
    helpToggle.setAttr("aria-label", "Mostrar ayuda");
    const voiceToggle = header.createEl("button", { cls: "sistema-voice-toggle" });
    this.chat = this.contentEl.createEl("div", { cls: "sistema-assistant-chat" });
    if (hasActiveNote) {
      this.bubble("assistant", `Hola, ${this.plugin.profileName()}. Tienes abierta "${activeFile.basename}". ¿Qué deseas hacer con esta nota o en tu día?`);
    } else {
      this.bubble("assistant", `Hola, ${this.plugin.profileName()}. ¿En qué puedo ayudarte hoy?`);
    }
    const help = this.contentEl.createEl("div", { cls: "sistema-assistant-help is-hidden" });
    help.createEl("strong", { text: "Órdenes rápidas" });
    const examples = help.createEl("div", { cls: "sistema-assistant-examples" });
    const quickExamples = hasActiveNote
      ? [`Resume la nota "${activeFile.basename}"`, "Extrae las tareas pendientes de esta nota", "Mejora la redacción de esta nota", "Organiza mi día", "Recuérdame estudiar mañana"]
      : ["Organiza mi día", "Anota para Empresa A que el servidor necesita revisión", "Crea un proyecto llamado Migrar ERP con tarea hacer backup", "Recuérdame estudiar mañana", "En Matemáticas vimos integrales y entra en el parcial"];
    for (const example of quickExamples) {
      const button = examples.createEl("button", { text: example });
      button.addEventListener("click", () => { input.value = example; input.focus(); });
    }
    const composer = this.contentEl.createEl("div", { cls: "sistema-assistant-composer" });
    const input = composer.createEl("textarea"); input.setAttr("rows", "1");
    const send = composer.createEl("button", { cls: "sistema-assistant-send mod-cta", text: "↑" });
    send.setAttr("aria-label", "Enviar");
    this.contentEl.createEl("div", { cls: "sistema-composer-hint", text: "Enter para enviar · Shift + Enter para otra línea" });
    const refreshVoiceUi = () => {
      const enabled = this.plugin.settings.voiceEnabled;
      voiceToggle.setText(enabled ? "🔊" : "🔇");
      voiceToggle.setAttr("aria-label", enabled ? "Desactivar voz" : "Activar voz");
      voiceToggle.setAttr("title", enabled ? "Voz activada" : "Voz desactivada");
      input.setAttr("placeholder", enabled ? "Escribe o usa el dictado del dispositivo…" : "Escribe lo que necesitas…");
    };
    refreshVoiceUi();
    helpToggle.addEventListener("click", () => {
      const visible = help.hasClass("is-hidden");
      help.toggleClass("is-hidden", !visible);
      helpToggle.toggleClass("is-active", visible);
      helpToggle.setAttr("aria-label", visible ? "Ocultar ayuda" : "Mostrar ayuda");
    });
    voiceToggle.addEventListener("click", async () => {
      await this.plugin.setVoiceEnabled(!this.plugin.settings.voiceEnabled);
      if (!this.plugin.settings.voiceEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
      refreshVoiceUi();
      new Notice(this.plugin.settings.voiceEnabled ? "Modo de voz activado." : "Modo de voz desactivado.");
    });
    const submit = async () => {
      const value = input.value.trim();
      if (!value) return;
      input.value = ""; this.bubble("user", value); send.disabled = true;
      const thinking = this.bubble("assistant", "Procesando…");
      try {
        const response = await this.plugin.handleAssistant(value, this);
        if (thinking && thinking.parentElement) thinking.remove();
        if (response && this.contentEl.isConnected) {
          this.bubble("assistant", response);
          if (this.plugin.settings.voiceEnabled) this.speakText(response);
        }
      } catch (error) {
        if (thinking && thinking.parentElement) thinking.remove();
        if (this.contentEl.isConnected) this.bubble("assistant", `No pude completar eso: ${error.message}`);
      } finally { send.disabled = false; }
    };
    send.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); }
    });
    const revealComposer = () => {
      if (!Platform.isDesktopApp) this.contentEl.addClass("is-keyboard-open");
      window.setTimeout(() => composer.scrollIntoView({ block: "end", behavior: "smooth" }), 120);
    };
    input.addEventListener("focus", revealComposer);
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (document.activeElement !== input) this.contentEl.removeClass("is-keyboard-open");
      }, 250);
    });
    if (Platform.isDesktopApp) window.setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
  bubble(role, text) {
    const bubble = this.chat.createEl("div", { cls: `sistema-assistant-bubble ${role}`, text });
    if (text === "Procesando…") bubble.addClass("is-thinking");
    if (role === "assistant" && text !== "Procesando…") this.lastAssistantText = text;
    this.chat.scrollTop = this.chat.scrollHeight;
    return bubble;
  }
  speakText(text) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      new Notice("Este dispositivo no permite leer la respuesta en voz alta.");
      return;
    }
    window.speechSynthesis.cancel();
    const voice = new window.SpeechSynthesisUtterance(text);
    voice.lang = this.plugin.settings.locale || "es-ES"; voice.rate = 0.96;
    window.speechSynthesis.speak(voice);
  }
}