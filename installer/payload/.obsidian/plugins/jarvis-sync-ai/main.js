const {
  Plugin,
  Notice,
  Modal,
  TFile,
  Platform,
  normalizePath,
  requestUrl,
} = require("obsidian");

const PLUGIN_ID = "jarvis-sync-ai";
const BRIDGE_ROOT = "90 - Archivo/Jarvis Sistema/IA";
const REQUESTS_FOLDER = `${BRIDGE_ROOT}/Solicitudes`;
const RESPONSES_FOLDER = `${BRIDGE_ROOT}/Respuestas`;
const HEARTBEAT_FILE = `${BRIDGE_ROOT}/estado.jstate`;
const REQUEST_EXT = "jreq";
const RESPONSE_EXT = "jres";
const HEARTBEAT_MAX_AGE = 5 * 60 * 1000;
const SUPPORT_START = "<!-- APOYO_IA_LOCAL_INICIO -->";
const SUPPORT_END = "<!-- APOYO_IA_LOCAL_FIN -->";

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

module.exports = class JarvisSyncAiPlugin extends Plugin {
  async onload() {
    this.processing = new Set();
    this.activeWaitIds = new Set();
    this.patched = false;
    this.originalCore = {};
    this.originalLocalAi = {};

    this.addCommand({
      id: "estado-puente-ia",
      name: "Ver estado de IA sincronizada",
      callback: () => this.showBridgeStatus(),
    });

    this.addCommand({
      id: "sugerir-apoyo-nota-activa",
      name: "Sugerir apoyo para la nota activa mediante la PC",
      callback: () => this.supportActiveNote(),
    });

    this.addCommand({
      id: "procesar-archivo-activo",
      name: "Procesar archivo activo con la IA de la PC",
      callback: () => this.processActiveFileFromMobile(),
    });

    this.app.workspace.onLayoutReady(() => {
      this.startBridge().catch((error) => {
        console.error(`${PLUGIN_ID}:`, error);
        new Notice(`Jarvis Sync AI: ${error.message}`, 8000);
      });
    });
  }

  onunload() {
    this.restoreMobilePatches();
  }

  async startBridge() {
    await this.ensureFolder(BRIDGE_ROOT);
    await this.ensureFolder(REQUESTS_FOLDER);
    await this.ensureFolder(RESPONSES_FOLDER);

    if (Platform.isDesktopApp) {
      await this.updateHeartbeat();
      await this.processRequests();

      this.registerEvent(this.app.vault.on("create", (file) => {
        if (file instanceof TFile && this.isRequestFile(file)) {
          window.setTimeout(() => this.processRequestFile(file), 500);
        }
      }));

      this.registerInterval(window.setInterval(() => {
        this.processRequests().catch((error) => console.error(`${PLUGIN_ID}: request scan`, error));
      }, 10000));

      this.registerInterval(window.setInterval(() => {
        this.updateHeartbeat().catch((error) => console.error(`${PLUGIN_ID}: heartbeat`, error));
      }, 60000));
    } else {
      await this.patchMobilePlugins();
      await this.scanLateResponses();

      this.registerEvent(this.app.vault.on("create", (file) => {
        if (file instanceof TFile && this.isResponseFile(file)) {
          window.setTimeout(() => this.handleLateResponse(file), 450);
        }
      }));

      this.registerEvent(this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && this.isResponseFile(file)) {
          window.setTimeout(() => this.handleLateResponse(file), 450);
        }
      }));

      this.registerInterval(window.setInterval(() => {
        this.patchMobilePlugins().catch((error) => console.error(`${PLUGIN_ID}: patch`, error));
      }, 4000));
    }
  }

  pluginById(id) {
    try {
      if (this.app.plugins && typeof this.app.plugins.getPlugin === "function") {
        const plugin = this.app.plugins.getPlugin(id);
        if (plugin) return plugin;
      }
      return this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins[id] || null : null;
    } catch (_) {
      return null;
    }
  }

  async waitForPlugin(id, timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const plugin = this.pluginById(id);
      if (plugin) return plugin;
      await sleep(350);
    }
    return null;
  }

  async patchMobilePlugins() {
    if (Platform.isDesktopApp) return;

    const core = this.pluginById("jarvis-core");
    if (core && !core.__jarvisSyncAiPatched) {
      this.originalCore.askOllamaAsJarvis = core.askOllamaAsJarvis ? core.askOllamaAsJarvis.bind(core) : null;
      this.originalCore.planAgentActions = core.planAgentActions ? core.planAgentActions.bind(core) : null;
      this.originalCore.getOllamaStatus = core.getOllamaStatus ? core.getOllamaStatus.bind(core) : null;
      this.originalCore.runLocalSupport = core.runLocalSupport ? core.runLocalSupport.bind(core) : null;

      if (this.originalCore.askOllamaAsJarvis) {
        core.askOllamaAsJarvis = async (query) => {
          try {
            const response = await this.requestAndWait("chat", {
              query: String(query || "").slice(0, 12000),
            }, 45000);
            if (response.queued) {
              return "Envié tu pregunta a la PC con Ollama. Si está encendida, la respuesta aparecerá al sincronizarse. Si está apagada, la solicitud queda en cola.";
            }
            return this.resultText(response.result) || "La PC respondió sin contenido.";
          } catch (error) {
            return `No pude completar la consulta con la IA de la PC (${error.message}). La captura local de notas, recordatorios y finanzas sigue disponible.`;
          }
        };
      }

      if (this.originalCore.planAgentActions) {
        core.planAgentActions = async (input) => {
          const fallback = await this.originalCore.planAgentActions(input);
          if (fallback && (fallback.mode === "actions" || fallback.mode === "clarify")) return fallback;
          try {
            const active = this.app.workspace.getActiveFile();
            const response = await this.requestAndWait("plan", {
              input: String(input || "").slice(0, 12000),
              activePath: active instanceof TFile ? active.path : "",
            }, 25000);
            if (response.queued || !response.result) return fallback;
            return typeof core.sanitizeAgentPlan === "function"
              ? core.sanitizeAgentPlan(response.result)
              : response.result;
          } catch (_) {
            return fallback;
          }
        };
      }

      core.getOllamaStatus = async () => this.mobileAiStatus();
      core.runLocalSupport = () => this.supportActiveNote();
      core.__jarvisSyncAiPatched = true;
      this.patched = true;
    }

    const localAi = this.pluginById("jarvis-local-ai");
    if (localAi && !localAi.__jarvisSyncAiPatched) {
      if (typeof localAi.suggestSupportForNote === "function") {
        this.originalLocalAi.suggestSupportForNote = localAi.suggestSupportForNote.bind(localAi);
        localAi.suggestSupportForNote = (file) => this.supportNote(file);
      }
      if (typeof localAi.processSingleFile === "function") {
        this.originalLocalAi.processSingleFile = localAi.processSingleFile.bind(localAi);
        localAi.processSingleFile = (file, force) => this.requestProcessFile(file, force);
      }
      if (typeof localAi.processNewFiles === "function") {
        this.originalLocalAi.processNewFiles = localAi.processNewFiles.bind(localAi);
        localAi.processNewFiles = (showNotice) => this.requestProcessPending(showNotice);
      }
      if (typeof localAi.processAllExisting === "function") {
        this.originalLocalAi.processAllExisting = localAi.processAllExisting.bind(localAi);
        localAi.processAllExisting = () => this.requestProcessAll();
      }
      localAi.__jarvisSyncAiPatched = true;
    }
  }

  restoreMobilePatches() {
    if (Platform.isDesktopApp) return;
    const core = this.pluginById("jarvis-core");
    if (core && core.__jarvisSyncAiPatched) {
      for (const [name, fn] of Object.entries(this.originalCore)) {
        if (fn) core[name] = fn;
      }
      delete core.__jarvisSyncAiPatched;
    }
    const localAi = this.pluginById("jarvis-local-ai");
    if (localAi && localAi.__jarvisSyncAiPatched) {
      for (const [name, fn] of Object.entries(this.originalLocalAi)) {
        if (fn) localAi[name] = fn;
      }
      delete localAi.__jarvisSyncAiPatched;
    }
  }

  async ensureFolder(folderPath) {
    const normalized = normalizePath(folderPath || "");
    if (!normalized) return;
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try { await this.app.vault.createFolder(current); }
        catch (_) { /* otro dispositivo puede haberla creado */ }
      }
    }
  }

  requestPath(id) {
    return normalizePath(`${REQUESTS_FOLDER}/${id}.${REQUEST_EXT}`);
  }

  responsePath(id) {
    return normalizePath(`${RESPONSES_FOLDER}/${id}.${RESPONSE_EXT}`);
  }

  makeId() {
    const time = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 9);
    return `${time}-${random}`;
  }

  async readJson(path) {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) return null;
    try {
      return JSON.parse(await this.app.vault.read(file));
    } catch (_) {
      return null;
    }
  }

  async writeJson(path, value) {
    const normalized = normalizePath(path);
    const folder = normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) : "";
    await this.ensureFolder(folder);
    const text = JSON.stringify(value, null, 2) + "\n";
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof TFile) await this.app.vault.modify(existing, text);
    else await this.app.vault.create(normalized, text);
  }

  async deleteIfExists(path) {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
      try { await this.app.vault.delete(file); } catch (_) {}
    }
  }

  isRequestFile(file) {
    const path = normalizePath(file.path);
    return path.startsWith(normalizePath(REQUESTS_FOLDER) + "/") && file.extension.toLowerCase() === REQUEST_EXT;
  }

  isResponseFile(file) {
    const path = normalizePath(file.path);
    return path.startsWith(normalizePath(RESPONSES_FOLDER) + "/") && file.extension.toLowerCase() === RESPONSE_EXT;
  }

  idFromFile(file) {
    return String(file.basename || "").trim();
  }

  async requestAndWait(kind, payload, timeoutMs) {
    if (Platform.isDesktopApp) throw new Error("esta cola se usa desde móvil");
    const allowed = new Set(["chat", "plan", "support-note", "process-file", "process-new", "process-all"]);
    if (!allowed.has(kind)) throw new Error("tipo de solicitud no permitido");

    const id = this.makeId();
    const request = {
      protocol: 1,
      id,
      kind,
      createdAt: new Date().toISOString(),
      source: "mobile",
      payload: payload || {},
    };
    await this.writeJson(this.requestPath(id), request);
    this.activeWaitIds.add(id);
    new Notice("Jarvis envió la solicitud a la PC con Ollama.", 4500);

    const deadline = Date.now() + Math.max(3000, timeoutMs || 30000);
    while (Date.now() < deadline) {
      const response = await this.readJson(this.responsePath(id));
      if (response) {
        this.activeWaitIds.delete(id);
        await this.cleanupExchange(id);
        if (!response.ok) throw new Error(response.error || "la PC devolvió un error");
        return response;
      }
      await sleep(1200);
    }

    this.activeWaitIds.delete(id);
    return { queued: true, id, kind };
  }

  async cleanupExchange(id) {
    await this.deleteIfExists(this.responsePath(id));
    await this.deleteIfExists(this.requestPath(id));
  }

  async processRequests() {
    if (!Platform.isDesktopApp) return;
    const files = this.app.vault.getFiles()
      .filter((file) => this.isRequestFile(file))
      .sort((a, b) => a.stat.mtime - b.stat.mtime);
    for (const file of files) await this.processRequestFile(file);
  }

  async processRequestFile(file) {
    if (!Platform.isDesktopApp || !(file instanceof TFile) || !this.isRequestFile(file)) return;
    const id = this.idFromFile(file);
    if (!id || this.processing.has(id)) return;
    if (this.app.vault.getAbstractFileByPath(this.responsePath(id)) instanceof TFile) return;

    this.processing.add(id);
    try {
      const request = await this.readJson(file.path);
      if (!request || request.id !== id || Number(request.protocol) !== 1) {
        throw new Error("solicitud inválida");
      }
      const result = await this.handleDesktopRequest(request);
      await this.writeJson(this.responsePath(id), {
        protocol: 1,
        id,
        kind: request.kind,
        createdAt: request.createdAt,
        completedAt: new Date().toISOString(),
        ok: true,
        result,
      });
    } catch (error) {
      await this.writeJson(this.responsePath(id), {
        protocol: 1,
        id,
        kind: "unknown",
        completedAt: new Date().toISOString(),
        ok: false,
        error: String(error && error.message ? error.message : error).slice(0, 1200),
      });
    } finally {
      this.processing.delete(id);
    }
  }

  async handleDesktopRequest(request) {
    const kind = String(request.kind || "");
    const payload = request.payload || {};
    const core = await this.waitForPlugin("jarvis-core");

    if (kind === "chat") {
      if (!core || typeof core.askOllamaAsJarvis !== "function") throw new Error("jarvis-core no está disponible en la PC");
      const query = String(payload.query || "").trim().slice(0, 12000);
      if (!query) throw new Error("consulta vacía");
      return { text: await core.askOllamaAsJarvis(query) };
    }

    if (kind === "plan") {
      if (!core || typeof core.planAgentActions !== "function") throw new Error("el planificador de jarvis-core no está disponible");
      const input = String(payload.input || "").trim().slice(0, 12000);
      if (!input) throw new Error("orden vacía");
      return await core.planAgentActions(input);
    }

    const localAi = await this.waitForPlugin("jarvis-local-ai");
    if (!localAi) throw new Error("jarvis-local-ai no está cargado en la PC");

    if (kind === "support-note") {
      const sourcePath = normalizePath(String(payload.path || ""));
      const file = this.app.vault.getAbstractFileByPath(sourcePath);
      if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") throw new Error("la nota solicitada no existe");
      const support = await this.generateSupportOnDesktop(localAi, file);
      return { support, sourcePath: file.path, sourceName: file.basename };
    }

    if (kind === "process-file") {
      const sourcePath = normalizePath(String(payload.path || ""));
      const file = this.app.vault.getAbstractFileByPath(sourcePath);
      if (!(file instanceof TFile)) throw new Error("el archivo solicitado no existe");
      if (typeof localAi.processSingleFile !== "function") throw new Error("procesamiento de archivo no disponible");
      await localAi.processSingleFile(file, payload.force !== false);
      const record = localAi.settings && localAi.settings.processed ? localAi.settings.processed[file.path] : null;
      return {
        message: record && record.status === "completado" ? `Resumen listo: ${file.name}` : `Procesamiento finalizado: ${file.name}`,
        sourcePath: file.path,
        notePath: record && record.notePath ? record.notePath : "",
        status: record && record.status ? record.status : "desconocido",
      };
    }

    if (kind === "process-new") {
      if (typeof localAi.processNewFiles !== "function") throw new Error("procesamiento pendiente no disponible");
      await localAi.processNewFiles(false);
      return { message: "La PC terminó de revisar los archivos nuevos y pendientes." };
    }

    if (kind === "process-all") {
      if (typeof localAi.processAllExisting !== "function") throw new Error("procesamiento total no disponible");
      await localAi.processAllExisting();
      return { message: "La PC terminó el procesamiento solicitado." };
    }

    throw new Error("tipo de solicitud no compatible");
  }

  async generateSupportOnDesktop(localAi, file) {
    if (typeof localAi.assertOllamaAvailable === "function") await localAi.assertOllamaAvailable();
    const content = (await this.app.vault.read(file)).trim().slice(0, 18000);
    const related = typeof localAi.findCandidateNotes === "function" ? localAi.findCandidateNotes(file) : [];
    const today = typeof localAi.todayIso === "function" ? localAi.todayIso() : this.todayIso();
    const prompt = [
      "Actúa como asistente personal para una bóveda de Obsidian.",
      "Analiza la nota sin inventar datos y ayuda a que sea útil, clara y conectada.",
      "No reescribas toda la nota. Da como máximo 3 sugerencias por sección.",
      "Para enlaces relacionados usa únicamente rutas de la lista NOTAS EXISTENTES y escríbelas como [[ruta exacta]].",
      "Si la nota está vacía o incompleta, sugiere preguntas concretas para llenarla.",
      "Los recordatorios son propuestas: no afirmes que ya fueron programados.",
      "Responde en español usando exactamente estas secciones Markdown:",
      "## Qué falta completar",
      "## Enlaces que conviene agregar",
      "## Notas nuevas que convendría crear",
      "## Recordatorios sugeridos",
      `Fecha actual: ${today}`,
      `Nota activa: ${file.basename}`,
      "NOTAS EXISTENTES:",
      related.length ? related.map((name) => `- ${name}`).join("\n") : "- Ninguna candidata",
      "CONTENIDO DE LA NOTA:",
      content || "(La nota está vacía)",
    ].join("\n\n");
    if (typeof localAi.callOllama !== "function") throw new Error("Ollama no está disponible a través de jarvis-local-ai");
    return String(await localAi.callOllama(prompt)).trim();
  }

  async supportActiveNote() {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") {
      new Notice("Abre primero la nota que deseas revisar.");
      return;
    }
    await this.supportNote(file);
  }

  async supportNote(file) {
    if (Platform.isDesktopApp) {
      const localAi = this.pluginById("jarvis-local-ai");
      if (localAi && typeof localAi.suggestSupportForNote === "function") return localAi.suggestSupportForNote(file);
      new Notice("jarvis-local-ai no está disponible.");
      return;
    }
    try {
      const response = await this.requestAndWait("support-note", { path: file.path }, 60000);
      if (response.queued) {
        new Notice("El apoyo quedó en cola. Aparecerá cuando la PC con Ollama responda.", 7000);
        return;
      }
      const result = response.result || {};
      new BridgeSupportModal(this.app, this, result.sourcePath || file.path, result.support || "").open();
    } catch (error) {
      new Notice(`No se pudo generar el apoyo: ${error.message}`, 9000);
    }
  }

  async appendSupportToNote(sourcePath, support) {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(sourcePath));
    if (!(file instanceof TFile)) throw new Error("la nota ya no existe");
    const existing = await this.app.vault.read(file);
    const block = [
      SUPPORT_START,
      `## Apoyo sugerido por IA — ${this.todayIso()}`,
      "",
      String(support || "").trim(),
      "",
      "> Estas son sugerencias de Ollama. Revisa fechas, datos y decisiones importantes.",
      SUPPORT_END,
    ].join("\n");
    await this.app.vault.modify(file, existing.replace(/\s*$/, "") + "\n\n" + block + "\n");
    new Notice("El apoyo se agregó al final de la nota.", 6000);
  }

  async processActiveFileFromMobile() {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile)) {
      new Notice("Abre primero el archivo que deseas procesar.");
      return;
    }
    await this.requestProcessFile(file, true);
  }

  async requestProcessFile(file, force = true) {
    if (Platform.isDesktopApp) {
      const localAi = this.pluginById("jarvis-local-ai");
      if (localAi && typeof localAi.processSingleFile === "function") return localAi.processSingleFile(file, force);
      return;
    }
    try {
      const response = await this.requestAndWait("process-file", { path: file.path, force: force !== false }, 70000);
      if (response.queued) {
        new Notice("El archivo quedó en cola para procesarse en la PC.", 7000);
        return;
      }
      new Notice(this.resultText(response.result) || "La PC terminó de procesar el archivo.", 8000);
    } catch (error) {
      new Notice(`No se pudo procesar el archivo: ${error.message}`, 9000);
    }
  }

  async requestProcessPending(showNotice = true) {
    if (Platform.isDesktopApp) return;
    try {
      const response = await this.requestAndWait("process-new", {}, 30000);
      if (response.queued) {
        if (showNotice) new Notice("La revisión de archivos quedó en cola para la PC.", 7000);
        return;
      }
      if (showNotice) new Notice(this.resultText(response.result) || "Revisión terminada.", 7000);
    } catch (error) {
      if (showNotice) new Notice(`No se pudo solicitar la revisión: ${error.message}`, 9000);
    }
  }

  async requestProcessAll() {
    if (Platform.isDesktopApp) return;
    try {
      const response = await this.requestAndWait("process-all", {}, 30000);
      if (response.queued) {
        new Notice("El procesamiento completo quedó en cola para la PC.", 7000);
        return;
      }
      new Notice(this.resultText(response.result) || "Procesamiento terminado.", 7000);
    } catch (error) {
      new Notice(`No se pudo solicitar el procesamiento: ${error.message}`, 9000);
    }
  }

  resultText(result) {
    if (typeof result === "string") return result;
    if (!result || typeof result !== "object") return "";
    return String(result.text || result.message || result.support || "").trim();
  }

  async updateHeartbeat() {
    if (!Platform.isDesktopApp) return;
    let state = "offline";
    let model = "";
    let detail = "Ollama no respondió";
    try {
      const response = await requestUrl({
        url: "http://127.0.0.1:11434/api/tags",
        method: "GET",
        throw: false,
      });
      if (response.status === 200) {
        const models = response.json && Array.isArray(response.json.models) ? response.json.models : [];
        model = models.length ? String(models[0].name || models[0].model || "") : "";
        state = "ready";
        detail = model ? `Ollama disponible · ${model}` : "Ollama disponible";
      } else {
        detail = `Ollama respondió HTTP ${response.status}`;
      }
    } catch (error) {
      detail = String(error && error.message ? error.message : error);
    }
    await this.writeJson(HEARTBEAT_FILE, {
      protocol: 1,
      state,
      model,
      detail,
      pcSeenAt: new Date().toISOString(),
      vault: this.app.vault.getName(),
    });
  }

  async readHeartbeat() {
    return this.readJson(HEARTBEAT_FILE);
  }

  async mobileAiStatus() {
    const heartbeat = await this.readHeartbeat();
    if (!heartbeat || !heartbeat.pcSeenAt) {
      return {
        state: "mobile",
        label: "IA vía PC pendiente",
        detail: "Abre Obsidian en la PC con Ollama para activar la IA sincronizada.",
      };
    }
    const seen = new Date(heartbeat.pcSeenAt).getTime();
    const age = Number.isFinite(seen) ? Date.now() - seen : Number.POSITIVE_INFINITY;
    if (heartbeat.state === "ready" && age <= HEARTBEAT_MAX_AGE) {
      return {
        state: "ready",
        label: "IA vía PC lista",
        detail: heartbeat.detail || "La PC con Ollama está disponible.",
      };
    }
    return {
      state: "offline",
      label: "IA PC sin conexión",
      detail: age > HEARTBEAT_MAX_AGE
        ? "La última señal de la PC es antigua. Las solicitudes quedarán en cola."
        : (heartbeat.detail || "Ollama no está disponible en la PC."),
    };
  }

  async showBridgeStatus() {
    if (Platform.isDesktopApp) {
      await this.updateHeartbeat();
      const heartbeat = await this.readHeartbeat();
      new Notice(heartbeat && heartbeat.state === "ready"
        ? `Puente IA listo en la PC${heartbeat.model ? ` · ${heartbeat.model}` : ""}.`
        : "Puente activo, pero Ollama no está respondiendo.", 7000);
      return;
    }
    const status = await this.mobileAiStatus();
    new Notice(`${status.label}. ${status.detail}`, 8000);
  }

  async scanLateResponses() {
    if (Platform.isDesktopApp) return;
    const files = this.app.vault.getFiles().filter((file) => this.isResponseFile(file));
    for (const file of files) await this.handleLateResponse(file);
  }

  async handleLateResponse(file) {
    if (Platform.isDesktopApp || !(file instanceof TFile) || !this.isResponseFile(file)) return;
    const id = this.idFromFile(file);
    if (!id || this.activeWaitIds.has(id)) return;
    const response = await this.readJson(file.path);
    if (!response) return;
    const request = await this.readJson(this.requestPath(id));
    const kind = response.kind && response.kind !== "unknown" ? response.kind : (request && request.kind ? request.kind : "unknown");

    if (!response.ok) {
      new Notice(`La IA de la PC devolvió un error: ${response.error || "sin detalle"}`, 9000);
      await this.cleanupExchange(id);
      return;
    }

    const result = response.result || {};
    if (kind === "chat") {
      new BridgeTextModal(this.app, "Jarvis respondió", this.resultText(result)).open();
    } else if (kind === "support-note") {
      const sourcePath = result.sourcePath || (request && request.payload ? request.payload.path : "");
      new BridgeSupportModal(this.app, this, sourcePath, result.support || "").open();
    } else if (kind === "process-file" || kind === "process-new" || kind === "process-all") {
      new Notice(this.resultText(result) || "La PC terminó la solicitud de IA.", 8000);
    }
    await this.cleanupExchange(id);
  }

  todayIso() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
};

class BridgeTextModal extends Modal {
  constructor(app, title, text) {
    super(app);
    this.title = title;
    this.text = text;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("jarvis-sync-ai-modal");
    contentEl.createEl("h2", { text: this.title });
    const body = contentEl.createEl("pre", { cls: "jarvis-sync-ai-result", text: this.text || "Sin contenido." });
    body.setAttr("tabindex", "0");
    const actions = contentEl.createEl("div", { cls: "jarvis-sync-ai-actions" });
    actions.createEl("button", { cls: "mod-cta", text: "Cerrar" }).addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

class BridgeSupportModal extends Modal {
  constructor(app, plugin, sourcePath, support) {
    super(app);
    this.plugin = plugin;
    this.sourcePath = sourcePath;
    this.support = support;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("jarvis-sync-ai-modal");
    const file = this.app.vault.getAbstractFileByPath(normalizePath(this.sourcePath || ""));
    const name = file instanceof TFile ? file.basename : "nota";
    contentEl.createEl("h2", { text: `Apoyo para “${name}”` });
    contentEl.createEl("p", { text: "La respuesta fue generada por Ollama en tu PC y sincronizada a este dispositivo." });
    contentEl.createEl("pre", { cls: "jarvis-sync-ai-result", text: this.support || "Sin contenido." });

    const actions = contentEl.createEl("div", { cls: "jarvis-sync-ai-actions" });
    const add = actions.createEl("button", { cls: "mod-cta", text: "Agregar a la nota" });
    add.addEventListener("click", async () => {
      add.disabled = true;
      try {
        await this.plugin.appendSupportToNote(this.sourcePath, this.support);
        this.close();
      } catch (error) {
        new Notice(`No se pudo agregar el apoyo: ${error.message}`, 8000);
        add.disabled = false;
      }
    });
    actions.createEl("button", { text: "Cerrar" }).addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}
