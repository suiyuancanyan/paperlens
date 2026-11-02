import test from 'node:test';
import assert from 'node:assert/strict';
import { localExtract, parseAnalysis, exportMarkdown, escapeHTML } from '../src/core.js';

const pages = [
  { number:1, text:'A Structured Approach to Document Retrieval\nAlice Chen\nAbstract\nWe propose a retrieval framework for scientific documents. Experiments evaluate the method on a document dataset with multiple evidence types.\n1 Introduction\nFigure 1: Architecture of the retrieval framework\nThe DOI is 10.1234/example.2026.' },
  { number:2, text:'2 Results\nThe results show an improvement on the evaluated dataset.\nTable 1: Retrieval results on the benchmark dataset\nWe use a dataset of scientific documents with manually annotated answers.' }
];
test('local extraction finds evidence and real source pages without claiming AI analysis', () => {
  const a=localExtract(pages,'example.pdf');
  assert.equal(a.title,'A Structured Approach to Document Retrieval');
  assert.equal(a.doi,'10.1234/example.2026');
  assert.equal(a.mode,'extract');
  assert.equal(a.figures.length,2);
  assert.equal(a.figures[1].kind,'table');
  assert.equal(a.figures[1].page,2);
  assert.equal(a.innovations[0].page,1);
  assert.deepEqual(a.logic,[]);
  assert.equal(a.year,'');
});
test('structured model output validates fields and rejects invalid source pages', () => {
  const a=parseAnalysis('```json\n'+JSON.stringify({ summary:'A supported summary', innovations:[{title:'Contribution',description:'Evidence',page:99}], figures:[{label:'Table 1',kind:'table',page:2}], tags:['retrieval'] })+'\n```',localExtract(pages,'paper.pdf'),2);
  assert.equal(a.mode,'ai'); assert.equal(a.innovations[0].page,null); assert.equal(a.figures[0].page,2); assert.deepEqual(a.logic,[]);
  assert.throws(() => parseAnalysis('{"title":"bad"}',{},2),/缺少概括/);
  assert.throws(() => parseAnalysis('broken',{},2),/格式不完整/);
});
test('exports preserve notes, evidence locations, and analysis mode', () => {
  const a=localExtract(pages,'paper.pdf'); const md=exportMarkdown({ analysis:a, notes:'Important note', type:'pdf' });
  assert.ok(md.includes('本地原文提取')); assert.ok(md.includes('来源：第 2 页')); assert.ok(md.includes('Important note'));
});
test('untrusted content is escaped in the interface', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('image interpretations and their actual source pages survive Markdown export',()=>{
  const analysis=localExtract(pages,'image-paper.pdf');analysis.mode='ai';analysis.imageCount=1;
  const md=exportMarkdown({analysis,type:'pdf',notes:'',visuals:[{label:'Figure 1',page:2,vision:{content:'Actual image interpretation'}}]});
  assert.ok(md.includes('AI 图文解读'));assert.ok(md.includes('## 图像解读'));assert.ok(md.includes('Actual image interpretation'));assert.ok(md.includes('来源：第 2 页'));
});
