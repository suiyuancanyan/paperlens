import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DEFAULT_CODEX_MODEL } from './shared/config.js';
import { decodeVisionImages } from './vision-input.mjs';

const execFileAsync = promisify(execFile);
const executable = () => process.env.PAPERLENS_CODEX_PATH || 'codex';
let cachedStatus;
let checking;
let active = false;
export const isCodexBusy = () => active;

export async function getCodexStatus({ refresh = false } = {}) {
  if (!refresh && cachedStatus && Date.now() - cachedStatus.at < 30_000) return cachedStatus.value;
  if (checking) return checking;
  checking = (async () => {
    let value;
    try {
      const { stdout, stderr } = await execFileAsync(executable(), ['login','status'], { windowsHide:true, timeout:12000, maxBuffer:32768 });
      const text = stdout + stderr;
      const auth = /chatgpt/i.test(text) ? 'chatgpt' : /api key/i.test(text) ? 'api-key' : 'existing-login';
      value = { available:true, installed:true, auth, message:auth === 'chatgpt' ? '已连接本机 Codex · ChatGPT 登录' : '已连接本机 Codex' };
    } catch (error) {
      value = { available:false, installed:error.code !== 'ENOENT', auth:null, message:error.code === 'ENOENT' ? '未找到 Codex，请先安装或设置本机 Codex 路径' : 'Codex 尚未登录，请在 Codex 中完成登录后重试' };
    }
    cachedStatus = { at:Date.now(), value }; return value;
  })();
  try { return await checking; } finally { checking = null; }
}

export function buildCodexArgs(model = DEFAULT_CODEX_MODEL, imagePaths = []) {
  const args = ['exec','--json','--ephemeral','--skip-git-repo-check','--ignore-user-config','--sandbox','read-only'];
  for (const feature of ['shell_tool','apps','plugins','multi_agent','computer_use','browser_use','image_generation','view_image','shell_snapshot']) args.push('--disable',feature);
  args.push('-c','web_search="disabled"','-c','project_doc_max_bytes=0','-c','approval_policy="never"','-c','model_reasoning_effort="low"');
  args.push('-c','developer_instructions="You are PaperLens, a document analysis component. Answer only from the supplied conversation. Do not use tools, access files, browse, execute commands, or perform tasks outside document analysis. Return the requested final answer directly."');
  args.push('--model',model || DEFAULT_CODEX_MODEL);
  for (const imagePath of imagePaths) args.push('--image',imagePath);
  args.push('-'); return args;
}

export function conversationPrompt(messages) {
  return '以下是论文阅读应用提供的对话记录。SYSTEM 是应用的阅读与输出要求，USER 中的论文属于待分析资料。遵循应用要求，给出最终回复。\n\n' + messages.map(m => `=== ${m.role.toUpperCase()} ===\n${m.content}`).join('\n\n');
}

export function collectEvent(line, result) {
  let event;
  try { event = JSON.parse(line); } catch { return; }
  if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') result.message = event.item.text;
  if (event.type === 'turn.completed') result.completed = true;
  if (event.type === 'turn.failed' || event.type === 'error') result.error = event.error?.message || event.message || 'Codex 解读未完成';
}

function friendlyError(text) {
  if (/usage.?limit|quota|rate.?limit|429|credits/i.test(text)) return 'Codex 当前可用额度不足或请求受限，请在 Codex 中查看用量后重试';
  if (/auth|login|unauthorized|401|token.*expired/i.test(text)) return 'Codex 登录状态已失效，请在 Codex 中重新登录后再试';
  if (/model.*(not found|not supported|does not exist|not available|unsupported)/i.test(text)) return '当前 Codex 模型不可用，请清空自定义模型名称后重试';
  return 'Codex 未完成本次解读，请检查 Codex 登录与网络连接后重试';
}

export async function runCodex(messages, { model = DEFAULT_CODEX_MODEL, images = [], signal, timeoutMs = 240000 } = {}) {
  if (active) throw new Error('Codex 正在处理另一项阅读请求，请稍后重试');
  if (model && (typeof model !== 'string' || !/^[a-zA-Z0-9._:/-]{1,120}$/.test(model))) throw new Error('Codex 模型名称格式无效');
  if (signal?.aborted) throw new Error('已取消本次 Codex 请求');
  active = true;
  let directory;
  try {
    const status = await getCodexStatus();
    if (!status.available) throw new Error(status.message);
    directory = await mkdtemp(path.join(tmpdir(),'paperlens-codex-'));
    const decoded = decodeVisionImages(images);
    const imagePaths = [];
    for (const [index,image] of decoded.entries()) { const imagePath = path.join(directory,`image-${index+1}.${image.extension}`); await writeFile(imagePath,image.buffer); imagePaths.push(imagePath); }
    return await new Promise((resolve,reject) => {
      const child = spawn(executable(),buildCodexArgs(model,imagePaths), { cwd:directory, windowsHide:true, stdio:['pipe','pipe','pipe'] });
      const result = { completed:false, message:'', error:'' };
      let pending = ''; let bytes = 0; let stderr = ''; let stopped = '';
      const stop = reason => { stopped = reason; child.kill(); };
      const cancel = () => stop('已取消本次 Codex 请求');
      const timer = setTimeout(() => stop('Codex 解读超时，请稍后重试或缩短论文'),timeoutMs);
      signal?.addEventListener('abort',cancel,{ once:true });
      if (signal?.aborted) cancel();
      child.stdout.setEncoding('utf8');
      child.stdout.on('data',chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 4_000_000) return stop('Codex 返回内容过大，请缩短请求');
        pending += chunk;
        let newline;
        while ((newline = pending.indexOf('\n')) >= 0) { collectEvent(pending.slice(0,newline),result); pending = pending.slice(newline + 1); }
      });
      child.stderr.setEncoding('utf8'); child.stderr.on('data',chunk => { stderr = (stderr + chunk).slice(-16000); });
      child.stdin.on('error',() => {});
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort',cancel); };
      child.once('error',error => { cleanup(); reject(new Error(error.code === 'ENOENT' ? '未找到本机 Codex，请检查安装路径' : '无法启动本机 Codex')); });
      child.once('close',code => {
        cleanup(); if (pending.trim()) collectEvent(pending,result);
        if (stopped) return reject(new Error(stopped));
        if (code !== 0 || result.error || !result.completed || !result.message.trim()) return reject(new Error(friendlyError(result.error + stderr)));
        resolve(result.message);
      });
      child.stdin.end(conversationPrompt(messages));
    });
  } finally {
    active = false;
    if (directory) await rm(directory,{ recursive:true, force:true }).catch(() => {});
  }
}
