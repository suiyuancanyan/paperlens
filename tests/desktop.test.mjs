import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import resolver from '../desktop/paths.cjs';
import nativeLibrary from '../desktop/library-store.cjs';
test('desktop database adapter merges simultaneous notes and analysis in durable files',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'paperlens-adapter-test-'));
  try{
    const store=nativeLibrary.createLibraryStore(directory);globalThis.window={paperlensDesktop:{storage:store}};
    const db=await import('../src/db.js?desktop-adapter-test');const id=crypto.randomUUID();
    await db.savePaper({id,analysis:{title:'Original'},pages:[{number:1,text:'Page'}],notes:'',chat:[]},new Blob(['Original file']));
    await Promise.all([db.patchPaper(id,{analysis:{title:'Model analysis',mode:'ai'}},'AI 解读'),db.patchPaper(id,{notes:'Saved desktop note'},'编辑笔记')]);
    const reopened=nativeLibrary.createLibraryStore(directory);const paper=await reopened.getPaper(id);assert.equal(paper.notes,'Saved desktop note');assert.equal(paper.analysis.mode,'ai');assert.equal(paper.history.length,2);assert.equal(await (await db.getFile(id)).text(),'Original file');
  }finally{delete globalThis.window;assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(directory,{recursive:true,force:true});}
});
test('desktop papers and original files survive reopening without browser storage',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'paperlens-library-test-'));
  try{
    const store=nativeLibrary.createLibraryStore(directory);const id=crypto.randomUUID();const paper={id,analysis:{title:'Persisted paper'},pages:[{number:1,text:'Original page'}],notes:'A saved note',readPosition:{page:1,tab:'notes',zoom:1.15},visuals:[]};
    await store.savePaper(paper,Buffer.from('PDF fixture bytes'));
    const reopened=nativeLibrary.createLibraryStore(directory);assert.deepEqual(await reopened.getPaper(id),paper);assert.equal(Buffer.from(await reopened.getFile(id)).toString(),'PDF fixture bytes');assert.equal((await reopened.allPapers()).length,1);
    await reopened.savePaper({...paper,notes:'Updated note'});assert.equal((await nativeLibrary.createLibraryStore(directory).getPaper(id)).notes,'Updated note');
    await assert.rejects(()=>store.getPaper('../escape'),/编号/);assert.deepEqual(await store.allPapers(),[{...paper,notes:'Updated note'}]);
  }finally{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(directory,{recursive:true,force:true});}
});
test('desktop Codex discovery survives a GUI launch without a Codex PATH entry',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'paperlens-desktop-test-'));
  try {
    const codex=path.join(root,'OpenAI','Codex','bin','installed-build','codex.exe');await fs.mkdir(path.dirname(codex),{recursive:true});await fs.writeFile(codex,'fixture');
    assert.equal(await resolver.resolveCodexPath({LOCALAPPDATA:root,PATH:''}),codex);
    const override=path.join(root,'custom-codex.exe');await fs.writeFile(override,'fixture');
    assert.equal(await resolver.resolveCodexPath({LOCALAPPDATA:root,PATH:'',PAPERLENS_CODEX_PATH:override}),override);
    assert.equal(await resolver.resolveCodexPath({LOCALAPPDATA:path.join(root,'missing'),PATH:''}),null);
  }finally{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(root,{recursive:true,force:true});}
});
