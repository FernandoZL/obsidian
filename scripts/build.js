'use strict';
const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');
async function build() {
  const root = path.resolve(__dirname, '..'), output = path.join(root, 'dist');
  await fs.mkdir(output, { recursive: true });
  await esbuild.build({ entryPoints: [path.join(root, 'obsidian-plugin/main.js')], outfile: path.join(output, 'main.js'), bundle: true, platform: 'browser', format: 'cjs', target: 'es2020', external: ['obsidian', 'node:*'], plugins: [{ name: 'shared-memory', setup(api) { api.onResolve({ filter: /^\.\/lib\// }, args => ({ path: path.join(root, 'src', args.path.slice(6) + '.js') })); } }] });
  for (const name of ['manifest.json', 'styles.css']) await fs.copyFile(path.join(root, 'obsidian-plugin', name), path.join(output, name));
  await fs.appendFile(path.join(output, 'styles.css'), '\n' + await fs.readFile(path.join(root, 'obsidian-plugin/workbench.css'), 'utf8'));
}
if (require.main === module) build().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { build };
