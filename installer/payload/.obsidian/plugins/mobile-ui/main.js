const { Plugin, Platform, TFile, Notice, normalizePath, ItemView } = require("obsidian");

const VIEW_TYPE = "sistema-mobile-view";
const INTERNAL_PREFIXES = [".obsidian/", "90 - Archivo/Sistema/"];
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

class SistemaMobileView extends ItemView {
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
    root.addClass("sistema-mobile-view");
    await this.plugin.renderHub(root);
  }
}

module.exports = class MobileUiPlugin extends Plugin {
  async onload() {
    this.searchToken = 0;
    this.refreshTimer = null;
    this.startupTimers = [];
    this.floatingDockContainer = null;
    this.dockPanelEl = null;
    this.dockBarEl = null;
    this.dockBubbleEl = null;
    this.dockNoteNameEl = null;
    this.panelOpen = false;
    this.dockMinimized = false;
    this.state = { area: "all", type: "all", query: "" };

    if (!Platform.isDesktopApp) {
      document.body.addClass("sistema-mobile-capture-mode");
      this.registerView(VIEW_TYPE, (leaf) => new SistemaMobileView(leaf, this));
    }

    this.addRibbonIcon("home", "Regresar al Menú Principal", () => this.goToHome());

    this.addCommand({
      id: "regresar-menu-principal",
      name: "Regresar al Menú Principal / Inicio",
      callback: () => this.goToHome(),
    });
    this.addCommand({
      id: "abrir-inicio",
      name: "Abrir inicio / centro de control",
      callback: () => this.goToHome(),
    });
    this.addCommand({
      id: "abrir-inicio-movil",
      name: "Abrir inicio móvil",
      callback: () => this.activateMobileHome(),
    });
    this.addCommand({
      id: "alternar-tabla-ia",
      name: "Abrir / cerrar tabla flotante de asistente IA",
      callback: () => this.togglePanelOpen(),
    });
    this.addCommand({
      id: "enfocar-buscador-movil",
      name: "Enfocar búsqueda móvil de la bóveda",
      callback: () => this.focusMobileSearch(),
    });
    this.addCommand({
      id: "capturar-nota-movil",
      name: "Capturar nota rápida",
      callback: () => this.runCoreCommand("crear-nota-rapida"),
    });
    this.addCommand({
      id: "abrir-asistente-movil",
      name: "Abrir asistente de IA",
      callback: () => this.runCoreCommand("abrir-asistente"),
    });
    this.addCommand({
      id: "resumir-nota-activa",
      name: "Resumir nota activa con IA",
      callback: () => this.executeOrCommand("vault-ai:resumir-nota-activa", "summarizeActiveNote"),
    });
    this.addCommand({
      id: "mejorar-texto-nota",
      name: "Mejorar redacción de la nota con IA",
      callback: () => this.executeOrCommand("vault-ai:mejorar-texto-nota-activa", "improveActiveNoteText"),
    });
    this.addCommand({
      id: "extraer-tareas-nota",
      name: "Extraer tareas de la nota con IA",
      callback: () => this.executeOrCommand("vault-ai:extraer-tareas-nota-activa", "extractActiveNoteTasks"),
    });
    this.addCommand({
      id: "preguntas-estudio-nota",
      name: "Generar preguntas de estudio con IA",
      callback: () => this.executeOrCommand("vault-ai:preguntas-estudio-nota-activa", "generateActiveNoteStudy"),
    });

    const handleFocus = (e) => {
      if (!this.floatingDockContainer || !this.floatingDockContainer.isConnected) return;
      if (e.target && (e.target.matches(".cm-content, input:not(.sistema-dock-prompt-input), textarea") || e.target.closest(".cm-editor"))) {
        this.floatingDockContainer.addClass("is-typing");
      }
    };
    const handleBlur = () => {
      if (!this.floatingDockContainer || !this.floatingDockContainer.isConnected) return;
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!active || !(active.matches(".cm-content, input:not(.sistema-dock-prompt-input), textarea") || active.closest(".cm-editor"))) {
          this.floatingDockContainer.removeClass("is-typing");
        }
      }, 200);
    };
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);

    const handlePointerDown = (e) => {
      if (!this.panelOpen) return;
      if (this.floatingDockContainer && !this.floatingDockContainer.contains(e.target)) {
        this.setPanelOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);

    this.register(() => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      document.removeEventListener("pointerdown", handlePointerDown);
    });

    this.app.workspace.onLayoutReady(() => {
      if (!Platform.isDesktopApp) {
        this.startMobileUi();
      }
      this.ensureFloatingAssistantDock();
      this.registerEvent(this.app.workspace.on("layout-change", () => this.ensureFloatingAssistantDock()));
      this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.ensureFloatingAssistantDock()));
      this.registerInterval(window.setInterval(() => this.ensureFloatingAssistantDock(), 1400));
    });
  }

  onunload() {
    document.body.removeClass("sistema-mobile-capture-mode");
    this.removeFloatingAssistantDock();
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    for (const timer of this.startupTimers || []) window.clearTimeout(timer);
    if (!Platform.isDesktopApp) {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    }
  }

  ensureFloatingAssistantDock() {
    const activeHome = document.querySelector(
      '.workspace-leaf.mod-active .workspace-leaf-content[data-type="sistema-mobile-view"], .workspace-leaf.mod-active .workspace-leaf-content[data-type="sistema-control-center"], .workspace-leaf.mod-active .sistema-dashboard-container'
    );
    if (activeHome) {
      if (this.floatingDockContainer) this.floatingDockContainer.addClass("is-hidden-by-view");
      return;
    }

    if (this.floatingDockContainer && this.floatingDockContainer.isConnected) {
      this.floatingDockContainer.removeClass("is-hidden-by-view");
      this.updateDockNoteInfo();
      return;
    }

    this.createFloatingAssistantDock();
  }

  createFloatingAssistantDock() {
    this.removeFloatingAssistantDock();

    const container = document.createElement("div");
    container.className = "sistema-floating-dock-container";

    // 1. Tool Panel (Tabla de Herramientas Flotante)
    const panel = document.createElement("div");
    panel.className = "sistema-tool-panel is-hidden";

    const panelHeader = document.createElement("div");
    panelHeader.className = "sistema-tool-panel-header";
    const headerTitle = document.createElement("div");
    headerTitle.className = "sistema-tool-panel-title";
    const eyebrow = document.createElement("span");
    eyebrow.className = "sistema-dock-eyebrow";
    eyebrow.textContent = "ASISTENTE IA & NOTAS";
    const noteName = document.createElement("div");
    noteName.className = "sistema-dock-note-name";
    noteName.textContent = "📄 Bóveda personal";
    this.dockNoteNameEl = noteName;
    headerTitle.appendChild(eyebrow);
    headerTitle.appendChild(noteName);

    const closeBtn = document.createElement("button");
    closeBtn.className = "sistema-tool-panel-close";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Cerrar tabla de herramientas");
    closeBtn.addEventListener("click", () => this.setPanelOpen(false));

    panelHeader.appendChild(headerTitle);
    panelHeader.appendChild(closeBtn);
    panel.appendChild(panelHeader);

    const promptWrap = document.createElement("div");
    promptWrap.className = "sistema-dock-prompt-wrap";
    const promptInput = document.createElement("input");
    promptInput.type = "text";
    promptInput.className = "sistema-dock-prompt-input";
    promptInput.placeholder = "Preguntar a Gemini sobre esta nota…";
    const promptBtn = document.createElement("button");
    promptBtn.className = "sistema-dock-prompt-btn mod-cta";
    promptBtn.textContent = "↑";
    promptBtn.setAttribute("aria-label", "Consultar a IA");

    const homeBanner = document.createElement("button");
    homeBanner.type = "button";
    homeBanner.className = "sistema-dock-home-banner";
    const bannerIcon = document.createElement("span");
    bannerIcon.className = "btn-icon";
    bannerIcon.textContent = "🏠";
    const bannerText = document.createElement("span");
    bannerText.className = "btn-text";
    bannerText.textContent = "Regresar al Menú Principal";
    homeBanner.appendChild(bannerIcon);
    homeBanner.appendChild(bannerText);
    homeBanner.addEventListener("click", () => {
      this.setPanelOpen(false);
      this.goToHome();
    });
    panel.appendChild(homeBanner);

    const submitPrompt = () => {
      const q = promptInput.value.trim();
      if (!q) return;
      promptInput.value = "";
      this.setPanelOpen(false);
      this.runVaultAiQuery(q);
    };
    promptBtn.addEventListener("click", submitPrompt);
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitPrompt();
      }
    });
    promptWrap.appendChild(promptInput);
    promptWrap.appendChild(promptBtn);
    panel.appendChild(promptWrap);

    const aiLabel = document.createElement("div");
    aiLabel.className = "sistema-dock-section-label";
    aiLabel.textContent = "Acciones de IA en esta nota";
    panel.appendChild(aiLabel);

    const aiGrid = document.createElement("div");
    aiGrid.className = "sistema-dock-grid sistema-dock-ai-grid";

    this.addDockGridBtn(aiGrid, "📝", "Resumir", () => {
      this.setPanelOpen(false);
      this.executeOrCommand("vault-ai:resumir-nota-activa", "summarizeActiveNote");
    });
    this.addDockGridBtn(aiGrid, "⚡", "Mejorar", () => {
      this.setPanelOpen(false);
      this.executeOrCommand("vault-ai:mejorar-texto-nota-activa", "improveActiveNoteText");
    });
    this.addDockGridBtn(aiGrid, "✅", "Tareas", () => {
      this.setPanelOpen(false);
      this.executeOrCommand("vault-ai:extraer-tareas-nota-activa", "extractActiveNoteTasks");
    });
    this.addDockGridBtn(aiGrid, "❓", "Repaso", () => {
      this.setPanelOpen(false);
      this.executeOrCommand("vault-ai:preguntas-estudio-nota-activa", "generateActiveNoteStudy");
    });
    this.addDockGridBtn(aiGrid, "💡", "Explicar", () => {
      this.setPanelOpen(false);
      this.executeOrCommand("vault-ai:explicar-concepto-nota-activa", "explainActiveNote");
    });
    this.addDockGridBtn(aiGrid, "💬", "Chat IA", () => {
      this.setPanelOpen(false);
      this.runCoreCommand("abrir-asistente");
    });
    panel.appendChild(aiGrid);

    const navLabel = document.createElement("div");
    navLabel.className = "sistema-dock-section-label";
    navLabel.textContent = "Navegación y captura";
    panel.appendChild(navLabel);

    const navGrid = document.createElement("div");
    navGrid.className = "sistema-dock-grid sistema-dock-nav-grid";
    this.addDockGridBtn(navGrid, "🏠", "Inicio", () => {
      this.setPanelOpen(false);
      this.goToHome();
    });
    this.addDockGridBtn(navGrid, "🧠", "Red", () => {
      this.setPanelOpen(false);
      this.app.commands.executeCommandById("graph:open");
    });
    this.addDockGridBtn(navGrid, "✍️", "Nota", () => {
      this.setPanelOpen(false);
      this.runCoreCommand("crear-nota-rapida");
    });
    this.addDockGridBtn(navGrid, "📅", "Mi día", () => {
      this.setPanelOpen(false);
      this.runCoreCommand("registrar-el-dia");
    });
    this.addDockGridBtn(navGrid, "⏰", "Recordar", () => {
      this.setPanelOpen(false);
      this.executeOrCommand("vault-ai:crear-recordatorio-nota-activa");
    });
    panel.appendChild(navGrid);

    container.appendChild(panel);
    this.dockPanelEl = panel;

    // 2. Dock Capsule Bar (con botón claro para Menú Principal + Asistente IA)
    const dockBar = document.createElement("div");
    dockBar.className = "sistema-dock-bar";

    const homeBtn = document.createElement("button");
    homeBtn.type = "button";
    homeBtn.className = "sistema-dock-pill-btn is-home";
    homeBtn.setAttribute("aria-label", "Regresar al Menú Principal");
    homeBtn.setAttribute("title", "Regresar al Menú Principal");
    const homeIcon = document.createElement("span");
    homeIcon.className = "dock-btn-icon";
    homeIcon.textContent = "🏠";
    const homeText = document.createElement("span");
    homeText.className = "dock-btn-text";
    homeText.textContent = Platform.isMobile ? "Menú" : "Menú Principal";
    homeBtn.appendChild(homeIcon);
    homeBtn.appendChild(homeText);
    homeBtn.addEventListener("click", () => this.goToHome());

    const divider = document.createElement("div");
    divider.className = "sistema-dock-divider";

    const mainPill = document.createElement("button");
    mainPill.type = "button";
    mainPill.className = "sistema-dock-pill-main";
    mainPill.setAttribute("aria-label", "Abrir tabla de herramientas IA");
    const sparkle = document.createElement("span");
    sparkle.className = "dock-sparkle";
    sparkle.textContent = "✨";
    const pillText = document.createElement("span");
    pillText.className = "dock-btn-text";
    pillText.textContent = "Asistente IA";
    mainPill.appendChild(sparkle);
    mainPill.appendChild(pillText);
    mainPill.addEventListener("click", () => this.togglePanelOpen());

    const minimizePill = document.createElement("button");
    minimizePill.type = "button";
    minimizePill.className = "sistema-dock-pill-toggle";
    minimizePill.setAttribute("aria-label", "Minimizar barra");
    minimizePill.setAttribute("title", "Minimizar barra");
    minimizePill.textContent = "—";
    minimizePill.addEventListener("click", () => this.setDockMinimized(true));

    dockBar.appendChild(homeBtn);
    dockBar.appendChild(divider);
    dockBar.appendChild(mainPill);
    dockBar.appendChild(minimizePill);
    container.appendChild(dockBar);
    this.dockBarEl = dockBar;

    // 3. Mini Bubble
    const miniBubble = document.createElement("button");
    miniBubble.type = "button";
    miniBubble.className = "sistema-dock-bubble is-hidden";
    miniBubble.setAttribute("aria-label", "Abrir Asistente IA");
    miniBubble.textContent = "✨";
    miniBubble.addEventListener("click", () => this.setDockMinimized(false));
    container.appendChild(miniBubble);
    this.dockBubbleEl = miniBubble;

    document.body.appendChild(container);
    this.floatingDockContainer = container;

    this.updateDockNoteInfo();
  }

  addDockGridBtn(parent, icon, label, onClick) {
    const btn = parent.createEl("button", { cls: "sistema-dock-grid-btn" });
    btn.type = "button";
    btn.createEl("span", { cls: "btn-icon", text: icon });
    btn.createEl("span", { cls: "btn-label", text: label });
    btn.addEventListener("click", onClick);
    return btn;
  }

  updateDockNoteInfo() {
    if (!this.dockNoteNameEl) return;
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.extension && activeFile.extension.toLowerCase() === "md") {
      this.dockNoteNameEl.setText(`📄 ${activeFile.basename}`);
    } else {
      this.dockNoteNameEl.setText("📄 Bóveda personal");
    }
  }

  setPanelOpen(open) {
    this.panelOpen = Boolean(open);
    if (this.dockPanelEl) {
      if (this.panelOpen) {
        this.updateDockNoteInfo();
        this.dockPanelEl.removeClass("is-hidden");
      } else {
        this.dockPanelEl.addClass("is-hidden");
      }
    }
  }

  togglePanelOpen() {
    this.setPanelOpen(!this.panelOpen);
  }

  setDockMinimized(minimized) {
    this.dockMinimized = Boolean(minimized);
    if (this.dockMinimized) {
      this.setPanelOpen(false);
      if (this.dockBarEl) this.dockBarEl.addClass("is-hidden");
      if (this.dockBubbleEl) this.dockBubbleEl.removeClass("is-hidden");
    } else {
      if (this.dockBubbleEl) this.dockBubbleEl.addClass("is-hidden");
      if (this.dockBarEl) this.dockBarEl.removeClass("is-hidden");
    }
  }

  goToHome() {
    const executed = this.app.commands.executeCommandById("control-center:abrir-centro-control");
    if (!executed) {
      this.activateMobileHome();
    }
  }

  runVaultAiQuery(query) {
    const aiPlugin = this.getVaultAiPlugin();
    if (aiPlugin && typeof aiPlugin.askFreeQueryAboutNote === "function") {
      const activeFile = this.app.workspace.getActiveFile();
      aiPlugin.askFreeQueryAboutNote(activeFile, query);
    } else {
      this.runCoreCommand("abrir-asistente");
    }
  }

  executeOrCommand(commandId, methodName) {
    const aiPlugin = this.getVaultAiPlugin();
    if (methodName && aiPlugin && typeof aiPlugin[methodName] === "function") {
      aiPlugin[methodName]();
      return;
    }
    try {
      const executed = this.app.commands.executeCommandById(commandId);
      if (!executed) {
        new Notice("Función de IA disponible con nota activa.");
      }
    } catch (_) {
      new Notice("Función de IA no disponible.");
    }
  }

  getVaultAiPlugin() {
    return (this.app.plugins && typeof this.app.plugins.getPlugin === "function")
      ? this.app.plugins.getPlugin("vault-ai")
      : (this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["vault-ai"] : null);
  }

  removeFloatingAssistantDock() {
    if (this.floatingDockContainer && this.floatingDockContainer.isConnected) {
      this.floatingDockContainer.remove();
    }
    this.floatingDockContainer = null;
    this.dockPanelEl = null;
    this.dockBarEl = null;
    this.dockBubbleEl = null;
    this.dockNoteNameEl = null;
    for (const el of document.querySelectorAll(".sistema-floating-dock-container")) {
      el.remove();
    }
    for (const el of document.querySelectorAll(".sistema-mobile-home-button")) {
      el.remove();
    }
  }

  async startMobileUi() {
    const refresh = () => this.scheduleRefresh();
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));

    const delays = [80, 500, 1400];
    for (const delay of delays) {
      const timer = window.setTimeout(() => this.goToHome(), delay);
      this.startupTimers.push(timer);
    }
  }

  async activateMobileHome() {
    const core = this.corePlugin();
    if (core && typeof core.activateDashboard === "function") {
      await core.activateDashboard();
      this.removeMobileHomeButton();
      return;
    }
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view && typeof leaf.view.render === "function") await leaf.view.render();
    this.removeMobileHomeButton();
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

    const head = root.createDiv({ cls: "sistema-mobile-head" });
    const copy = head.createDiv({ cls: "sistema-mobile-head-copy" });
    copy.createEl("span", { cls: "sistema-mobile-eyebrow", text: "CAPTURA Y CONSULTA" });
    copy.createEl("h2", { text: "Inicio" });

    const theme = head.createEl("button", { cls: "sistema-mobile-theme", text: "◐" });
    theme.setAttr("aria-label", "Cambiar apariencia");
    theme.addEventListener("click", async () => {
      const core = this.corePlugin();
      if (!core || typeof core.setAppearance !== "function") return;
      const current = String(core.settings && core.settings.appearance || "auto");
      const next = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
      await core.setAppearance(next);
    });

    const quick = root.createDiv({ cls: "sistema-mobile-quick" });
    this.quickButton(quick, "✨", "Asistente", () => this.runCoreCommand("abrir-asistente"));
    this.quickButton(quick, "🧠", "Red", () => this.app.commands.executeCommandById("graph:open"));
    this.quickButton(quick, "✍️", "Nota", () => this.runCoreCommand("crear-nota-rapida"));
    this.quickButton(quick, "📅", "Mi día", () => this.runCoreCommand("registrar-el-dia"));
    this.quickButton(quick, "💰", "Dinero", () => this.runCoreCommand("registrar-movimiento"));
    this.quickButton(quick, "⏰", "Recordar", () => this.runCoreCommand("crear-recordatorio"));
    this.quickButton(quick, "📥", "Inbox", () => this.openInbox());

    const explorer = root.createDiv({ cls: "sistema-mobile-explorer" });
    const explorerTitle = explorer.createDiv({ cls: "sistema-mobile-explorer-title" });
    explorerTitle.createEl("strong", { text: "Toda mi bóveda" });
    const count = explorerTitle.createEl("span", { cls: "sistema-mobile-count", text: "" });

    const searchWrap = explorer.createDiv({ cls: "sistema-mobile-search" });
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

    explorer.createDiv({ cls: "sistema-mobile-filter-label", text: "Dónde buscar" });
    const areaRow = explorer.createDiv({ cls: "sistema-mobile-filter-row sistema-mobile-area-filters" });
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

    explorer.createDiv({ cls: "sistema-mobile-filter-label", text: "Qué mostrar" });
    const typeRow = explorer.createDiv({ cls: "sistema-mobile-filter-row sistema-mobile-type-filters" });
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

    const results = explorer.createDiv({ cls: "sistema-mobile-results" });
    let debounce = null;
    const renderResults = async () => {
      const token = ++this.searchToken;
      results.empty();
      results.createDiv({ cls: "sistema-mobile-loading", text: "Buscando…" });
      const items = await this.searchVault(this.state.query, this.state.area, this.state.type);
      if (token !== this.searchToken || !root.isConnected) return;
      results.empty();
      count.setText(`${items.length}${items.length >= 80 ? "+" : ""}`);

      if (!items.length) {
        results.createDiv({ cls: "sistema-mobile-empty", text: "No hay resultados con estos filtros." });
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
    const button = parent.createEl("button", { cls: "sistema-mobile-quick-button" });
    button.createEl("span", { cls: "sistema-mobile-quick-icon", text: icon });
    button.createEl("span", { text: label });
    button.addEventListener("click", handler);
    return button;
  }

  syncSelected(buttons, selected) {
    for (const [id, button] of buttons.entries()) button.toggleClass("is-selected", id === selected);
  }

  corePlugin() {
    try {
      if (this.app.plugins && typeof this.app.plugins.getPlugin === "function") return this.app.plugins.getPlugin("control-center");
      return this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins["control-center"] : null;
    } catch (_) {
      return null;
    }
  }

  runCoreCommand(id) {
    try {
      const executed = this.app.commands.executeCommandById(`control-center:${id}`);
      if (executed === false) new Notice("El sistema todavía está cargando. Intenta de nuevo en unos segundos.");
    } catch (error) {
      new Notice(`No se pudo abrir la acción: ${error.message}`);
    }
  }

  async focusMobileSearch() {
    await this.activateMobileHome();
    window.setTimeout(() => {
      const input = document.querySelector(".sistema-mobile-view .sistema-mobile-search input");
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
    const row = parent.createEl("button", { cls: "sistema-mobile-result" });
    row.createEl("span", { cls: "sistema-mobile-result-icon", text: this.iconFor(file) });
    const copy = row.createEl("span", { cls: "sistema-mobile-result-copy" });
    copy.createEl("strong", { text: file.basename });
    copy.createEl("small", { text: file.parent && file.parent.path ? file.parent.path : "Bóveda" });
    row.createEl("span", { cls: "sistema-mobile-result-arrow", text: "›" });
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
