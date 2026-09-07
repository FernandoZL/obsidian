const { Plugin, Platform, TFile, Notice, normalizePath } = require("obsidian");

const PLUGIN_ID = "jarvis-mobile-ui";
const INTERNAL_PREFIXES = [".obsidian/", "90 - Archivo/Jarvis Sistema/"];
const AREA_FILTERS = [
  ["all", "Todo", ""],
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
  ["all", "Todo"],
  ["notes", "Notas"],
  ["docs", "Documentos"],
  ["images", "Imágenes"],
  ["pending", "Pendientes"],
];
const DOC_EXTENSIONS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "zip"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"]);

module.exports = class JarvisMobileUiPlugin extends Plugin {
  async onload() {
    if (Platform.isDesktopApp) return;

    this.searchToken = 0;
    this.refreshTimer = null;
    this.observer = null;
    document.body.addClass("jarvis-mobile-capture-mode");

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
    if (this.observer) this.observer.disconnect();
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
  }

  startMobileUi() {
    this.enhanceAllDashboards();

    this.observer = new MutationObserver(() => this.scheduleEnhance());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.observer && this.observer.disconnect());

    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleEnhance()));
    const refresh = () => this.scheduleEnhance(true);
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
  }

  scheduleEnhance(forceResults = false) {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.enhanceAllDashboards(forceResults);
    }, 120);
  }

  enhanceAllDashboards(forceResults = false) {
    for (const root of document.querySelectorAll(".jarvis-dashboard")) {
      this.enhanceDashboard(root, forceResults);
    }
  }

  enhanceDashboard(root, forceResults = false) {
    this.hideDesktopFirstBlocks(root);

    let hub = root.querySelector(":scope > .jarvis-mobile-hub");
    if (!hub) {
      hub = this.buildHub(root);
      root.prepend(hub);
    }

    if (forceResults && hub.__jarvisRenderResults) hub.__jarvisRenderResults();
  }

  hideDesktopFirstBlocks(root) {
    const hero = root.querySelector(":scope > .jarvis-hero");
    if (hero) hero.addClass("jarvis-mobile-hidden");

    const agent = root.querySelector(":scope > .jarvis-agent-console.is-command-bar");
    if (agent) agent.addClass("jarvis-mobile-hidden");

    const searchCard = root.querySelector(":scope > .jarvis-search-card");
    if (searchCard) searchCard.addClass("jarvis-mobile-hidden");

    const actionGrid = root.querySelector(".jarvis-action-grid");
    if (actionGrid && actionGrid.parentElement) actionGrid.parentElement.addClass("jarvis-mobile-hidden");

    const areaGrid = root.querySelector(".jarvis-area-grid");
    if (areaGrid && areaGrid.parentElement) areaGrid.parentElement.addClass("jarvis-mobile-hidden");

    for (const panel of root.querySelectorAll(".jarvis-panel")) {
      const title = panel.querySelector("h2");
      if (title && title.textContent.trim() === "Notas recientes") panel.addClass("jarvis-mobile-hidden");
    }
  }

  buildHub(root) {
    const hub = document.createElement("section");
    hub.className = "jarvis-mobile-hub";

    const head = hub.createDiv({ cls: "jarvis-mobile-head" });
    const copy = head.createDiv({ cls: "jarvis-mobile-head-copy" });
    copy.createEl("span", { cls: "jarvis-mobile-eyebrow", text: "JARVIS MÓVIL" });
    copy.createEl("h2", { text: "Captura y consulta" });
    copy.createEl("p", { text: "En el celular registras, lees y filtras. La IA queda en la PC." });

    const theme = head.createEl("button", { cls: "jarvis-mobile-theme", text: "◐" });
    theme.setAttr("aria-label", "Cambiar apariencia");
    theme.addEventListener("click", async () => {
      const core = this.corePlugin();
      if (!core || typeof core.setAppearance !== "function") return;
      const current = String(core.settings && core.settings.appearance || "auto");
      const next = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
      await core.setAppearance(next);
      new Notice(`Apariencia: ${next === "auto" ? "automática" : next === "dark" ? "oscura" : "clara"}.`);
    });

    const quick = hub.createDiv({ cls: "jarvis-mobile-quick" });
    this.quickButton(quick, "✍️", "Nota", () => this.runCoreCommand("crear-nota-rapida"));
    this.quickButton(quick, "📅", "Mi día", () => this.runCoreCommand("registrar-el-dia"));
    this.quickButton(quick, "💰", "Dinero", () => this.runCoreCommand("registrar-movimiento"));
    this.quickButton(quick, "⏰", "Recordar", () => this.runCoreCommand("crear-recordatorio"));
    this.quickButton(quick, "📥", "Inbox", () => this.openPath("07 - Recursos/Recursos - Inicio.md"));

    const explorer = hub.createDiv({ cls: "jarvis-mobile-explorer" });
    const explorerTitle = explorer.createDiv({ cls: "jarvis-mobile-explorer-title" });
    explorerTitle.createEl("strong", { text: "Toda mi bóveda" });
    const count = explorerTitle.createEl("span", { cls: "jarvis-mobile-count", text: "" });

    const searchWrap = explorer.createDiv({ cls: "jarvis-mobile-search" });
    searchWrap.createEl("span", { text: "⌕" });
    const input = searchWrap.createEl("input", {
      attr: {
        type: "search",
        placeholder: "Buscar notas, materias, proyectos, PDFs…",
        autocomplete: "off",
        spellcheck: "false",
        "aria-label": "Buscar en toda la bóveda",
      },
    });
    const clear = searchWrap.createEl("button", { text: "×" });
    clear.setAttr("aria-label", "Limpiar búsqueda");

    const state = { area: "all", type: "all", query: "" };
    const areaRow = explorer.createDiv({ cls: "jarvis-mobile-filter-row jarvis-mobile-area-filters" });
    const areaButtons = new Map();
    for (const [id, label] of AREA_FILTERS) {
      const button = areaRow.createEl("button", { text: label });
      button.dataset.filter = id;
      areaButtons.set(id, button);
      button.addEventListener("click", () => {
        state.area = id;
        this.syncSelected(areaButtons, id);
        renderResults();
      });
    }
    this.syncSelected(areaButtons, state.area);

    const typeRow = explorer.createDiv({ cls: "jarvis-mobile-filter-row jarvis-mobile-type-filters" });
    const typeButtons = new Map();
    for (const [id, label] of TYPE_FILTERS) {
      const button = typeRow.createEl("button", { text: label });
      button.dataset.filter = id;
      typeButtons.set(id, button);
      button.addEventListener("click", () => {
        state.type = id;
        this.syncSelected(typeButtons, id);
        renderResults();
      });
    }
    this.syncSelected(typeButtons, state.type);

    const results = explorer.createDiv({ cls: "jarvis-mobile-results" });
    let debounce = null;
    const renderResults = async () => {
      const token = ++this.searchToken;
      results.empty();
      results.createDiv({ cls: "jarvis-mobile-loading", text: "Buscando…" });
      const items = await this.searchVault(state.query, state.area, state.type);
      if (token !== this.searchToken || !hub.isConnected) return;
      results.empty();
      count.setText(`${items.length}${items.length >= 60 ? "+" : ""}`);

      if (!items.length) {
        results.createDiv({ cls: "jarvis-mobile-empty", text: "No encontré elementos con esos filtros." });
        return;
      }

      for (const item of items.slice(0, 60)) this.resultRow(results, item);
    };
    hub.__jarvisRenderResults = renderResults;

    input.addEventListener("input", () => {
      state.query = input.value.trim();
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(renderResults, 180);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        input.value = "";
        state.query = "";
        input.blur();
        renderResults();
      }
    });
    clear.addEventListener("click", () => {
      input.value = "";
      state.query = "";
      renderResults();
      input.focus();
    });

    renderResults();
    return hub;
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
    const full = `jarvis-core:${id}`;
    try {
      const executed = this.app.commands.executeCommandById(full);
      if (executed === false) new Notice("La acción de Jarvis todavía no está lista. Intenta de nuevo en unos segundos.");
    } catch (error) {
      new Notice(`No se pudo abrir la acción: ${error.message}`);
    }
  }

  async focusMobileSearch() {
    const core = this.corePlugin();
    if (core && typeof core.activateDashboard === "function") await core.activateDashboard();
    window.setTimeout(() => {
      const input = document.querySelector(".jarvis-mobile-search input");
      if (input) {
        input.focus();
        if (typeof input.select === "function") input.select();
      }
    }, 120);
  }

  async openPath(path) {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
    else new Notice("Ese archivo todavía no existe.");
  }

  isVisibleFile(file) {
    const path = normalizePath(file.path || "");
    if (!path) return false;
    if (INTERNAL_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
    return true;
  }

  matchesArea(file, areaId) {
    const def = AREA_FILTERS.find(([id]) => id === areaId) || AREA_FILTERS[0];
    const prefix = def[2];
    if (!prefix) return true;
    return normalizePath(file.path).startsWith(prefix);
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
    const candidates = this.app.vault.getFiles()
      .filter((file) => this.isVisibleFile(file) && this.matchesArea(file, areaId));

    const results = [];
    for (const file of candidates) {
      if (!(await this.matchesType(file, typeId, contentCache))) continue;
      const pathNorm = this.normalize(file.path);
      const titleNorm = this.normalize(file.basename);
      let contentNorm = "";
      let score = 0;

      if (terms.length) {
        let pathMatches = terms.every((term) => `${titleNorm} ${pathNorm}`.includes(term));
        if (!pathMatches && file.extension.toLowerCase() === "md") {
          contentNorm = this.normalize(await this.fileContent(file, contentCache));
          pathMatches = terms.every((term) => `${titleNorm} ${pathNorm} ${contentNorm}`.includes(term));
        }
        if (!pathMatches) continue;

        if (titleNorm === q) score += 120;
        else if (titleNorm.startsWith(q)) score += 80;
        else if (titleNorm.includes(q)) score += 55;
        if (pathNorm.includes(q)) score += 30;
        if (contentNorm && contentNorm.includes(q)) score += 12;
      }

      score += Math.min(20, Math.max(0, (file.stat && file.stat.mtime ? file.stat.mtime : 0) / 1e11));
      results.push({ file, score });
    }

    return results
      .sort((a, b) => b.score - a.score || (b.file.stat?.mtime || 0) - (a.file.stat?.mtime || 0))
      .map((item) => item.file)
      .slice(0, 60);
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
