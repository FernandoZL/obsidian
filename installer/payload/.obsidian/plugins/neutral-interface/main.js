const { Plugin, Platform } = require("obsidian");

const REPLACEMENTS = [
  ["Jarvis · Centro de control", "Centro de control"],
  ["JARVIS OS · CENTRO PERSONAL", "CENTRO PERSONAL"],
  ["Jarvis móvil", "Inicio"],
  ["JARVIS MÓVIL", "MODO MÓVIL"],
  ["Hablar con Jarvis", "Abrir asistente"],
  ["Buscar en Jarvis", "Buscar en la bóveda"],
  ["Jarvis está pensando", "Procesando"],
  ["Jarvis actualizó", "Estudio automático actualizado:"],
  ["Jarvis todavía está cargando", "El sistema todavía está cargando"],
  ["Jarvis está listo", "El sistema está listo"],
  ["Jarvis detectará", "El sistema detectará"],
  ["Jarvis usará", "La IA local usará"],
  ["Jarvis prioriza", "El sistema prioriza"],
  ["Jarvis no contiene", "El sistema no contiene"],
  ["administrado por Jarvis", "administrado por el sistema"],
  ["Abrir Inicio de Jarvis", "Abrir inicio"],
  ["Estudio automático · Jarvis", "Estudio automático"],
  ["Jarvis · Plan automático de estudio", "Plan automático de estudio"],
  ["Jarvis - Plan automático", "Plan automático"],
  ["Jarvis Sistema", "Sistema"],
  ["Jarvis Core", "Centro de control"],
  ["Jarvis Local AI", "IA local"],
  ["Notas de Jarvis", "Notas"],
  ["Pendientes de Jarvis", "Pendientes"],
  ["Proyecto Jarvis", "Proyecto"],
  ["Apuntes Jarvis", "Apuntes"],
  ["Nota de Jarvis", "Nota"],
  ["Obsidian Jarvis", "Obsidian"],
];

module.exports = class NeutralInterfacePlugin extends Plugin {
  onload() {
    this.pending = null;
    this.homeButton = null;
    this.observer = new MutationObserver(() => this.scheduleSweep());
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    this.register(() => this.observer.disconnect());
    this.register(() => this.removeMobileHomeButton());

    this.app.workspace.onLayoutReady(() => {
      this.sweep();
      this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleSweep()));
      this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleSweep()));
      this.registerInterval(window.setInterval(() => this.sweep(), 900));
    });
  }

  scheduleSweep() {
    if (this.pending) window.clearTimeout(this.pending);
    this.pending = window.setTimeout(() => this.sweep(), 50);
  }

  replaceText(value) {
    let out = String(value || "");
    for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);

    // Fallback visual: cualquier texto nuevo que vuelva a introducir la marca
    // se neutraliza sin modificar el contenido real de los archivos.
    out = out.replace(/\bjarvis\s*[-·:]\s*/gi, "");
    out = out.replace(/\bjarvis\b/gi, "Sistema");
    out = out.replace(/\s{2,}/g, " ");
    return out;
  }

  clarifyMobileFilters() {
    // El plugin móvil ya pinta sus encabezados. Aquí solo retiramos residuos
    // duplicados de versiones anteriores y normalizamos los botones.
    const explorer = document.querySelector(".jarvis-mobile-explorer");
    if (explorer) {
      const seen = new Set();
      for (const label of [...explorer.querySelectorAll(":scope > .neutral-mobile-filter-label")]) {
        const text = (label.textContent || "").trim();
        if (!text) {
          label.remove();
          continue;
        }
        const key = text.toLocaleLowerCase("es");
        if (seen.has(key)) label.remove();
        else seen.add(key);
      }
    }

    const areaRow = document.querySelector(".jarvis-mobile-area-filters");
    if (areaRow) {
      const first = areaRow.querySelector("button");
      if (first && ["Todo", "Todas"].includes((first.textContent || "").trim())) {
        first.textContent = "Toda la bóveda";
      }
    }

    const typeRow = document.querySelector(".jarvis-mobile-type-filters");
    if (typeRow) {
      const first = typeRow.querySelector("button");
      if (first && ["Todo", "Todos"].includes((first.textContent || "").trim())) {
        first.textContent = "Cualquier tipo";
      }
    }
  }

  removeMobileHomeButton() {
    if (this.homeButton && this.homeButton.isConnected) this.homeButton.remove();
    this.homeButton = null;
    for (const el of document.querySelectorAll(".neutral-mobile-home-button")) el.remove();
  }

  ensureMobileHomeButton() {
    if (Platform.isDesktopApp) {
      this.removeMobileHomeButton();
      return;
    }

    const activeHome = document.querySelector(
      '.workspace-leaf.mod-active .workspace-leaf-content[data-type="jarvis-mobile-view"]'
    );
    if (activeHome) {
      this.removeMobileHomeButton();
      return;
    }

    if (this.homeButton && this.homeButton.isConnected) return;

    const button = document.createElement("button");
    button.className = "neutral-mobile-home-button";
    button.type = "button";
    button.textContent = "← Inicio";
    button.setAttribute("aria-label", "Volver a Inicio");
    button.style.cssText = [
      "position:fixed",
      "right:14px",
      "bottom:calc(116px + env(safe-area-inset-bottom, 0px))",
      "z-index:1000",
      "min-height:42px",
      "padding:0 14px",
      "border:1px solid var(--background-modifier-border)",
      "border-radius:999px",
      "background:color-mix(in srgb, var(--background-primary) 90%, var(--interactive-accent) 10%)",
      "color:var(--text-normal)",
      "box-shadow:0 8px 28px rgba(0,0,0,.18)",
      "font-size:14px",
      "font-weight:700",
      "touch-action:manipulation",
      "-webkit-tap-highlight-color:transparent"
    ].join(";");

    button.addEventListener("click", async () => {
      try {
        const plugins = this.app.plugins;
        const mobile = plugins && typeof plugins.getPlugin === "function"
          ? plugins.getPlugin("jarvis-mobile-ui")
          : plugins && plugins.plugins
            ? plugins.plugins["jarvis-mobile-ui"]
            : null;
        if (mobile && typeof mobile.activateMobileHome === "function") {
          await mobile.activateMobileHome();
          return;
        }
        this.app.commands.executeCommandById("jarvis-mobile-ui:abrir-inicio-movil");
      } catch (_) {}
    });

    document.body.appendChild(button);
    this.homeButton = button;
  }

  sweep() {
    try {
      if (document.title) document.title = this.replaceText(document.title);

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const before = node.nodeValue || "";
        const after = this.replaceText(before);
        if (after !== before) node.nodeValue = after;
      }

      for (const el of document.body.querySelectorAll("[aria-label], [title], [placeholder]")) {
        for (const attr of ["aria-label", "title", "placeholder"]) {
          if (!el.hasAttribute(attr)) continue;
          const before = el.getAttribute(attr) || "";
          const after = this.replaceText(before);
          if (after !== before) el.setAttribute(attr, after);
        }
      }

      for (const el of document.body.querySelectorAll('[class*="jarvis"]')) {
        if ((el.textContent || "").trim() === "J") el.textContent = "◈";
      }

      this.clarifyMobileFilters();
      this.ensureMobileHomeButton();
    } catch (_) {}
  }
};
