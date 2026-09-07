const { Plugin, Platform, TFile } = require("obsidian");

const PLUGIN_ID = "jarvis-neutral-ui";

const TEXT_REPLACEMENTS = [
  ["Jarvis · Centro de control", "Centro de control"],
  ["Jarvis móvil", "Inicio"],
  ["JARVIS MÓVIL", "MÓVIL"],
  ["Hablar con Jarvis", "Abrir asistente"],
  ["Mostrar ayuda de Jarvis", "Mostrar ayuda"],
  ["Ocultar ayuda de Jarvis", "Ocultar ayuda"],
  ["Enviar orden a Jarvis", "Enviar orden"],
  ["Jarvis está pensando", "Procesando"],
  ["Jarvis detectará automáticamente", "El sistema detectará automáticamente"],
  ["Jarvis usará tus apuntes", "La IA local usará tus apuntes"],
  ["Jarvis · Perfil y contextos", "Perfil y contextos"],
  ["Nombre que Jarvis usa en el saludo y en el contexto de la IA.", "Nombre usado en el saludo y en el contexto de la IA."],
  ["Jarvis prioriza este contexto al guardar notas de Trabajo.", "El sistema prioriza este contexto al guardar notas de Trabajo."],
  ["Jarvis no contiene una empresa o universidad fija.", "El sistema no contiene una empresa o universidad fija."],
  ["Notas de Jarvis", "Notas"],
  ["Pendientes de Jarvis", "Pendientes"],
  ["Jarvis - Plan automático", "Plan automático"],
  ["Jarvis · Plan automático de estudio", "Plan automático de estudio"],
  ["Estudio automático · Jarvis", "Estudio automático"],
  ["Contexto educativo administrado por Jarvis.", "Contexto educativo."],
  ["Contexto laboral administrado por Jarvis.", "Contexto laboral."],
  ["Abrir Inicio de Jarvis", "Abrir Inicio"],
  ["Jarvis proceso:", "Proceso:"],
  ["Nota creada por Jarvis.", "Nota creada desde el asistente."],
  ["Proyecto creado por Jarvis.", "Proyecto creado desde el asistente."],
  ["Revisar pendiente indicado a Jarvis", "Revisar pendiente indicado"],
];

const GENERATED_NOTE_REPLACEMENTS = [
  ["## Notas de Jarvis", "## Notas"],
  ["# Pendientes de Jarvis", "# Pendientes"],
  ["> Contexto educativo administrado por Jarvis.", "> Contexto educativo."],
  ["> Contexto laboral administrado por Jarvis.", "> Contexto laboral."],
  ["Abrir Inicio de Jarvis", "Abrir Inicio"],
  ["### Estudio automático · Jarvis", "### Estudio automático"],
  ["# Jarvis · Plan automático de estudio", "# Plan automático de estudio"],
  ["Nota creada por Jarvis.", "Nota creada desde el asistente."],
  ["Proyecto creado por Jarvis.", "Proyecto creado desde el asistente."],
  ["🤖 Jarvis proceso:", "🤖 Proceso:"],
];

module.exports = class NeutralUiPlugin extends Plugin {
  async onload() {
    this.observer = null;
    this.refreshTimer = null;
    this.migrationRunning = false;

    this.app.workspace.onLayoutReady(() => {
      this.applyRuntimeNeutralization();
      this.startObserver();
      if (Platform.isDesktopApp) this.migrateGeneratedMarkdown().catch((error) => console.error(`${PLUGIN_ID}:`, error));
    });

    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleApply()));
    this.registerEvent(this.app.vault.on("create", (file) => this.cleanGeneratedFile(file)));
    this.registerEvent(this.app.vault.on("modify", (file) => this.cleanGeneratedFile(file)));
  }

  onunload() {
    if (this.observer) this.observer.disconnect();
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
  }

  startObserver() {
    if (this.observer) this.observer.disconnect();
    this.observer = new MutationObserver(() => this.scheduleApply());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title"],
    });
    this.register(() => this.observer && this.observer.disconnect());
    this.scheduleApply();
  }

  scheduleApply() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.applyRuntimeNeutralization(), 80);
  }

  applyRuntimeNeutralization() {
    this.renamePluginManifests();
    this.renameCommands();
    this.renameOpenViews();
    this.cleanVisibleDom(document.body);
    this.wrapCoreResponses();
  }

  renamePluginManifests() {
    try {
      const manifests = this.app.plugins && this.app.plugins.manifests ? this.app.plugins.manifests : {};
      const labels = {
        "jarvis-core": ["Centro de control", "Organización, captura, estudio y contexto personal."],
        "jarvis-local-ai": ["IA local", "Procesamiento local con Ollama en la PC."],
        "jarvis-mobile-ui": ["Modo móvil", "Captura, lectura, búsqueda y filtros en móvil."],
        "jarvis-neutral-ui": ["Interfaz base", "Interfaz sin marca visible."],
      };
      for (const [id, values] of Object.entries(labels)) {
        if (!manifests[id]) continue;
        manifests[id].name = values[0];
        manifests[id].description = values[1];
      }
    } catch (_) {}
  }

  renameCommands() {
    try {
      const commands = this.app.commands && this.app.commands.commands ? this.app.commands.commands : {};
      const labels = {
        "jarvis-core:hablar-con-jarvis": "Abrir asistente local",
        "jarvis-core:abrir-centro-control": "Abrir Centro de control",
        "jarvis-core:buscar-en-jarvis": "Buscar en toda la bóveda",
        "jarvis-mobile-ui:abrir-inicio-movil": "Abrir inicio móvil",
        "jarvis-mobile-ui:enfocar-buscador-movil": "Enfocar búsqueda móvil de la bóveda",
        "jarvis-mobile-ui:capturar-nota-movil": "Capturar nota desde móvil",
      };
      for (const [id, name] of Object.entries(labels)) {
        if (commands[id]) commands[id].name = name;
      }
    } catch (_) {}
  }

  renameOpenViews() {
    try {
      for (const leaf of this.app.workspace.getLeavesOfType("jarvis-core-view")) {
        if (leaf.view) leaf.view.getDisplayText = () => "Centro de control";
      }
      for (const leaf of this.app.workspace.getLeavesOfType("jarvis-mobile-view")) {
        if (leaf.view) leaf.view.getDisplayText = () => "Inicio";
      }
    } catch (_) {}
  }

  cleanVisibleDom(root) {
    if (!root || !root.querySelectorAll) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) continue;
      const next = this.neutralizeText(node.nodeValue || "");
      if (next !== node.nodeValue) node.nodeValue = next;
      const trimmed = String(node.nodeValue || "").trim();
      if (trimmed === "JARVIS") node.nodeValue = String(node.nodeValue || "").replace("JARVIS", "ASISTENTE LOCAL");
    }

    for (const el of root.querySelectorAll("[aria-label], [title]")) {
      for (const attr of ["aria-label", "title"]) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const next = this.neutralizeText(value);
        if (next !== value) el.setAttribute(attr, next);
      }
    }
  }

  neutralizeText(value) {
    let text = String(value || "");
    for (const [from, to] of TEXT_REPLACEMENTS) text = text.split(from).join(to);
    return text;
  }

  wrapCoreResponses() {
    try {
      const core = this.getPlugin("jarvis-core");
      if (!core || core.__neutralUiWrapped) return;
      core.__neutralUiWrapped = true;

      if (typeof core.handleJarvis === "function") {
        const original = core.handleJarvis.bind(core);
        core.handleJarvis = async (...args) => this.neutralizeText(await original(...args));
      }
      if (typeof core.askOllamaAsJarvis === "function") {
        const original = core.askOllamaAsJarvis.bind(core);
        core.askOllamaAsJarvis = async (...args) => this.neutralizeText(await original(...args));
      }
    } catch (_) {}
  }

  getPlugin(id) {
    try {
      if (this.app.plugins && typeof this.app.plugins.getPlugin === "function") return this.app.plugins.getPlugin(id);
      return this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins[id] : null;
    } catch (_) {
      return null;
    }
  }

  async migrateGeneratedMarkdown() {
    if (this.migrationRunning) return;
    this.migrationRunning = true;
    try {
      for (const file of this.app.vault.getMarkdownFiles()) await this.cleanGeneratedFile(file, true);
      await this.saveData({ migratedBrandlessV1: true, migratedAt: new Date().toISOString() });
    } finally {
      this.migrationRunning = false;
    }
  }

  async cleanGeneratedFile(file, force = false) {
    if (!(file instanceof TFile) || String(file.extension || "").toLowerCase() !== "md") return;
    if (!Platform.isDesktopApp && !force) return;
    try {
      const current = await this.app.vault.read(file);
      let next = current;
      for (const [from, to] of GENERATED_NOTE_REPLACEMENTS) next = next.split(from).join(to);
      if (next !== current) await this.app.vault.modify(file, next);
    } catch (_) {}
  }
};
