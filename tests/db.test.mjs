import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {savePaper,patchPaper,getPaper,deletePaper} from '../src/db.js';
test('stale note and analysis updates merge atomically; edits are recoverable', async () => {
  const p={id:crypto.randomUUID(),analysis:{title:'Original',mode:'extract'},notes:'',visuals:[]}; await savePaper(p);
  await Promise.all([patchPaper(p.id,{analysis:{title:'AI title',mode:'ai'}},'AI 解读'),patchPaper(p.id,{notes:'My note'},'编辑笔记')]);
  let latest=await getPaper(p.id); assert.equal(latest.analysis.mode,'ai');assert.equal(latest.notes,'My note'); assert.equal(latest.history.length,2);
  await savePaper(p); latest=await getPaper(p.id);assert.equal(latest.notes,'My note');assert.equal(latest.analysis.title,'AI title');
  await patchPaper(p.id,{metadataOverrides:{title:'User title'}},'编辑基本信息'); await patchPaper(p.id,{analysis:{title:'Model title',mode:'ai'}},'AI 解读');
  assert.equal((await getPaper(p.id)).analysis.title,'User title');
  await patchPaper(p.id,latest=>({clips:[...(latest.clips||[]),{id:'one'}]}),'摘录');
  await patchPaper(p.id,latest=>({clips:[...(latest.clips||[]),{id:'two'}]}),'摘录'); assert.equal((await getPaper(p.id)).clips.length,2);
  await deletePaper(p.id);await assert.rejects(()=>patchPaper(p.id,{notes:'stale'}),/已被移除/); assert.equal(await getPaper(p.id),undefined);
});
