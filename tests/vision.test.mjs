import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeVisionImages } from '../vision-input.mjs';
import { buildCodexArgs } from '../codex-bridge.mjs';
import { DEFAULT_CODEX_MODEL } from '../shared/config.js';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nJ8AAAAASUVORK5CYII=';
test('the requested Codex model is pinned when no override is supplied',()=>{
  const args=buildCodexArgs('');assert.equal(args[args.indexOf('--model')+1],DEFAULT_CODEX_MODEL);assert.equal(DEFAULT_CODEX_MODEL,'gpt-6.1-sol');
});
test('Codex receives actual image attachments independently of prompt text',()=>{
  const args=buildCodexArgs('', ['C:/temp/image-1.png','C:/temp/image-2.jpg']);
  const paths=args.flatMap((x,i)=>x==='--image'?[args[i+1]]:[]);assert.deepEqual(paths,['C:/temp/image-1.png','C:/temp/image-2.jpg']);assert.equal(args.at(-1),'-');
});
test('vision input checks signatures, limits and local data formats',()=>{
  const images=decodeVisionImages([{dataUrl:png}]);assert.equal(images[0].extension,'png');assert.ok(images[0].buffer.length>24);
  assert.throws(()=>decodeVisionImages([{dataUrl:'https://example.com/image.png'}]),/格式无效/);
  assert.throws(()=>decodeVisionImages([{dataUrl:'data:image/png;base64,SGVsbG8='}]),/内容无效/);
  assert.throws(()=>decodeVisionImages(Array.from({length:7},()=>({dataUrl:png}))),/最多/);
});
