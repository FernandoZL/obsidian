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
  const files = [{path:'02 - Universidad/Apuntes/Disponible.md',basename:'Disponible',stat:{}},{path:'09 - Memoria IA/Sesiones/No descargada.md',basename:'No descargada',stat:{}}];
  const handlers={};
  const app = { vault: { on(event,handler) {handlers[event]=handler;}, getMarkdownFiles: () => files, cachedRead: async file => { if(file.path.startsWith('09 -')) throw new Error('iCloud no disponible'); return '# Un apunte disponible'; }, adapter: { read: async () => JSON.stringify({ geminiModel: 'modelo-conservado', geminiApiKey: 'synthetic-test-key' }) } }, workspace: { onLayoutReady: callback => ready = callback, getLeavesOfType: () => [] } };
  const plugin = new context.module.exports(app); await plugin.onload(); await ready();
  assert.equal(saved.ai.profiles.gemini.model, 'modelo-conservado'); assert.ok(imports.length > 0); assert.ok(imports.every(name => name === 'obsidian'));
  assert.equal(plugin.workspaceData.documents.length,1); assert.ok(plugin.workspaceData.errors.includes(files[1].path));
  const { renderBundle } = require('../src/memory/format');
  const grouped = { path: '09 - Memoria IA/Sesiones/Conversación.md', basename: 'Conversación', stat: {} };
  const previousRead = app.vault.cachedRead;
  app.vault.cachedRead = async file => file === grouped ? renderBundle([{ neuronas: 1, id: 'uno', type: 'session', content: 'Pregunta', attribution: 'user' }, { neuronas: 1, id: 'dos', type: 'session', content: 'Respuesta', attribution: 'assistant' }], 'Chat') : previousRead(file);
  files.push(grouped); await plugin.refresh();
  assert.equal(plugin.records.length, 2);
  assert.ok(plugin.records.every(record => record.path.startsWith(grouped.path + '#^neuronas-')));
  const added = {path:'00 - Inbox/Nueva.md',basename:'Nueva',stat:{mtime:2}};
  files.push(added);handlers.create(added);await new Promise(resolve=>setTimeout(resolve,600));assert.ok(plugin.networkRecords.some(r=>r.path==='00 - Inbox/Nueva.md'));
  added.path='00 - Inbox/Renombrada.md';handlers.rename(added);await new Promise(resolve=>setTimeout(resolve,600));assert.ok(plugin.networkRecords.some(r=>r.path.endsWith('Renombrada.md')));assert.ok(!plugin.networkRecords.some(r=>r.path.endsWith('Nueva.md')));
});
