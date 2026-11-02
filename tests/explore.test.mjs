import test from 'node:test';
import assert from 'node:assert/strict';
import {readingMap,logicLayout,logicKey} from '../src/explore-data.js';
test('page maps count only real in-range source locations, including saved notes',()=>{
  const p={pages:[{text:'First'},{text:'Second'}],analysis:{figures:[{page:2},{page:null},{page:10}],innovations:[{page:1}],results:[{page:2}],logic:[],datasets:[],limitations:[]},clips:[{page:2}],annotations:[{page:1},{page:0}]};
  const map=readingMap(p);assert.deepEqual(map.map(p=>[p.figures.length,p.evidence.length,p.notes.length]),[[0,1,1],[1,1,1]]);assert.equal(map[1].text,'Second');
});
test('canvas paths keep every original node in order on desktop and mobile',()=>{
  const nodes=Array.from({length:7},(_,i)=>({label:`Node ${i}`,detail:`Detail ${i}`}));
  for(const compact of [false,true]){const graph=logicLayout(nodes,compact);assert.equal(graph.edges.length,6);assert.deepEqual(graph.positions.map(p=>p.node),nodes);assert.ok(graph.positions.every(p=>p.x>=0&&p.x+p.width<=graph.width&&p.y+p.height<=graph.height));assert.equal(new Set(graph.positions.map(p=>`${p.x},${p.y}`)).size,7);}
  assert.equal(logicKey(nodes[0]),logicKey({...nodes[0]}));assert.notEqual(logicKey(nodes[0]),logicKey({...nodes[0],detail:'Revised'}));
});
