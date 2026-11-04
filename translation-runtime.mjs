import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const environment = path.join(os.homedir(), '.cache', 'paperlens', 'translation-env');
export const runtimePython = () => process.env.PAPERLENS_TRANSLATION_PYTHON || path.join(environment, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

export function runCommand(command, args, { signal, onOutput = () => {}, timeoutMs = 900000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide:true, stdio:['ignore','pipe','pipe'], signal });
    let tail = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { tail = (tail + chunk).slice(-4000); onOutput(chunk.toString()); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolve(tail) : reject(new Error(`准备翻译环境失败（${code}）。可运行 npm run translation:setup 重试。`)); });
  });
}

let preparing;
export async function ensureTranslationRuntime(options = {}) {
  const python = runtimePython();
  try { await runCommand(python, ['-c', 'from babeldoc.format.pdf.high_level import async_translate; import pymupdf'], {signal:options.signal, timeoutMs:30000}); return python; } catch (error) { if (options.signal?.aborted) throw error; }
  if (process.env.PAPERLENS_TRANSLATION_PYTHON) throw new Error('指定的翻译 Python 环境不可用，请在该环境安装 BabelDOC>=0.6.4,<0.7');
  if (preparing) return preparing;
  preparing = (async () => {
    options.onProgress?.('首次使用：正在准备翻译引擎与 Python 环境…');
    let uv;
    const localUV = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'uv.exe' : 'uv');
    for (const [command, prefix] of [[process.env.PAPERLENS_UV_PATH || 'uv', []], [localUV, []], ['python', ['-m','uv']], ['py', ['-m','uv']]]) {
      try { await runCommand(command, [...prefix,'--version'], {signal:options.signal, timeoutMs:15000}); uv = {command,prefix}; break; } catch { if(options.signal?.aborted) throw new Error('已取消翻译'); }
    }
    if (!uv) throw new Error('请先安装 uv（python -m pip install uv），然后重试全文翻译');
    await fs.mkdir(path.dirname(environment), {recursive:true});
    try { await fs.access(python); } catch { await runCommand(uv.command, [...uv.prefix,'venv','--python','3.12',environment], options); }
    await runCommand(uv.command, [...uv.prefix,'pip','install','--python',python,'BabelDOC>=0.6.4,<0.7','bitstring>=4.3,<5'], options);
    return python;
  })();
  try { return await preparing; } finally { preparing = null; }
}
