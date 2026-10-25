'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {zipEntries}=require('./archive');
async function release(root=path.resolve(__dirname,'..')){
  await require('./build').build();
  const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')),manifest=JSON.parse(await fs.readFile(path.join(root,'dist/manifest.json'),'utf8')),version=(await fs.readFile(path.join(root,'VERSION'),'utf8')).trim();
  if(pkg.version!==manifest.version||version!==pkg.version)throw new Error('VERSION, package.json y manifest.json deben coincidir');
  const entries=[];async function collect(relative){if(/(?:^|\/)__pycache__(?:\/|$)|\.pyc$/.test(relative))return;const file=path.join(root,relative),stat=await fs.lstat(file);if(stat.isSymbolicLink())throw new Error('No se incluyen enlaces simbólicos en la entrega');if(stat.isDirectory()){for(const name of await fs.readdir(file))await collect(relative+'/'+name);}else{if(/(?:^|\/)(?:data\.json|workspace[^/]*\.json|\.env|node_modules|\.git)(?:\/|$)/.test(relative))throw new Error('Archivo privado inesperado en la entrega: '+relative);entries.push({name:'Neuronas/'+relative,data:await fs.readFile(file)});}}
  for(const name of ['src','bin','dist','scripts','vendor','docs','README.md','LICENSE','VERSION','INSTALAR.bat','package.json','package-lock.json'])await collect(name);
  const plugin=[];for(const name of ['main.js','styles.css','manifest.json'])plugin.push({name:'neuronas/'+name,data:await fs.readFile(path.join(root,'dist',name))});plugin.push({name:'neuronas/LICENSE',data:await fs.readFile(path.join(root,'LICENSE'))});
  const output=path.join(root,'release');await fs.mkdir(output,{recursive:true});
  const full=zipEntries(entries);
  const artifacts=[{name:`Neuronas-${version}-Plugin.zip`,data:zipEntries(plugin)},{name:`Neuronas-${version}-Windows.zip`,data:full},{name:`Neuronas-${version}-Linux.zip`,data:full}];
  for(const item of artifacts)await fs.writeFile(path.join(output,item.name),item.data);
  const sums=artifacts.map(item=>createHash('sha256').update(item.data).digest('hex')+'  '+item.name).join('\n')+'\n';await fs.writeFile(path.join(output,'SHA256SUMS.txt'),sums);
  return {version,output,artifacts:artifacts.map(a=>({name:a.name,bytes:a.data.length})),files:entries.length};
}
if(require.main===module)release().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={release};
