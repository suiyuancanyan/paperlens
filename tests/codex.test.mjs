import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCodexArgs, collectEvent, conversationPrompt } from '../codex-bridge.mjs';

test('Codex runs through stdin with existing login and document-only permissions',()=>{
  const args=buildCodexArgs('example-model');
  assert.ok(args.includes('--ephemeral'));assert.ok(args.includes('--ignore-user-config'));
  assert.equal(args[args.indexOf('--sandbox')+1],'read-only');assert.equal(args.at(-1),'-');
  assert.ok(args.includes('shell_tool'));assert.ok(args.includes('plugins'));assert.ok(args.includes('multi_agent'));
  assert.equal(args[args.indexOf('--model')+1],'example-model');assert.ok(!args.join(' ').includes('bypass'));
});
test('event parsing requires a successful completed turn and keeps the final answer',()=>{
  const result={};
  collectEvent('{"type":"item.completed","item":{"type":"agent_message","text":"first"}}',result);
  assert.equal(result.message,'first');assert.ok(!result.completed);
  collectEvent('{"type":"item.completed","item":{"type":"agent_message","text":"final"}}',result);
  collectEvent('{"type":"turn.completed"}',result);assert.equal(result.message,'final');assert.equal(result.completed,true);
  collectEvent('{"type":"turn.failed","error":{"message":"failure"}}',result);assert.equal(result.error,'failure');
  collectEvent('not json',result);
});
test('paper contents are passed as data and preserve Chinese characters',()=>{
  const prompt=conversationPrompt([{role:'system',content:'根据原文输出 JSON'},{role:'user',content:'论文：中文与 English。'}]);
  assert.match(prompt,/=== SYSTEM ===/);assert.match(prompt,/根据原文输出 JSON/);assert.match(prompt,/论文：中文与 English。/);
});
