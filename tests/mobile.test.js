const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('el complemento empaquetado inicia en entorno móvil sin cargar módulos de Node', async () => {
  let ready, saved; const imports = [];
  class Base { constructor(app) { this.app = app; } async loadData() { return { openOnStart: false }; } async saveData(value) { saved = value; } registerView() {} addRibbonIcon() {} addCommand() {} addSettingTab() {} registerEvent() {} register() {} }
  const api = { Plugin: Base, ItemView: Base, Modal: Base, Notice: Base, Setting: Base, PluginSettingTab: Base, MarkdownRenderer: {}, Platform: { isDesktopApp: false }, requestUrl: () => { throw new Error('No se debe llamar una API al iniciar'); } };
  const context = { module: { exports: {} }, exports: {}, require: name => { imports.push(name); if (name !== 'obsidian') throw new Error('Node no disponible en móvil: ' + name); return api; }, console, setTimeout, clearTimeout, URL };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../dist/main.js'), 'utf8'), context);
  const app = { vault: { on() {}, getMarkdownFiles: () => [], adapter: { read: async () => JSON.stringify({ geminiModel: 'modelo-conservado', geminiApiKey: 'synthetic-test-key' }) } }, workspace: { onLayoutReady: callback => ready = callback, getLeavesOfType: () => [] } };
  const plugin = new context.module.exports(app); await plugin.onload(); await ready();
  assert.equal(saved.ai.profiles.gemini.model, 'modelo-conservado'); assert.deepEqual(imports, ['obsidian']);
});
