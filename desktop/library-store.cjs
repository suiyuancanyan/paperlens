const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
function createLibraryStore(userData){
  const root=path.join(userData,'library');
  const papers=path.join(root,'papers');const files=path.join(root,'files');
  function safeId(id){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,140}$/.test(id))throw new Error('文献编号无效');return id;}
  async function atomic(file,data){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';const handle=await fs.open(temporary,'wx');try{await handle.writeFile(data);await handle.sync();}finally{await handle.close();}await fs.rename(temporary,file);}
  async function getPaper(id){try{return JSON.parse(await fs.readFile(path.join(papers,safeId(id)+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return undefined;throw error;}}
  return {
    async allPapers(){let names;try{names=await fs.readdir(papers);}catch(error){if(error.code==='ENOENT')return [];throw error;}const records=[];for(const name of names.filter(name=>/^[a-zA-Z0-9_-]+\.json$/.test(name)))records.push(await getPaper(name.slice(0,-5)));return records;},
    getPaper,
    async savePaper(paper,bytes){const id=safeId(paper?.id);if(!paper.analysis||!Array.isArray(paper.pages))throw new Error('文献资料不完整');if(bytes!==undefined&&bytes!==null)await atomic(path.join(files,id+'.bin'),Buffer.from(bytes));await atomic(path.join(papers,id+'.json'),JSON.stringify(paper));return paper;},
    async getFile(id){try{return new Uint8Array(await fs.readFile(path.join(files,safeId(id)+'.bin')));}catch(error){if(error.code==='ENOENT')return null;throw error;}},
    async deletePaper(id){safeId(id);const archive=path.join(root,'removed',id+'-'+Date.now());await fs.mkdir(archive,{recursive:true});for(const [source,name] of [[path.join(papers,id+'.json'),'paper.json'],[path.join(files,id+'.bin'),'original.bin']])try{await fs.rename(source,path.join(archive,name));}catch(error){if(error.code!=='ENOENT')throw error;}},
  };
}
module.exports={createLibraryStore};
