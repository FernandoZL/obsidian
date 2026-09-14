const {
  Plugin,
  PluginSettingTab,
  Setting,
  Modal,
  Notice,
  TFile,
  Platform,
  requestUrl,
  normalizePath,
} = require("obsidian");

const path = require("path");
const fs = require("fs");

const PLUGIN_ID = "vault-ai";
const AUTO_START = "<!-- RESUMEN_IA_INICIO -->";
const AUTO_END = "<!-- RESUMEN_IA_FIN -->";
const SUPPORT_START = "<!-- APOYO_IA_INICIO -->";
const SUPPORT_END = "<!-- APOYO_IA_FIN -->";

const TEXT_EXTENSIONS = new Set([
  "txt", "csv", "json", "xml", "sql", "log", "rtf", "yaml", "yml", "md"
]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "pptx", "xlsx"]);
const CARD_ONLY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "zip", "rar", "7z",
  "mp3", "wav", "m4a", "mp4", "mov", "avi",
]);
const TRACKED_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
  ...CARD_ONLY_EXTENSIONS,
]);

const DEFAULT_SETTINGS = {
  provider: "gemini",
  geminiApiKey: "",
  geminiModel: "gemini-3.6-flash",
  model: "llama3.2",
  ollamaUrl: "http://127.0.0.1:11434",
  summaryFolder: "07 - Recursos/01 - Resumenes automaticos",
  autoProcess: true,
  initialized: false,
  maxCharacters: 100000,
  reminderFile: "01 - Hoy/Recordatorios/Recordatorios.md",
  lastReminderNotice: "",
  processed: {},
};

module.exports = class VaultAiPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (this.settings.reminderFile === "01 - Hoy/Recordatorios.md") {
      this.settings.reminderFile = DEFAULT_SETTINGS.reminderFile;
      await this.saveData(this.settings);
    }
    if (
      !this.settings.geminiModel ||
      this.settings.geminiModel === "gemini-flash-latest" ||
      this.settings.geminiModel === "gemini-2.0-flash" ||
      this.settings.geminiModel === "gemini-2.5-flash" ||
      this.settings.geminiModel === "gemini-1.5-flash" ||
      this.settings.geminiModel === "gemini-1.5-pro"
    ) {
      this.settings.geminiModel = "gemini-3.6-flash";
      await this.saveData(this.settings);
    }
    this.settings.processed = this.settings.processed || {};
    this.processing = false;
    this.queueRequested = false;
    this.pdfjs = null;
    this.jszip = null;

    this.addSettingTab(new VaultAiSettingTab(this.app, this));

    this.addCommand({
      id: "procesar-archivos-pendientes",
      name: "Procesar archivos nuevos y pendientes",
      callback: () => this.processNewFiles(true),
    });

    this.addCommand({
      id: "procesar-archivo-activo",
      name: "Crear o actualizar resumen del archivo activo",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const valid = file instanceof TFile && this.isTracked(file);
        if (valid && !checking) this.processSingleFile(file, true);
        return valid;
      },
    });

    this.addCommand({
      id: "procesar-todos-existentes",
      name: "Procesar también todos los archivos existentes",
      callback: () => this.processAllExisting(),
    });

    this.addCommand({
      id: "sugerir-apoyo-nota-activa",
      name: "Sugerir apoyo para la nota activa",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownNote();
        if (file && !checking) this.suggestSupportForNote(file);
        return Boolean(file);
      },
    });

    this.addCommand({
      id: "resumir-nota-activa",
      name: "Resumir nota activa con IA",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownNote();
        if (file && !checking) this.summarizeActiveNote();
        return Boolean(file);
      },
    });

    this.addCommand({
      id: "mejorar-texto-nota-activa",
      name: "Mejorar redacción y ortografía con IA",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownNote();
        if (file && !checking) this.improveActiveNoteText();
        return Boolean(file);
      },
    });

    this.addCommand({
      id: "extraer-tareas-nota-activa",
      name: "Extraer tareas pendientes con IA",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownNote();
        if (file && !checking) this.extractActiveNoteTasks();
        return Boolean(file);
      },
    });

    this.addCommand({
      id: "preguntas-estudio-nota-activa",
      name: "Generar preguntas de estudio / flashcards con IA",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownNote();
        if (file && !checking) this.generateActiveNoteStudy();
        return Boolean(file);
      },
    });

    this.addCommand({
      id: "explicar-concepto-nota-activa",
      name: "Explicar conceptos de la nota con IA",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownNote();
        if (file && !checking) this.explainActiveNote();
        return Boolean(file);
      },
    });

    this.addCommand({
      id: "crear-recordatorio-nota-activa",
      name: "Crear recordatorio para la nota activa",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownNote();
        if (file && !checking) new SistemaReminderModal(this.app, this, file).open();
        return Boolean(file);
      },
    });

    this.addCommand({
      id: "abrir-recordatorios",
      name: "Abrir mis recordatorios",
      callback: () => this.openReminders(),
    });

    this.addCommand({
      id: "probar-conexion-ia",
      name: "Probar conexión con IA",
      callback: async () => {
        try {
          const res = await this.assertAIAvailable();
          new Notice(`IA disponible: ${res.label} (${res.detail})`, 6000);
        } catch (err) {
          new Notice(`Error de IA: ${err.message}`, 8000);
        }
      },
    });

    this.addRibbonIcon("bot", "Resumir archivos pendientes con IA", () => {
      this.processNewFiles(true);
    });

    this.addRibbonIcon("sparkles", "Sugerir apoyo para esta nota", () => {
      const file = this.getActiveMarkdownNote();
      if (!file) {
        new Notice("Abre primero una nota de Obsidian.");
        return;
      }
      this.suggestSupportForNote(file);
    });

    this.registerEvent(this.app.vault.on("create", (file) => {
      if (!this.settings.autoProcess) return;
      if (file instanceof TFile && this.isTracked(file)) {
        window.setTimeout(() => this.processSingleFile(file, false), 3500);
      }
    }));

    this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      if (!(file instanceof TFile) || !this.isTracked(file)) return;
      if (this.settings.processed[oldPath]) {
        this.settings.processed[file.path] = this.settings.processed[oldPath];
        delete this.settings.processed[oldPath];
        await this.saveData(this.settings);
      }
    }));

    this.app.workspace.onLayoutReady(async () => {
      await this.ensureFolder(this.settings.summaryFolder);
      await this.ensureReminderFile();
      if (!this.settings.initialized) {
        await this.baselineExistingFiles();
      } else if (this.settings.autoProcess) {
        window.setTimeout(() => this.processNewFiles(false), 5000);
      }
      window.setTimeout(() => this.notifyDueReminders(), 2500);
      window.setTimeout(() => this.triggerStudyRefresh(true), 3200);
    });
  }

  getActiveMarkdownNote() {
    const file = this.app.workspace.getActiveFile();
    return file instanceof TFile && file.extension.toLowerCase() === "md" ? file : null;
  }

  async callAI(prompt, systemInstruction = "") {
    const provider = this.settings.provider || "gemini";
    if (provider === "gemini") {
      return this.callGemini(prompt, systemInstruction);
    } else {
      return this.callOllama(prompt, systemInstruction);
    }
  }

  async callGemini(prompt, systemInstruction = "") {
    const apiKey = (this.settings.geminiApiKey || "").trim();
    if (!apiKey) {
      throw new Error("Falta la API Key de Google Gemini. Configúrala en Ajustes > IA de bóveda.");
    }
    const model = (this.settings.geminiModel || "gemini-3.6-flash").trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      }
    };
    if (systemInstruction && systemInstruction.trim()) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.trim() }]
      };
    }

    const response = await requestUrl({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      throw: false,
    });

    if (response.status !== 200) {
      let detail = "";
      try {
        const errJson = response.json;
        if (errJson && errJson.error && errJson.error.message) {
          detail = errJson.error.message;
        }
      } catch (_) {}
      if (!detail) {
        detail = response.text ? response.text.slice(0, 300) : `HTTP ${response.status}`;
      }
      if (response.status === 429) {
        throw new Error("Límite de solicitudes de Google Gemini alcanzado (Error 429: Cuota temporal). La cuota gratuita se restablece automáticamente en 60 segundos; por favor espera un momento y vuelve a probar.");
      }
      if (response.status === 404 && detail.includes("no longer available")) {
        throw new Error(`El modelo "${model}" ya no está disponible en Google Gemini. Seleccione "gemini-3.6-flash" en los ajustes.`);
      }
      throw new Error(`Gemini devolvió un error (${response.status}): ${detail}`);
    }

    const candidates = response.json && response.json.candidates;
    const candidate = candidates && candidates[0];
    const parts = (candidate && candidate.content && candidate.content.parts) || [];
    const textPart = parts.map((p) => p.text || "").filter(Boolean).join("\n").trim();
    if (!textPart) {
      throw new Error("Gemini respondió sin contenido textual.");
    }
    return textPart;
  }

  async callOllama(prompt, systemInstruction = "") {
    const baseUrl = (this.settings.ollamaUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
    const body = {
      model: this.settings.model || "llama3.2",
      prompt,
      stream: false,
      options: { temperature: 0.15, num_ctx: 8192 },
    };
    if (systemInstruction) {
      body.system = systemInstruction;
    }
    const response = await requestUrl({
      url: `${baseUrl}/api/generate`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify(body),
      throw: false,
    });
    if (response.status !== 200) {
      const detail = response.text ? response.text.slice(0, 240) : `HTTP ${response.status}`;
      throw new Error(`Ollama devolvió un error: ${detail}`);
    }
    const output = response.json && response.json.response;
    if (!output) throw new Error("Ollama respondió sin contenido");
    return output.trim();
  }

  async assertAIAvailable() {
    const provider = this.settings.provider || "gemini";
    if (provider === "gemini") {
      const apiKey = (this.settings.geminiApiKey || "").trim();
      if (!apiKey) throw new Error("Falta la API Key de Google Gemini. Ingrésala en los ajustes.");
      const model = (this.settings.geminiModel || "gemini-3.6-flash").trim();
      const test = await this.callGemini("Responde exactamente: OK");
      if (!test) throw new Error("Google Gemini no respondió adecuadamente.");
      return { state: "ready", label: "Google Gemini", detail: `${model} listo` };
    } else {
      if (!Platform.isDesktopApp) {
        throw new Error("Ollama solo está disponible en la aplicación de escritorio.");
      }
      const baseUrl = (this.settings.ollamaUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
      const response = await requestUrl({
        url: `${baseUrl}/api/tags`,
        method: "GET",
        throw: false,
      });
      if (response.status !== 200) throw new Error("Ollama no está respondiendo");
      const models = (response.json && response.json.models) || [];
      const found = models.some((item) => String(item.name || "").startsWith(this.settings.model));
      if (!found) throw new Error(`El modelo ${this.settings.model} no está instalado en Ollama`);
      return { state: "ready", label: "Ollama", detail: `${this.settings.model} listo` };
    }
  }

  async suggestSupportForNote(file) {
    try {
      const current = this.app.vault.getAbstractFileByPath(file.path);
      if (!(current instanceof TFile)) throw new Error("la nota ya no existe");
      const content = (await this.app.vault.read(current)).trim().slice(0, 25000);
      const related = this.findCandidateNotes(current);
      new Notice(`Analizando: ${current.basename}…`, 4000);

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
        `Fecha actual: ${this.todayIso()}`,
        `Nota activa: ${current.basename}`,
        "NOTAS EXISTENTES:",
        related.length ? related.map((name) => `- ${name}`).join("\n") : "- Ninguna candidata",
        "CONTENIDO DE LA NOTA:",
        content || "(La nota está vacía)",
      ].join("\n\n");

      const result = (await this.callAI(prompt, "Eres un asistente metódico para una bóveda personal de Obsidian.")).trim();
      new SistemaSupportModal(this.app, this, current, result).open();
    } catch (error) {
      console.error(`${PLUGIN_ID}:`, error);
      new Notice(`No se pudo generar el apoyo: ${error.message}`, 10000);
    }
  }

  findCandidateNotes(activeFile) {
    const activeFolder = activeFile.parent ? activeFile.parent.path : "";
    const activeWords = new Set(activeFile.basename.toLowerCase().split(/[^a-záéíóúüñ0-9]+/i).filter((word) => word.length > 3));
    return this.app.vault.getMarkdownFiles()
      .filter((file) => file.path !== activeFile.path && file.path !== this.settings.reminderFile)
      .map((file) => {
        const sameFolder = (file.parent ? file.parent.path : "") === activeFolder ? 10 : 0;
        const words = file.basename.toLowerCase().split(/[^a-záéíóúüñ0-9]+/i);
        const matches = words.filter((word) => activeWords.has(word)).length;
        return { name: file.path.replace(/\.md$/i, ""), score: sameFolder + matches };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"))
      .slice(0, 80)
      .map((item) => item.name);
  }

  async appendSupportToNote(file, support) {
    const current = this.app.vault.getAbstractFileByPath(file.path);
    if (!(current instanceof TFile)) throw new Error("la nota ya no existe");
    const existing = await this.app.vault.read(current);
    const block = [
      SUPPORT_START,
      `## Apoyo sugerido por IA — ${this.todayIso()}`,
      "",
      support.trim(),
      "",
      "> Estas son sugerencias generadas por IA. Revise fechas, datos y decisiones importantes.",
      SUPPORT_END,
    ].join("\n");
    await this.app.vault.modify(current, existing.replace(/\s*$/, "") + "\n\n" + block + "\n");
    new Notice("El apoyo se agregó al final de la nota.", 6000);
  }

  getSelectedText() {
    try {
      const view = this.app.workspace.getActiveViewOfType(require("obsidian").MarkdownView);
      if (view && view.editor) {
        return view.editor.getSelection().trim();
      }
    } catch (_) {}
    return "";
  }

  replaceSelectionInActiveEditor(newText) {
    try {
      const view = this.app.workspace.getActiveViewOfType(require("obsidian").MarkdownView);
      if (view && view.editor) {
        view.editor.replaceSelection(newText);
        new Notice("Texto reemplazado en la nota.", 4000);
        return true;
      }
    } catch (_) {}
    return false;
  }

  async appendContentToNote(file, heading, content) {
    const current = this.app.vault.getAbstractFileByPath(file.path);
    if (!(current instanceof TFile)) throw new Error("La nota ya no existe");
    const existing = await this.app.vault.read(current);
    const block = [
      "",
      `## ${heading} — ${this.todayIso()}`,
      "",
      content.trim(),
      "",
      "> Generado con IA. Revise fechas, datos y decisiones importantes.",
      ""
    ].join("\n");
    await this.app.vault.modify(current, existing.replace(/\s*$/, "") + "\n" + block);
    new Notice(`Se agregó a "${file.basename}".`, 5000);
  }

  async summarizeActiveNote() {
    const file = this.getActiveMarkdownNote();
    if (!file) { new Notice("Abre primero una nota en Obsidian."); return; }
    try {
      const content = (await this.app.vault.read(file)).trim();
      if (!content) { new Notice("La nota está vacía."); return; }
      new Notice(`Resumiendo "${file.basename}" con IA…`, 4000);
      const prompt = [
        "Actúa como asistente analítico de notas para Obsidian.",
        "Analiza la siguiente nota y genera un resumen estructurado, claro y útil en español.",
        "Usa este formato Markdown:",
        "### 📌 Resumen Ejecutivo",
        "(1 a 2 párrafos concisos con la idea central)",
        "### 💡 Puntos Clave",
        "- (Puntos más relevantes en viñetas ordenadas)",
        "### 🎯 Conclusiones y Próximos Pasos",
        "- (Decisiones, aplicaciones prácticas o reflexiones)",
        "",
        `Nota: ${file.basename}`,
        "CONTENIDO DE LA NOTA:",
        content.slice(0, 32000)
      ].join("\n\n");
      const result = (await this.callAI(prompt, "Eres un asistente de notas analítico y metódico.")).trim();
      new SistemaNoteAiResultModal(this.app, this, file, "Resumen con IA", result, "resumen").open();
    } catch (err) {
      new Notice(`Error al resumir: ${err.message}`, 8000);
    }
  }

  async improveActiveNoteText() {
    const file = this.getActiveMarkdownNote();
    if (!file) { new Notice("Abre primero una nota en Obsidian."); return; }
    try {
      const selection = this.getSelectedText();
      const content = selection || (await this.app.vault.read(file)).trim();
      if (!content) { new Notice("No hay texto para mejorar."); return; }
      const isSelection = Boolean(selection);
      new Notice(isSelection ? "Mejorando selección con IA…" : `Mejorando texto de "${file.basename}" con IA…`, 4000);
      const prompt = [
        "Actúa como editor y corrector de estilo profesional en español para notas de Obsidian.",
        "Pule la redacción, corrige faltas ortográficas y gramaticales, mejora la coherencia y fluidez del texto sin alterar su significado original ni inventar información.",
        "Devuelve ÚNICAMENTE el texto mejorado y corregido, sin saludos, notas al pie ni explicaciones previas.",
        "",
        "TEXTO ORIGINAL:",
        content.slice(0, 32000)
      ].join("\n\n");
      const result = (await this.callAI(prompt, "Eres un corrector de estilo y redactor profesional.")).trim();
      new SistemaNoteAiResultModal(this.app, this, file, isSelection ? "Selección mejorada" : "Texto mejorado", result, "mejorar", isSelection).open();
    } catch (err) {
      new Notice(`Error al mejorar texto: ${err.message}`, 8000);
    }
  }

  async extractActiveNoteTasks() {
    const file = this.getActiveMarkdownNote();
    if (!file) { new Notice("Abre primero una nota en Obsidian."); return; }
    try {
      const content = (await this.app.vault.read(file)).trim();
      if (!content) { new Notice("La nota está vacía."); return; }
      new Notice(`Extrayendo tareas de "${file.basename}" con IA…`, 4000);
      const prompt = [
        "Actúa como gestor de tareas y productividad personal en Obsidian.",
        "Analiza la siguiente nota y extrae todas las tareas pendientes, acciones a realizar, compromisos, fechas y entregables.",
        "Formatea cada tarea en formato checklist Markdown: `- [ ] Tarea (detalle, contexto o fecha)`.",
        "Si la nota no contiene tareas explícitas, propón de 2 a 4 siguientes pasos concretos y accionables derivados del contenido.",
        "",
        `Nota: ${file.basename}`,
        "CONTENIDO:",
        content.slice(0, 32000)
      ].join("\n\n");
      const result = (await this.callAI(prompt, "Eres un asistente de organización y productividad.")).trim();
      new SistemaNoteAiResultModal(this.app, this, file, "Tareas pendientes", result, "tareas").open();
    } catch (err) {
      new Notice(`Error al extraer tareas: ${err.message}`, 8000);
    }
  }

  async generateActiveNoteStudy() {
    const file = this.getActiveMarkdownNote();
    if (!file) { new Notice("Abre primero una nota en Obsidian."); return; }
    try {
      const content = (await this.app.vault.read(file)).trim();
      if (!content) { new Notice("La nota está vacía."); return; }
      new Notice(`Generando preguntas de estudio para "${file.basename}"…`, 4000);
      const prompt = [
        "Actúa como profesor y tutor de estudio para Obsidian.",
        "A partir del contenido de esta nota, genera entre 3 y 6 preguntas clave de repaso / examen (tipo flashcards) con sus respectivas respuestas claras y concisas.",
        "Estructura cada pregunta así:",
        "**Pregunta:** [Pregunta conceptual o práctica]",
        "> **Respuesta:** [Explicación clara]",
        "",
        `Materia / Tema: ${file.basename}`,
        "CONTENIDO:",
        content.slice(0, 32000)
      ].join("\n\n");
      const result = (await this.callAI(prompt, "Eres un profesor y tutor interactivo.")).trim();
      new SistemaNoteAiResultModal(this.app, this, file, "Preguntas de repaso y examen", result, "estudio").open();
    } catch (err) {
      new Notice(`Error al generar preguntas: ${err.message}`, 8000);
    }
  }

  async explainActiveNote(query = "") {
    const file = this.getActiveMarkdownNote();
    if (!file) { new Notice("Abre primero una nota en Obsidian."); return; }
    try {
      const content = (await this.app.vault.read(file)).trim();
      new Notice(`Generando explicación con IA…`, 4000);
      const prompt = [
        "Actúa como un tutor y mentor didáctico.",
        query ? `Explica el siguiente concepto o duda en el contexto de la nota: "${query}".` : "Explica los conceptos principales de esta nota de forma didáctica, con analogías cotidianas, pasos sencillos y ejemplos prácticos para facilitar su comprensión.",
        "",
        `Nota: ${file.basename}`,
        "CONTENIDO:",
        content.slice(0, 32000)
      ].join("\n\n");
      const result = (await this.callAI(prompt, "Eres un tutor didáctico y paciente.")).trim();
      new SistemaNoteAiResultModal(this.app, this, file, query ? `Explicación: ${query}` : "Explicación didáctica", result, "explicar").open();
    } catch (err) {
      new Notice(`Error al explicar: ${err.message}`, 8000);
    }
  }

  async askFreeQueryAboutNote(file, query) {
    if (!query || !query.trim()) return;
    const targetFile = file || this.getActiveMarkdownNote();
    try {
      let content = "";
      if (targetFile && targetFile.path) {
        const abstract = this.app.vault.getAbstractFileByPath(targetFile.path);
        if (abstract instanceof TFile) {
          content = (await this.app.vault.read(abstract)).trim();
        }
      }
      new Notice("Consultando a la IA…", 4000);
      const prompt = [
        "Actúa como asistente personal de IA para Obsidian.",
        targetFile && targetFile.basename ? `El usuario está consultando sobre la nota "${targetFile.basename}".` : "El usuario está realizando una consulta.",
        content ? `CONTENIDO DE LA NOTA:\n${content.slice(0, 30000)}` : "",
        `PREGUNTA / INSTRUCCIÓN DEL USUARIO:\n${query.trim()}`,
        "Responde en español de forma útil, clara y directa. Si la respuesta contiene listas o pasos, dale formato Markdown limpio."
      ].join("\n\n");
      const result = (await this.callAI(prompt, "Eres un asistente inteligente para notas de Obsidian.")).trim();
      const title = query.length > 32 ? `${query.slice(0, 32)}…` : query;
      new SistemaNoteAiResultModal(this.app, this, targetFile || { basename: "Consulta libre", path: "" }, `Consulta: ${title}`, result, "consulta").open();
    } catch (err) {
      new Notice(`Error en la consulta: ${err.message}`, 8000);
    }
  }

  async ensureReminderFile() {
    const notePath = normalizePath(this.settings.reminderFile || DEFAULT_SETTINGS.reminderFile);
    const existing = this.app.vault.getAbstractFileByPath(notePath);
    if (existing instanceof TFile) return existing;
    const folder = notePath.includes("/") ? notePath.substring(0, notePath.lastIndexOf("/")) : "";
    await this.ensureFolder(folder);
    const initial = [
      "# Recordatorios",
      "",
      "> Aquí se reúnen los recordatorios creados desde cualquier nota. Marque `[x]` cuando termine.",
      "",
      "## Pendientes",
      "",
    ].join("\n");
    return this.app.vault.create(notePath, initial);
  }

  async addReminder(sourceFile, description, dueDate) {
    const cleanDescription = String(description || "").replace(/[\r\n]+/g, " ").trim();
    if (!cleanDescription) throw new Error("escribe qué necesitas recordar");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) throw new Error("selecciona una fecha válida");
    const reminderFile = await this.ensureReminderFile();
    const existing = await this.app.vault.read(reminderFile);
    const linkPath = sourceFile.path.replace(/\.md$/i, "");
    const task = `- [ ] ${dueDate} — ${cleanDescription} — [[${linkPath}|${sourceFile.basename}]]`;
    await this.app.vault.modify(reminderFile, existing.replace(/\s*$/, "") + "\n" + task + "\n");
    new Notice(`Recordatorio guardado para ${dueDate}.`, 7000);
  }

  async openReminders() {
    try {
      const file = await this.ensureReminderFile();
      await this.app.workspace.getLeaf(false).openFile(file);
    } catch (error) {
      new Notice(`No se pudieron abrir los recordatorios: ${error.message}`);
    }
  }

  async notifyDueReminders() {
    try {
      const today = this.todayIso();
      if (this.settings.lastReminderNotice === today) return;
      const file = await this.ensureReminderFile();
      const content = await this.app.vault.read(file);
      const pending = content.split(/\r?\n/).filter((line) => {
        const match = line.match(/^- \[ \] (\d{4}-\d{2}-\d{2}) —/);
        return match && match[1] <= today;
      });
      this.settings.lastReminderNotice = today;
      await this.saveData(this.settings);
      if (pending.length) {
        new Notice(`Tienes ${pending.length} recordatorio(s) para hoy o atrasados. Abre "Recordatorios".`, 10000);
      }
    } catch (error) {
      console.error(`${PLUGIN_ID}: no se pudieron revisar recordatorios`, error);
    }
  }

  todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  isTracked(file) {
    if (!(file instanceof TFile)) return false;
    const ext = (file.extension || "").toLowerCase();
    if (!TRACKED_EXTENSIONS.has(ext)) return false;
    const normalized = normalizePath(file.path);
    const summaries = normalizePath(this.settings.summaryFolder);
    if (normalized.startsWith(".obsidian/")) return false;
    if (normalized === summaries || normalized.startsWith(summaries + "/")) return false;
    return true;
  }

  async baselineExistingFiles() {
    const intakeFolder = normalizePath("07 - Recursos/00 - Por clasificar") + "/";
    for (const file of this.app.vault.getFiles()) {
      if (!this.isTracked(file)) continue;
      if (normalizePath(file.path).startsWith(intakeFolder)) continue;
      this.settings.processed[file.path] = {
        mtime: file.stat.mtime,
        size: file.stat.size,
        status: "anterior",
      };
    }
    this.settings.initialized = true;
    await this.saveData(this.settings);
    await this.processNewFiles(false);
  }

  async processNewFiles(showNotice) {
    const pending = this.app.vault.getFiles().filter((file) => {
      if (!this.isTracked(file)) return false;
      const previous = this.settings.processed[file.path];
      return !previous || previous.mtime !== file.stat.mtime || previous.size !== file.stat.size || previous.status === "error";
    });
    if (!pending.length) {
      if (showNotice) new Notice("No hay archivos nuevos pendientes de resumen.");
      return;
    }
    await this.processQueue(pending, showNotice);
  }

  async processAllExisting() {
    const files = this.app.vault.getFiles().filter((file) => this.isTracked(file));
    if (!files.length) {
      new Notice("No se encontraron archivos compatibles.");
      return;
    }
    new Notice(`Se procesarán ${files.length} archivos. Puede tardar unos momentos.`, 9000);
    await this.processQueue(files, true, true);
  }

  async processQueue(files, showNotice, force = false) {
    if (this.processing) {
      this.queueRequested = true;
      if (showNotice) new Notice("Ya hay un proceso activo; los archivos quedarán en cola.");
      return;
    }
    this.processing = true;
    let completed = 0;
    let failed = 0;
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        try {
          await this.processFileInternal(file, force);
          completed += 1;
        } catch (error) {
          console.error(`${PLUGIN_ID}:`, error);
          failed += 1;
        }
        if (i < files.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
        }
      }
    } finally {
      this.processing = false;
      if (showNotice) {
        new Notice(`Procesamiento finalizado: ${completed} completado(s), ${failed} pendiente(s).`, 9000);
      }
      if (this.queueRequested) {
        this.queueRequested = false;
        window.setTimeout(() => this.processNewFiles(false), 1000);
      }
    }
  }

  async processSingleFile(file, force) {
    if (this.processing) {
      this.queueRequested = true;
      return;
    }
    this.processing = true;
    try {
      await this.processFileInternal(file, force);
      if (force) new Notice(`Resumen listo: ${file.name}`, 5000);
    } catch (error) {
      console.error(`${PLUGIN_ID}:`, error);
      if (force) new Notice(`No se pudo resumir ${file.name}: ${error.message}`, 8000);
    } finally {
      this.processing = false;
      if (this.queueRequested) {
        this.queueRequested = false;
        window.setTimeout(() => this.processNewFiles(false), 900);
      }
    }
  }

  normalizeForMatch(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim();
  }

  detectAcademicSubjects() {
    const root = "02 - Universidad";
    const groups = new Map();
    const markdown = this.app.vault.getMarkdownFiles();
    const allFiles = this.app.vault.getFiles();

    const addFolder = (folderPath) => {
      const normalized = normalizePath(folderPath || "");
      if (!normalized.startsWith(root + "/")) return;
      const parts = normalized.split("/");
      if (parts.length < 3) return;
      const institution = parts[1] || "";
      if (!institution || /^planes? de estudio$/i.test(institution)) return;
      const folderName = parts[parts.length - 1] || "";
      if (!folderName || /^planes? de estudio$/i.test(folderName)) return;
      const period = parts.slice(2, -1).join(" / ");
      if (!groups.has(normalized)) groups.set(normalized, { folderPath: normalized, folderName, institution, period });
    };

    for (const file of markdown) {
      const normalized = normalizePath(file.path);
      if (!normalized.startsWith(root + "/") || !file.parent) continue;
      if (/(?: - |\b)(Tareas|Parciales|Apuntes|F[oó]rmulas|Conceptos|Ejercicios)(?:\b| y )/i.test(file.basename)) {
        addFolder(file.parent.path);
      }
      if (/ - Inicio$/i.test(file.basename)) {
        const cache = this.app.metadataCache.getFileCache(file);
        const type = this.normalizeForMatch(cache && cache.frontmatter ? (cache.frontmatter.tipo || cache.frontmatter.type || "") : "");
        if (type === "materia" || type === "curso" || type === "subject") addFolder(file.parent.path);
      }
    }

    return [...groups.values()].map((group) => {
      const prefix = group.folderPath + "/";
      const home = markdown.find((file) =>
        normalizePath(file.path).startsWith(prefix) &&
        file.parent && normalizePath(file.parent.path) === group.folderPath &&
        / - Inicio$/i.test(file.basename)
      );
      const name = (home ? home.basename.replace(/ - Inicio$/i, "") : group.folderName).trim();
      const aliases = [...new Set([name, group.folderName].map((value) => this.normalizeForMatch(value)).filter(Boolean))];
      return {
        ...group,
        name,
        aliases,
        files: allFiles.filter((file) => normalizePath(file.path).startsWith(prefix)),
      };
    }).sort((a, b) =>
      a.institution.localeCompare(b.institution, "es") ||
      a.name.localeCompare(b.name, "es")
    );
  }

  subjectFromPath(file, subjects) {
    const normalized = normalizePath(file.path || "");
    return subjects.find((subject) => normalized.startsWith(subject.folderPath + "/")) || null;
  }

  async classifyAcademicDocument(file, summary) {
    const subjects = this.detectAcademicSubjects();
    if (!subjects.length) return { academic: false, subject: "" };
    const direct = this.subjectFromPath(file, subjects);
    if (direct) return { academic: true, subject: direct.name };
    const haystack = this.normalizeForMatch(`${file.name}\n${summary}`);
    const exact = subjects.find((subject) => subject.aliases.some((alias) => alias && haystack.includes(alias)));
    if (exact) return { academic: true, subject: exact.name };

    try {
      const prompt = [
        "Clasifica un documento para una bóveda educativa con una o varias instituciones.",
        "Elige exactamente UNA materia de la lista o responde NINGUNA.",
        "No expliques tu respuesta. No inventes una materia nueva.",
        `MATERIAS: ${subjects.map((item) => `${item.institution}: ${item.name}`).join(" | ")}`,
        `DOCUMENTO: ${file.name}`,
        "RESUMEN:",
        String(summary || "").slice(0, 4500),
      ].join("\n\n");
      const answer = (await this.callAI(prompt)).trim();
      const normalized = this.normalizeForMatch(answer);
      const selected = subjects.find((subject) => subject.aliases.some((alias) => normalized === alias || normalized.includes(alias)));
      return selected ? { academic: true, subject: selected.name } : { academic: false, subject: "" };
    } catch (_) {
      return { academic: false, subject: "" };
    }
  }

  triggerStudyRefresh(academic) {
    if (!academic) return;
    window.setTimeout(() => {
      try { this.app.commands.executeCommandById("control-center:actualizar-estudio-automatico"); } catch (_) {}
    }, 450);
  }

  async processFileInternal(file, force) {
    const current = this.app.vault.getAbstractFileByPath(file.path);
    if (!(current instanceof TFile)) return;
    if (!force) {
      const previous = this.settings.processed[file.path];
      if (previous && previous.mtime === file.stat.mtime && previous.size === file.stat.size && previous.status !== "error") return;
    }

    await this.ensureFolder(this.settings.summaryFolder);
    const notePath = await this.resolveNotePath(file);
    await this.writeAutomaticNote(file, notePath, "Procesando el documento con IA…", "procesando");

    const extension = file.extension.toLowerCase();
    if (CARD_ONLY_EXTENSIONS.has(extension)) {
      const message = "Se creó la ficha y el enlace al archivo. Este tipo de archivo no contiene texto procesable.";
      const subjects = this.detectAcademicSubjects();
      const direct = this.subjectFromPath(file, subjects);
      const classification = direct ? { academic: true, subject: direct.name } : { academic: false, subject: "" };
      await this.writeAutomaticNote(file, notePath, message, "ficha", classification);
      this.settings.processed[file.path] = this.recordFor(file, notePath, "ficha");
      await this.saveData(this.settings);
      this.triggerStudyRefresh(classification.academic);
      return;
    }

    try {
      const text = await this.extractText(file);
      if (!text || text.trim().length < 40) {
        throw new Error("no se encontró texto legible en el archivo");
      }
      const summary = await this.summarizeText(text, file.name);
      const classification = await this.classifyAcademicDocument(file, summary);
      await this.writeAutomaticNote(file, notePath, summary, "completado", classification);
      this.settings.processed[file.path] = this.recordFor(file, notePath, "completado");
      await this.saveData(this.settings);
      this.triggerStudyRefresh(classification.academic);
    } catch (error) {
      const message = `> [!warning] Resumen pendiente\n> ${this.escapeMarkdown(error.message)}\n\nPuede volver a intentar ejecutando el comando **IA de bóveda: Procesar archivos nuevos y pendientes**.`;
      await this.writeAutomaticNote(file, notePath, message, "error");
      this.settings.processed[file.path] = this.recordFor(file, notePath, "error");
      await this.saveData(this.settings);
      throw error;
    }
  }

  recordFor(file, notePath, status) {
    return {
      mtime: file.stat.mtime,
      size: file.stat.size,
      notePath,
      status,
      processedAt: new Date().toISOString(),
    };
  }

  async extractText(file) {
    const extension = file.extension.toLowerCase();
    if (TEXT_EXTENSIONS.has(extension)) {
      return (await this.app.vault.read(file)).slice(0, this.settings.maxCharacters);
    }
    if (extension === "pdf") return this.extractPdf(file);
    if (extension === "docx") return this.extractDocx(file);
    if (extension === "pptx") return this.extractPptx(file);
    if (extension === "xlsx") return this.extractXlsx(file);
    return "";
  }

  async loadPdfJs() {
    if (this.pdfjs) return this.pdfjs;
    if (!Uint8Array.prototype.toHex) {
      Object.defineProperty(Uint8Array.prototype, "toHex", {
        value: function toHex() { return Buffer.from(this).toString("hex"); },
        configurable: true,
      });
    }
    if (!Uint8Array.prototype.toBase64) {
      Object.defineProperty(Uint8Array.prototype, "toBase64", {
        value: function toBase64() { return Buffer.from(this).toString("base64"); },
        configurable: true,
      });
    }
    if (!Uint8Array.fromBase64) {
      Uint8Array.fromBase64 = (value) => Uint8Array.from(Buffer.from(value, "base64"));
    }
    const workerSource = fs.readFileSync(this.vendorPath("pdf.worker.mjs"), "utf8");
    const workerUrl = "data:text/javascript;base64," + Buffer.from(workerSource, "utf8").toString("base64");
    globalThis.pdfjsWorker = await import(workerUrl);

    const pdfSource = fs.readFileSync(this.vendorPath("pdf.mjs"), "utf8");
    const pdfUrl = "data:text/javascript;base64," + Buffer.from(pdfSource, "utf8").toString("base64");
    this.pdfjs = await import(pdfUrl);
    return this.pdfjs;
  }

  loadJsZip() {
    if (this.jszip) return this.jszip;
    this.jszip = require(this.vendorPath("jszip.min.js"));
    return this.jszip;
  }

  vendorPath(fileName) {
    const adapter = this.app.vault.adapter;
    if (!adapter || typeof adapter.getBasePath !== "function") {
      throw new Error("la bóveda no ofrece acceso local a sus archivos");
    }
    const pluginDirectory = this.manifest.dir || `.obsidian/plugins/${PLUGIN_ID}`;
    return path.join(adapter.getBasePath(), pluginDirectory, "vendor", fileName);
  }

  async extractPdf(file) {
    const pdfjs = await this.loadPdfJs();
    const data = new Uint8Array(await this.app.vault.readBinary(file));
    const document = await pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false }).promise;
    let result = "";
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      result += `\n\n[Página ${pageNumber}]\n` + content.items.map((item) => item.str || "").join(" ");
      if (result.length >= this.settings.maxCharacters) break;
    }
    return result.slice(0, this.settings.maxCharacters);
  }

  async extractDocx(file) {
    const zip = await this.loadJsZip().loadAsync(await this.app.vault.readBinary(file));
    const parts = ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"];
    let result = "";
    for (const part of parts) {
      if (zip.file(part)) result += "\n" + this.xmlToText(await zip.file(part).async("string"), ["w:p", "w:tr"]);
    }
    return result.slice(0, this.settings.maxCharacters);
  }

  async extractPptx(file) {
    const zip = await this.loadJsZip().loadAsync(await this.app.vault.readBinary(file));
    const slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => this.numberFromName(a) - this.numberFromName(b));
    let result = "";
    for (const slideName of slideNames) {
      const number = this.numberFromName(slideName);
      result += `\n\n[Diapositiva ${number}]\n` + this.xmlToText(await zip.file(slideName).async("string"), ["a:p"]);
      if (result.length >= this.settings.maxCharacters) break;
    }
    return result.slice(0, this.settings.maxCharacters);
  }

  async extractXlsx(file) {
    const zip = await this.loadJsZip().loadAsync(await this.app.vault.readBinary(file));
    let shared = [];
    if (zip.file("xl/sharedStrings.xml")) {
      const sharedXml = await zip.file("xl/sharedStrings.xml").async("string");
      const matches = sharedXml.match(/<si\b[^>]*>[\s\S]*?<\/si>/gi) || [];
      shared = matches.map((item) => this.xmlToText(item, []));
    }
    const sheets = Object.keys(zip.files)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort((a, b) => this.numberFromName(a) - this.numberFromName(b));
    let result = "";
    for (const sheetName of sheets) {
      const sheetXml = await zip.file(sheetName).async("string");
      const rows = sheetXml.match(/<row\b[^>]*>[\s\S]*?<\/row>/gi) || [];
      result += `\n\n[Hoja ${this.numberFromName(sheetName)}]\n`;
      for (const row of rows) {
        const values = [];
        const cells = row.match(/<c\b[^>]*>[\s\S]*?<\/c>/gi) || [];
        for (const cell of cells) {
          const opening = (cell.match(/^<c\b[^>]*>/i) || [""])[0];
          const typeMatch = opening.match(/\bt=["']([^"']+)["']/i);
          const type = typeMatch ? typeMatch[1] : "";
          const inlineMatch = cell.match(/<is\b[^>]*>([\s\S]*?)<\/is>/i);
          const valueMatch = cell.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
          let value = inlineMatch ? this.xmlToText(inlineMatch[1], []) : valueMatch ? this.decodeXml(valueMatch[1]) : "";
          if (type === "s" && value !== "" && shared[Number(value)] !== undefined) value = shared[Number(value)];
          if (value !== "") values.push(value);
        }
        if (values.length) result += values.join(" | ") + "\n";
        if (result.length >= this.settings.maxCharacters) break;
      }
      if (result.length >= this.settings.maxCharacters) break;
    }
    return result.slice(0, this.settings.maxCharacters);
  }

  xmlToText(xml, paragraphTags) {
    let prepared = xml;
    for (const tag of paragraphTags) {
      const escaped = tag.replace(":", "\\:");
      prepared = prepared.replace(new RegExp(`</${escaped}>`, "gi"), (match) => match + "\n");
    }
    return this.decodeXml(prepared.replace(/<[^>]+>/g, ""))
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();
  }

  decodeXml(value) {
    return String(value)
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  numberFromName(name) {
    const match = name.match(/(\d+)(?=\.xml$)/i);
    return match ? Number(match[1]) : 0;
  }

  async summarizeText(text, fileName) {
    const clean = text.replace(/\u0000/g, " ").trim().slice(0, this.settings.maxCharacters);
    const provider = this.settings.provider || "gemini";

    if (provider === "gemini") {
      const prompt = [
        `Documento a analizar: "${fileName}"`,
        "Crea un resumen estructurado en español usando exactamente estas secciones Markdown:",
        "## Resumen",
        "## Puntos importantes",
        "## Fechas y cifras",
        "## Tareas o pendientes",
        "## Dudas o aspectos para revisar",
        "",
        "CONTENIDO DEL DOCUMENTO:",
        clean,
      ].join("\n\n");
      const system = "Eres un asistente de organización y síntesis documental para una bóveda personal de Obsidian. Resume de forma fiel, sin inventar datos ni agregar información externa.";
      return this.callGemini(prompt, system);
    } else {
      const chunks = this.chunkText(clean, 9000);
      const partials = [];
      for (let index = 0; index < chunks.length; index += 1) {
        const prompt = [
          "Eres un asistente que organiza documentos para una bóveda personal de Obsidian.",
          "Resume únicamente lo que aparece en el contenido. No inventes datos ni completes información ausente.",
          `Documento: ${fileName}`,
          `Parte ${index + 1} de ${chunks.length}.`,
          "Devuelve en español: tema central, puntos importantes, fechas o cifras, tareas o pendientes y dudas que conviene revisar.",
          "Usa Markdown breve y claro.",
          "CONTENIDO:",
          chunks[index],
        ].join("\n\n");
        partials.push(await this.callOllama(prompt));
      }

      if (partials.length === 1) return partials[0].trim();

      const finalPrompt = [
        "Combina los siguientes resúmenes parciales en un solo resumen fiel y sin repeticiones.",
        "No inventes información. Escribe en español y usa exactamente estas secciones:",
        "## Resumen", "## Puntos importantes", "## Fechas y cifras", "## Tareas o pendientes", "## Dudas para revisar",
        `Documento: ${fileName}`,
        "RESÚMENES PARCIALES:",
        partials.join("\n\n---\n\n"),
      ].join("\n\n");
      return (await this.callOllama(finalPrompt)).trim();
    }
  }

  chunkText(text, maxLength) {
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLength && chunks.length < 7) {
      let splitAt = remaining.lastIndexOf("\n", maxLength);
      if (splitAt < maxLength * 0.55) splitAt = remaining.lastIndexOf(". ", maxLength);
      if (splitAt < maxLength * 0.55) splitAt = maxLength;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining && chunks.length < 8) chunks.push(remaining.slice(0, maxLength).trim());
    return chunks.filter(Boolean);
  }

  async resolveNotePath(file) {
    const existing = this.settings.processed[file.path];
    if (existing && existing.notePath) return existing.notePath;

    const base = this.sanitizeFileName(file.basename) || "Archivo";
    let candidate = normalizePath(`${this.settings.summaryFolder}/${base} - Resumen.md`);
    const current = this.app.vault.getAbstractFileByPath(candidate);
    if (!current) return candidate;

    const content = current instanceof TFile ? await this.app.vault.read(current) : "";
    if (content.includes(`archivo_original: "${this.escapeYaml(file.path)}"`)) return candidate;
    return normalizePath(`${this.settings.summaryFolder}/${base} - Resumen ${this.shortHash(file.path)}.md`);
  }

  async writeAutomaticNote(file, notePath, body, status, classification = {}) {
    const activeModel = this.settings.provider === "gemini" ? (this.settings.geminiModel || "gemini-2.0-flash") : (this.settings.model || "llama3.2");
    const frontmatter = [
      "---",
      `archivo_original: "${this.escapeYaml(file.path)}"`,
      `tipo: "${this.escapeYaml(file.extension.toUpperCase())}"`,
      `estado_ia: "${this.escapeYaml(status)}"`,
      `proveedor_ia: "${this.escapeYaml(this.settings.provider || "gemini")}"`,
      `modelo_ia: "${this.escapeYaml(activeModel)}"`,
      `academico: ${classification.academic ? "true" : "false"}`,
      `materia_detectada: "${this.escapeYaml(classification.subject || "")}"`,
      `actualizado: "${new Date().toISOString()}"`,
      "---",
    ].join("\n");
    const automaticBlock = [
      AUTO_START,
      "",
      `# ${this.escapeHeading(file.basename)} — Resumen`,
      "",
      `**Archivo original:** [[${file.path}]]`,
      "",
      body,
      "",
      AUTO_END,
    ].join("\n");
    const generated = frontmatter + "\n" + automaticBlock;

    const existing = this.app.vault.getAbstractFileByPath(notePath);
    if (existing instanceof TFile) {
      const current = await this.app.vault.read(existing);
      const start = current.indexOf(AUTO_START);
      const end = current.indexOf(AUTO_END);
      let next;
      if (start >= 0 && end >= start) {
        next = generated + current.slice(end + AUTO_END.length);
      } else {
        next = generated + "\n\n## Mis notas\n\n" + current;
      }
      await this.app.vault.modify(existing, next);
    } else {
      await this.ensureFolder(notePath.substring(0, notePath.lastIndexOf("/")));
      await this.app.vault.create(notePath, generated + "\n\n## Mis notas\n\n");
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
        try { await this.app.vault.createFolder(current); } catch (_) {}
      }
    }
  }

  sanitizeFileName(value) {
    return String(value).replace(/[\\/:*?"<>|#\[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  shortHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).slice(0, 8);
  }

  escapeYaml(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  }

  escapeHeading(value) {
    return String(value).replace(/[\r\n]+/g, " ").trim();
  }

  escapeMarkdown(value) {
    return String(value).replace(/[\r\n]+/g, " ").replace(/>/g, "\\>");
  }
};

class VaultAiSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "IA de bóveda" });
    containerEl.createEl("p", {
      text: "Procesamiento inteligente de notas y documentos mediante Google Gemini o servidor local Ollama.",
    });

    new Setting(containerEl)
      .setName("Proveedor de IA")
      .setDesc("Elija entre Google Gemini (recomendado, rápido y disponible en móvil) u Ollama (local y offline en PC).")
      .addDropdown((dropdown) => dropdown
        .addOption("gemini", "Google Gemini (Recomendado)")
        .addOption("ollama", "Ollama Local (Offline)")
        .setValue(this.plugin.settings.provider || "gemini")
        .onChange(async (value) => {
          this.plugin.settings.provider = value;
          await this.plugin.saveData(this.plugin.settings);
          this.display();
        }));

    if (this.plugin.settings.provider === "gemini") {
      new Setting(containerEl)
        .setName("Google Gemini API Key")
        .setDesc("Clave de API gratuita obtenida en Google AI Studio (aistudio.google.com). Se almacena exclusivamente de forma local.")
        .addText((text) => {
          text.inputEl.type = "password";
          text
            .setPlaceholder("AIzaSy...")
            .setValue(this.plugin.settings.geminiApiKey || "")
            .onChange(async (value) => {
              this.plugin.settings.geminiApiKey = value.trim();
              await this.plugin.saveData(this.plugin.settings);
            });
        });

      new Setting(containerEl)
        .setName("Modelo de Google Gemini")
        .setDesc("Recomendado: gemini-3.6-flash para respuestas rápidas con cuota estable de producción.")
        .addDropdown((dropdown) => dropdown
          .addOption("gemini-3.6-flash", "gemini-3.6-flash (Recomendado - Estable y rápido)")
          .addOption("gemini-3.1-flash-lite", "gemini-3.1-flash-lite (Ultra liviano y rápido)")
          .addOption("gemini-3.8-flash", "gemini-3.8-flash (Preview - Cuota estricta de 5 req/min)")
          .addOption("gemini-pro-latest", "gemini-pro-latest (Último Pro - Razonamiento)")
          .setValue(this.plugin.settings.geminiModel || "gemini-3.6-flash")
          .onChange(async (value) => {
            this.plugin.settings.geminiModel = value;
            await this.plugin.saveData(this.plugin.settings);
          }));
    } else {
      new Setting(containerEl)
        .setName("Modelo local de Ollama")
        .setDesc("Modelo instalado en Ollama. Recomendado: llama3.2")
        .addText((text) => text
          .setPlaceholder("llama3.2")
          .setValue(this.plugin.settings.model || "llama3.2")
          .onChange(async (value) => {
            this.plugin.settings.model = value.trim() || "llama3.2";
            await this.plugin.saveData(this.plugin.settings);
          }));

      new Setting(containerEl)
        .setName("URL de Ollama")
        .setDesc("Dirección del servidor local de Ollama.")
        .addText((text) => text
          .setPlaceholder("http://127.0.0.1:11434")
          .setValue(this.plugin.settings.ollamaUrl || "http://127.0.0.1:11434")
          .onChange(async (value) => {
            this.plugin.settings.ollamaUrl = value.trim() || "http://127.0.0.1:11434";
            await this.plugin.saveData(this.plugin.settings);
          }));
    }

    new Setting(containerEl)
      .setName("Probar conexión de IA")
      .setDesc("Verifica si el proveedor y modelo configurados responden correctamente.")
      .addButton((button) => button
        .setButtonText("Probar conexión")
        .onClick(async () => {
          button.disabled = true;
          button.setButtonText("Probando…");
          try {
            const res = await this.plugin.assertAIAvailable();
            new Notice(`Conexión exitosa con ${res.label}: ${res.detail}`, 7000);
          } catch (err) {
            new Notice(`Error de conexión: ${err.message}`, 9000);
          } finally {
            button.disabled = false;
            button.setButtonText("Probar conexión");
          }
        }));

    new Setting(containerEl)
      .setName("Resumir archivos nuevos automáticamente")
      .setDesc("Procesa los archivos que aparezcan en la bóveda después de sincronizarse.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoProcess)
        .onChange(async (value) => {
          this.plugin.settings.autoProcess = value;
          await this.plugin.saveData(this.plugin.settings);
        }));

    new Setting(containerEl)
      .setName("Carpeta de resúmenes")
      .setDesc("No se mueven los documentos originales.")
      .addText((text) => text
        .setValue(this.plugin.settings.summaryFolder)
        .onChange(async (value) => {
          this.plugin.settings.summaryFolder = normalizePath(value.trim() || DEFAULT_SETTINGS.summaryFolder);
          await this.plugin.saveData(this.plugin.settings);
        }));

    new Setting(containerEl)
      .setName("Procesar pendientes ahora")
      .setDesc("Busca archivos nuevos o que fallaron anteriormente.")
      .addButton((button) => button.setButtonText("Procesar").onClick(() => this.plugin.processNewFiles(true)));

    new Setting(containerEl)
      .setName("Sugerir apoyo para la nota activa")
      .setDesc("La IA propone qué completar, enlaces, notas nuevas y recordatorios.")
      .addButton((button) => button.setButtonText("Sugerir apoyo").onClick(() => {
        const file = this.plugin.getActiveMarkdownNote();
        if (file) this.plugin.suggestSupportForNote(file);
        else new Notice("Abre primero una nota de Obsidian.");
      }));

    new Setting(containerEl)
      .setName("Mis recordatorios")
      .setDesc("Abre la lista central de notas por llenar, completar o crear.")
      .addButton((button) => button.setButtonText("Abrir").onClick(() => this.plugin.openReminders()));
  }
}

class SistemaSupportModal extends Modal {
  constructor(app, plugin, file, support) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.support = support;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sistema-support-modal");
    contentEl.createEl("h2", { text: `Apoyo para "${this.file.basename}"` });
    contentEl.createEl("p", {
      cls: "sistema-support-intro",
      text: "La IA generó estas sugerencias. Nada se agrega ni se programa hasta que usted lo elija.",
    });
    const result = contentEl.createEl("div", { cls: "sistema-support-result" });
    result.createEl("pre", { text: this.support });

    const buttons = contentEl.createEl("div", { cls: "sistema-support-actions" });
    const addButton = buttons.createEl("button", { cls: "mod-cta", text: "Agregar apoyo a la nota" });
    addButton.addEventListener("click", async () => {
      addButton.disabled = true;
      try {
        await this.plugin.appendSupportToNote(this.file, this.support);
        this.close();
      } catch (error) {
        new Notice(`No se pudo agregar el apoyo: ${error.message}`);
        addButton.disabled = false;
      }
    });

    const reminderButton = buttons.createEl("button", { text: "Crear recordatorio" });
    reminderButton.addEventListener("click", () => {
      this.close();
      new SistemaReminderModal(this.app, this.plugin, this.file).open();
    });

    const closeButton = buttons.createEl("button", { text: "Cerrar" });
    closeButton.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

class SistemaReminderModal extends Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin = plugin;
    this.file = file;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sistema-reminder-modal");
    contentEl.createEl("h2", { text: "Crear recordatorio" });
    contentEl.createEl("p", { text: `Quedará enlazado con "${this.file.basename}".` });

    const descriptionLabel = contentEl.createEl("label", { text: "¿Qué necesita recordar?" });
    const description = contentEl.createEl("textarea", { cls: "sistema-reminder-description" });
    description.setAttr("rows", "3");
    description.value = `Revisar y completar: ${this.file.basename}`;
    descriptionLabel.setAttr("for", "sistema-reminder-description");
    description.id = "sistema-reminder-description";

    const dateLabel = contentEl.createEl("label", { text: "Fecha" });
    const date = contentEl.createEl("input", { type: "date", cls: "sistema-reminder-date" });
    dateLabel.setAttr("for", "sistema-reminder-date");
    date.id = "sistema-reminder-date";
    date.value = this.plugin.todayIso();

    const buttons = contentEl.createEl("div", { cls: "sistema-support-actions" });
    const saveButton = buttons.createEl("button", { cls: "mod-cta", text: "Guardar recordatorio" });
    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      try {
        await this.plugin.addReminder(this.file, description.value, date.value);
        this.close();
      } catch (error) {
        new Notice(`No se pudo guardar: ${error.message}`);
        saveButton.disabled = false;
      }
    });
    const cancelButton = buttons.createEl("button", { text: "Cancelar" });
    cancelButton.addEventListener("click", () => this.close());
    window.setTimeout(() => description.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class SistemaNoteAiResultModal extends Modal {
  constructor(app, plugin, file, title, result, actionType, hasSelection = false) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.title = title;
    this.result = result;
    this.actionType = actionType;
    this.hasSelection = hasSelection;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sistema-note-ai-modal");

    const header = contentEl.createDiv({ cls: "sistema-note-ai-modal-header" });
    const titleBox = header.createDiv({ cls: "sistema-note-ai-modal-title" });
    titleBox.createEl("span", { cls: "sistema-eyebrow", text: "ASISTENTE IA & NOTAS" });
    titleBox.createEl("h2", { text: this.title });
    if (this.file && this.file.basename) {
      titleBox.createEl("small", { text: `Nota: ${this.file.basename}` });
    }

    const resultBox = contentEl.createDiv({ cls: "sistema-note-ai-result-box" });
    const textEl = resultBox.createEl("div", { cls: "sistema-note-ai-result-text" });
    textEl.setText(this.result);

    const actions = contentEl.createDiv({ cls: "sistema-note-ai-actions" });

    if (this.hasSelection) {
      const replaceBtn = actions.createEl("button", { cls: "mod-cta", text: "🔄 Reemplazar selección" });
      replaceBtn.addEventListener("click", () => {
        if (this.plugin.replaceSelectionInActiveEditor(this.result)) {
          this.close();
        }
      });
    }

    if (this.file && this.file.path) {
      const appendBtn = actions.createEl("button", { cls: this.hasSelection ? "" : "mod-cta", text: "➕ Insertar al final" });
      appendBtn.addEventListener("click", async () => {
        appendBtn.disabled = true;
        try {
          await this.plugin.appendContentToNote(this.file, this.title, this.result);
          this.close();
        } catch (err) {
          new Notice(`No se pudo insertar: ${err.message}`);
          appendBtn.disabled = false;
        }
      });
    }

    const copyBtn = actions.createEl("button", { text: "📋 Copiar texto" });
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(this.result);
        new Notice("Copiado al portapapeles.", 3000);
      } catch (_) {
        new Notice("Texto seleccionado para copiar manualmente.");
      }
    });

    const closeBtn = actions.createEl("button", { text: "✕ Cerrar" });
    closeBtn.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

