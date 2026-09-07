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
      this.registerInterval(window.setInterval(() => this.sweep(), 1200));
    });
  }

  scheduleSweep() {
    if (this.pending) window.clearTimeout(this.pending);
    this.pending = window.setTimeout(() => this.sweep(), 80);
  }

  replaceText(value) {
    let out = String(value || "");
    for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);
    if (out.trim() === "JARVIS") out = out.replace("JARVIS", "ASISTENTE");
    return out;
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
    } catch (_) {}
  }
};
