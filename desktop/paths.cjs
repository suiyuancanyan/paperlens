const fs=require('node:fs/promises');
const path=require('node:path');
async function exists(file){try{return (await fs.stat(file)).isFile();}catch{return false;}}
async function resolveCodexPath(env=process.env){
  if(env.PAPERLENS_CODEX_PATH&&await exists(env.PAPERLENS_CODEX_PATH))return env.PAPERLENS_CODEX_PATH;
  const root=env.LOCALAPPDATA&&path.join(env.LOCALAPPDATA,'OpenAI','Codex','bin');
  if(root){try{const directories=await fs.readdir(root,{withFileTypes:true});const candidates=[];for(const entry of directories.filter(entry=>entry.isDirectory())){const file=path.join(root,entry.name,'codex.exe');if(await exists(file))candidates.push({file,mtime:(await fs.stat(file)).mtimeMs});}candidates.sort((a,b)=>b.mtime-a.mtime);if(candidates.length)return candidates[0].file;}catch{}}
  for(const dir of (env.PATH||env.Path||'').split(path.delimiter).filter(Boolean)){const file=path.join(dir,'codex.exe');if(await exists(file))return file;}
  return null;
}
module.exports={resolveCodexPath};
