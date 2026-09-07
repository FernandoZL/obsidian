const { Plugin } = require("obsidian");

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
    this.observer = new MutationObserver(() => this.scheduleSweep());
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    this.register(() => this.observer.disconnect());

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

  addMobileFilterLabel(row, kind, text) {
    if (!row || !row.parentElement) return;
    const selector = `.neutral-mobile-filter-label[data-kind="${kind}"]`;
    let label = row.parentElement.querySelector(selector);
    if (!label) {
      label = document.createElement("div");
      label.className = "neutral-mobile-filter-label";
      label.dataset.kind = kind;
      label.style.padding = "2px 14px 6px";
      label.style.color = "var(--text-muted)";
      label.style.fontSize = "0.72rem";
      label.style.fontWeight = "700";
      label.style.letterSpacing = "0.02em";
      row.parentElement.insertBefore(label, row);
    }
    label.textContent = text;
  }

  clarifyMobileFilters() {
    const areaRow = document.querySelector(".jarvis-mobile-area-filters");
    if (areaRow) {
      this.addMobileFilterLabel(areaRow, "area", "Dónde buscar");
      const first = areaRow.querySelector("button");
      if (first && ["Todo", "Todas"].includes((first.textContent || "").trim())) {
        first.textContent = "Toda la bóveda";
      }
    }

    const typeRow = document.querySelector(".jarvis-mobile-type-filters");
    if (typeRow) {
      this.addMobileFilterLabel(typeRow, "type", "Qué mostrar");
      const first = typeRow.querySelector("button");
      if (first && ["Todo", "Todos"].includes((first.textContent || "").trim())) {
        first.textContent = "Cualquier tipo";
      }
    }
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
    } catch (_) {}
  }
};
