const { Plugin, Platform, TFile, Notice, normalizePath, ItemView } = require("obsidian");

const VIEW_TYPE = "jarvis-mobile-view";
const INTERNAL_PREFIXES = [".obsidian/", "90 - Archivo/Jarvis Sistema/"];
const AREA_FILTERS = [
  ["all", "Toda la bóveda", ""],
  ["hoy", "Hoy", "01 - Hoy/"],
  ["universidad", "Universidad", "02 - Universidad/"],
  ["trabajo", "Trabajo", "03 - Trabajo/"],
  ["proyectos", "Proyectos", "04 - Proyectos/"],
  ["conocimiento", "Conocimiento", "05 - Conocimiento/"],
  ["personal", "Personal", "06 - Personal/"],
  ["recursos", "Recursos", "07 - Recursos/"],
  ["archivo", "Archivo", "90 - Archivo/"],
];
const TYPE_FILTERS = [
  ["all", "Cualquier tipo"],
  ["notes", "Notas"],
  ["docs", "Documentos"],
  ["images", "Imágenes"],
  ["pending", "Pendientes"],
];
const DOC_EXTENSIONS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "zip"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"]);

class JarvisMobileView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Inicio"; }
  getIcon() { return "layout-dashboard"; }

  async onOpen() {
    await this.render();
  }

  async render() {
    const root = this.containerEl.children[1] || this.containerEl;
    root.empty();
    root.addClass("jarvis-mobile-view");
    await this.plugin.renderHub(root);
  }
}

module.exports = class JarvisMobileUiPlugin extends Plugin {
  async onload() {
    if (Platform.isDesktopApp) return;

    this.searchToken = 0;
    this.refreshTimer = null;
    this.startupTimers = [];
    this.state = { area: "all", type: "all", query: "" };
    document.body.addClass("jarvis-mobile-capture-mode");

    this.registerView(VIEW_TYPE, (leaf) => new JarvisMobileView(leaf, this));

    this.addCommand({
      id: "abrir-inicio-movil",
      name: "Abrir inicio móvil",
      callback: () => this.activateMobileHome(),
    });
    this.addCommand({
      id: "enfocar-buscador-movil",
      name: "Enfocar búsqueda móvil de la bóveda",
      callback: () => this.focusMobileSearch(),
    });
    this.addCommand({
      id: "capturar-nota-movil",
      name: "Capturar nota desde móvil",
      callback: () => this.runCoreCommand("crear-nota-rapida"),
    });

    this.app.workspace.onLayoutReady(() => this.startMobileUi());
  }

  onunload() {
    document.body.removeClass("jarvis-mobile-capture-mode");
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    for (const timer of this.startupTimers || []) window.clearTimeout(timer);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async startMobileUi() {
    const refresh = () => this.scheduleRefresh();
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));

    const delays = [80, 500, 1400];
    for (const delay of delays) {
      const timer = window.setTimeout(() => this.activateMobileHome().catch(() => {}), delay);
      this.startupTimers.push(timer);
    }
  }

  async activateMobileHome() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view && typeof leaf.view.render === "function") await leaf.view.render();
    return leaf;
  }

  scheduleRefresh() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        if (leaf.view && typeof leaf.view.render === "function") leaf.view.render();
      }
    }, 180);
  }

  async renderHub(root) {
    root.empty();

    const head = root.createDiv({ cls: "jarvis-mobile-head" });
    const copy = head.createDiv({ cls: "jarvis-mobile-head-copy" });
    copy.createEl("span", { cls: "jarvis-mobile-eyebrow", text: "CAPTURA Y CONSULTA" });
    copy.createEl("h2", { text: "Inicio" });

    const theme = head.createEl("button", { cls: "jarvis-mobile-theme", text: "◐" });
    theme.setAttr("aria-label", "Cambiar apariencia");
    theme.addEventListener("click", async () => {
      const core = this.corePlugin();
      if (!core || typeof core.setAppearance !== "function") return;
      const current = String(core.settings && core.settings.appearance || "auto");
      const next = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
      await core.setAppearance(next);
    });

    const quick = root.createDiv({ cls: "jarvis-mobile-quick" });
    this.quickButton(quick, "✍️", "Nota", () => this.runCoreCommand("crear-nota-rapida"));
    this.quickButton(quick, "📅", "Mi día", () => this.runCoreCommand("registrar-el-dia"));
    this.quickButton(quick, "💰", "Dinero", () => this.runCoreCommand("registrar-movimiento"));
    this.quickButton(quick, "⏰", "Recordar", () => this.runCoreCommand("crear-recordatorio"));
    this.quickButton(quick, "📥", "Inbox", () => this.openInbox());

    const explorer = root.createDiv({ cls: "jarvis-mobile-explorer" });
    const explorerTitle = explorer.createDiv({ cls: "jarvis-mobile-explorer-title" });
    explorerTitle.createEl("strong", { text: "Toda mi bóveda" });
    const count = explorerTitle.createEl("span", { cls: "jarvis-mobile-count", text: "" });

    const searchWrap = explorer.createDiv({ cls: "jarvis-mobile-search" });
    searchWrap.createEl("span", { text: "⌕" });
    const input = searchWrap.createEl("input", {
      attr: {
        type: "search",
        placeholder: "Buscar notas, cursos, proyectos, PDFs…",
        autocomplete: "off",
        spellcheck: "false",
        "aria-label": "Buscar en toda la bóveda",
      },
    });
    input.value = this.state.query || "";
    const clear = searchWrap.createEl("button", { text: "×" });
    clear.setAttr("aria-label", "Limpiar búsqueda");

    explorer.createDiv({ cls: "neutral-mobile-filter-label", text: "Dónde buscar" });
    const areaRow = explorer.createDiv({ cls: "jarvis-mobile-filter-row jarvis-mobile-area-filters" });
    const areaButtons = new Map();
    for (const [id, label] of AREA_FILTERS) {
      const button = areaRow.createEl("button", { text: label });
      areaButtons.set(id, button);
      button.addEventListener("click", () => {
        this.state.area = id;
        this.syncSelected(areaButtons, id);
        renderResults();
      });
    }
    this.syncSelected(areaButtons, this.state.area);

    explorer.createDiv({ cls: "neutral-mobile-filter-label", text: "Qué mostrar" });
    const typeRow = explorer.createDiv({ cls: "jarvis-mobile-filter-row jarvis-mobile-type-filters" });
    const typeButtons = new Map();
    for (const [id, label] of TYPE_FILTERS) {
      const button = typeRow.createEl("button", { text: label });
      typeButtons.set(id, button);
      button.addEventListener("click", () => {
        this.state.type = id;
        this.syncSelected(typeButtons, id);
        renderResults();
      });
    }
    this.syncSelected(typeButtons, this.state.type);

    const results = explorer.createDiv({ cls: "jarvis-mobile-results" });
    let debounce = null;
    const renderResults = async () => {
      const token = ++this.searchToken;
      results.empty();
      results.createDiv({ cls: "jarvis-mobile-loading", text: "Buscando…" });
      const items = await this.searchVault(this.state.query, this.state.area, this.state.type);
      if (token !== this.searchToken || !root.isConnected) return;
      results.empty();
      count.setText(`${items.length}${items.length >= 80 ? "+" : ""}`);

      if (!items.length) {
        results.createDiv({ cls: "jarvis-mobile-empty", text: "No hay resultados con estos filtros." });
        return;
      }
      for (const item of items.slice(0, 80)) this.resultRow(results, item);
    };

    input.addEventListener("input", () => {
      this.state.query = input.value.trim();
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(renderResults, 160);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        input.value = "";
        this.state.query = "";
        input.blur();
        renderResults();
      }
    });
    clear.addEventListener("click", () => {
      input.value = "";
      this.state.query = "";
      renderResults();
      input.focus();
    });

    await renderResults();
  }

  quickButton(parent, icon, label, handler) {
    const button = parent.createEl("button", { cls: "jarvis-mobile-quick-button" });
    button.createEl("span", { cls: "jarvis-mobile-quick-icon", text: icon });
    button.createEl("span", { text: label });
    button.addEventListener("click", handler);
    return button;
  }

  syncSelected(buttons, selected) {
    for (const [id, button] of buttons.entries()) button.toggleClass("is-selected", id === selected);
  }

  corePlugin() {
    try {
      if (this.app.plugins && typeof this.app.plugins.getPlugin === "function") return this.app.plugins.getPlugin("jarvis-core");
      return this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["jarvis-core"] : null;
    } catch (_) {
      return null;
    }
  }

  runCoreCommand(id) {
    try {
      const executed = this.app.commands.executeCommandById(`jarvis-core:${id}`);
      if (executed === false) new Notice("El sistema todavía está cargando. Intenta de nuevo en unos segundos.");
    } catch (error) {
      new Notice(`No se pudo abrir la acción: ${error.message}`);
    }
  }

  async focusMobileSearch() {
    await this.activateMobileHome();
    window.setTimeout(() => {
      const input = document.querySelector(".jarvis-mobile-view .jarvis-mobile-search input");
      if (input) {
        input.focus();
        if (typeof input.select === "function") input.select();
      }
    }, 100);
  }

  async openInbox() {
    const preferred = [
      "00 - Inbox/Inbox.md",
      "00 - Inbox/Inbox - Inicio.md",
      "00 - Inbox/Inicio.md",
    ];
    for (const path of preferred) {
      const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
      if (file instanceof TFile) return this.app.workspace.getLeaf(false).openFile(file);
    }
    const fallback = this.app.vault.getMarkdownFiles().find((file) =>
      normalizePath(file.path).startsWith("00 - Inbox/") && this.normalize(file.basename) === "inbox"
    );
    if (fallback) return this.app.workspace.getLeaf(false).openFile(fallback);
    new Notice("No encontré la nota principal del Inbox.");
  }

  isVisibleFile(file) {
    const path = normalizePath(file.path || "");
    if (!path) return false;
    return !INTERNAL_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  matchesArea(file, areaId) {
    const def = AREA_FILTERS.find(([id]) => id === areaId) || AREA_FILTERS[0];
    const prefix = def[2];
    return !prefix || normalizePath(file.path).startsWith(prefix);
  }

  async matchesType(file, typeId, contentCache) {
    const ext = String(file.extension || "").toLowerCase();
    if (typeId === "all") return true;
    if (typeId === "notes") return ext === "md";
    if (typeId === "docs") return DOC_EXTENSIONS.has(ext);
    if (typeId === "images") return IMAGE_EXTENSIONS.has(ext);
    if (typeId === "pending") {
      if (ext !== "md") return false;
      const content = await this.fileContent(file, contentCache);
      return /^\s*-\s*\[ \]\s+\S+/m.test(content);
    }
    return true;
  }

  async fileContent(file, cache) {
    if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") return "";
    if (cache.has(file.path)) return cache.get(file.path);
    let content = "";
    try { content = await this.app.vault.cachedRead(file); } catch (_) {}
    cache.set(file.path, content);
    return content;
  }

  normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async searchVault(query, areaId, typeId) {
    const q = this.normalize(query);
    const terms = q.split(" ").filter(Boolean);
    const contentCache = new Map();
    const candidates = this.app.vault.getFiles().filter((file) => this.isVisibleFile(file) && this.matchesArea(file, areaId));
    const results = [];

    for (const file of candidates) {
      if (!(await this.matchesType(file, typeId, contentCache))) continue;
      const pathNorm = this.normalize(file.path);
      const titleNorm = this.normalize(file.basename);
      let contentNorm = "";
      let score = 0;

      if (terms.length) {
        let matches = terms.every((term) => `${titleNorm} ${pathNorm}`.includes(term));
        if (!matches && String(file.extension || "").toLowerCase() === "md") {
          contentNorm = this.normalize(await this.fileContent(file, contentCache));
          matches = terms.every((term) => `${titleNorm} ${pathNorm} ${contentNorm}`.includes(term));
        }
        if (!matches) continue;

        if (titleNorm === q) score += 120;
        else if (titleNorm.startsWith(q)) score += 80;
        else if (titleNorm.includes(q)) score += 55;
        if (pathNorm.includes(q)) score += 30;
        if (contentNorm && contentNorm.includes(q)) score += 12;
      }

      results.push({ file, score });
    }

    return results
      .sort((a, b) => b.score - a.score || (b.file.stat?.mtime || 0) - (a.file.stat?.mtime || 0))
      .map((item) => item.file)
      .slice(0, 80);
  }

  resultRow(parent, file) {
    const row = parent.createEl("button", { cls: "jarvis-mobile-result" });
    row.createEl("span", { cls: "jarvis-mobile-result-icon", text: this.iconFor(file) });
    const copy = row.createEl("span", { cls: "jarvis-mobile-result-copy" });
    copy.createEl("strong", { text: file.basename });
    copy.createEl("small", { text: file.parent && file.parent.path ? file.parent.path : "Bóveda" });
    row.createEl("span", { cls: "jarvis-mobile-result-arrow", text: "›" });
    row.addEventListener("click", async () => {
      try { await this.app.workspace.getLeaf(false).openFile(file); }
      catch (error) { new Notice(`No se pudo abrir: ${error.message}`); }
    });
  }

  iconFor(file) {
    const ext = String(file.extension || "").toLowerCase();
    if (ext === "md") return "◌";
    if (ext === "pdf") return "PDF";
    if (["xls", "xlsx", "csv"].includes(ext)) return "▦";
    if (["ppt", "pptx"].includes(ext)) return "▤";
    if (["doc", "docx", "txt"].includes(ext)) return "▧";
    if (IMAGE_EXTENSIONS.has(ext)) return "▣";
    return "◫";
  }
};