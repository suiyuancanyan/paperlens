import {build} from 'esbuild';
import {Resvg} from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import path from 'node:path';
const runtime=path.resolve('desktop-runtime');await fs.mkdir(runtime,{recursive:true});
await build({entryPoints:['server.mjs'],outfile:path.join(runtime,'server.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',external:['vite'],banner:{js:'import {createRequire as __createRequire} from "node:module";const require=__createRequire(import.meta.url);'}});
await fs.cp('dist',path.join(runtime,'dist'),{recursive:true});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect x="8" y="8" width="240" height="240" rx="53" fill="#f2f5e9"/><rect x="20" y="20" width="216" height="216" rx="44" fill="#e4edda"/><g transform="translate(32 35) scale(4.8)"><path d="M8 10h8c5 0 7 3 7 8v15c-3-3-6-5-10-5H8zm25 0h-8v18c2-2 5-3 8-3z" fill="#254e3a"/><circle cx="32" cy="7" r="3" fill="#93ac61"/></g></svg>';
await fs.writeFile('desktop/icon.svg',svg);
const sizes=[16,32,48,64,128,256];const images=sizes.map(size=>new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
await fs.writeFile('desktop/icon.png',images.at(-1));
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
for(const [index,size] of sizes.entries()){const entry=6+index*16;header[entry]=size===256?0:size;header[entry+1]=size===256?0:size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(images[index].length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=images[index].length;}
await fs.writeFile('desktop/icon.ico',Buffer.concat([header,...images]));
const notices=[];
for(const name of ['dompurify','dotenv','katex','lucide','mammoth','marked','pdfjs-dist']){
  const directory=path.join('node_modules',name);const files=await fs.readdir(directory);const license=files.find(file=>/^licen[sc]e(?:\.|$)/i.test(file));
  if(license)notices.push('===== '+name+' =====\n'+await fs.readFile(path.join(directory,license),'utf8'));
}
await fs.writeFile(path.join(runtime,'THIRD-PARTY-NOTICES.txt'),notices.join('\n\n'));
const appDir=path.resolve('desktop-app');await fs.mkdir(appDir,{recursive:true});
for(const file of ['main.cjs','preload.cjs','paths.cjs','library-store.cjs','icon.ico','icon.png'])await fs.copyFile(path.join('desktop',file),path.join(appDir,file));
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
await fs.writeFile(path.join(appDir,'package.json'),JSON.stringify({name:'paperlens-desktop',version:pkg.version,description:'砚读 PaperLens 论文图文阅读与研究工作台',author:'PaperLens',main:'main.cjs'},null,2));
console.log('Desktop runtime and icons ready');
