import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { getCodexStatus, runCodex, isCodexBusy } from './codex-bridge.mjs';
import { createTranslationService } from './translation-service.mjs';
import { DEFAULT_CODEX_MODEL } from './shared/config.js';
import { decodeVisionImages } from './vision-input.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');
const port = Number(process.env.PORT || 4173);
const vite = production ? null : await (await import('vite')).createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
const send = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };

export function resolveEndpoint(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请输入有效的 HTTP 或 HTTPS 服务地址');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('远程模型服务请使用 HTTPS 地址');
  url.search = ''; url.hash = '';
  url.pathname = url.pathname.replace(/\/$/, '').replace(/\/chat\/completions$/, '') + '/chat/completions';
  return url.href;
}

const translations=createTranslationService({root,modelBusy:()=>isCodexBusy()||controllers.size>0,translate:async(messages,config,signal)=>{
  if(config.provider==='codex')return runCodex(messages,{model:config.codexModel||process.env.PAPERLENS_CODEX_MODEL||DEFAULT_CODEX_MODEL,signal});
  const base=config.base||process.env.PAPERLENS_API_BASE;
  const model=config.model||process.env.PAPERLENS_MODEL;
  const key=config.key||process.env.PAPERLENS_API_KEY;
  if(!base||!model)throw new Error('请在模型设置中填写服务地址和模型名称');
  const response=await fetch(resolveEndpoint(base),{method:'POST',signal:AbortSignal.any([signal,AbortSignal.timeout(180000)]),headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model,messages,temperature:0.1,max_tokens:12000,stream:false})});
  if(!response.ok)throw new Error(response.status===401?'模型验证失败，请检查 API Key':response.status===429?'模型额度不足或请求受限，请稍后重试':`翻译模型返回错误（${response.status}）`);
  const result=await response.json();
  if(result.choices?.[0]?.finish_reason==='length')throw new Error('单段译文被模型截断，请使用支持更长输出的模型');
  const content=result.choices?.[0]?.message?.content;
  if(typeof content!=='string'||!content.trim())throw new Error('模型未返回有效译文');
  return content;
}});
const controllers=new Set();
const server = http.createServer(async (req, res) => {
  if(req.url==='/api/health')return send(res,200,{app:'paperlens',instance:process.env.PAPERLENS_DESKTOP_INSTANCE||''});
  if(await translations.handle(req,res))return;
  if (req.url === '/api/status') {
    const configured = Boolean(process.env.PAPERLENS_API_BASE && process.env.PAPERLENS_MODEL);
    const codex = await getCodexStatus();
    return send(res,200,{ configured, model:process.env.PAPERLENS_MODEL || '', codex:{...codex,defaultModel:process.env.PAPERLENS_CODEX_MODEL || DEFAULT_CODEX_MODEL}, defaultProvider:codex.available ? 'codex' : 'api' });
  }
  if (req.url === '/api/chat') {
    if (req.method !== 'POST') return send(res, 405, { error: '请使用 POST 请求' });
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: '请求来源无效' });
    if (!req.headers['content-type']?.includes('application/json')) return send(res, 415, { error: '需要 JSON 数据' });
    if(translations.isBusy())return send(res,409,{error:'正在全文翻译，请完成或取消后再使用阅读模型'});
    let controller;
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 18_000_000) throw new Error('请求内容过大，请减少图片或缩短论文'); chunks.push(chunk); }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const base = data.base || process.env.PAPERLENS_API_BASE;
      const model = data.model || process.env.PAPERLENS_MODEL;
      const key = data.key || process.env.PAPERLENS_API_KEY;
      if (!Array.isArray(data.messages) || !data.messages.length || data.messages.length > 40 || data.messages.some(m => !['user','assistant','system'].includes(m.role) || typeof m.content !== 'string')) return send(res, 400, { error: '对话内容无效' });
      const images = decodeVisionImages(data.images || []);
      if (data.provider === 'codex') {
        if (data.messages.reduce((n,m) => n+m.content.length,0) > 220000) return send(res,400,{error:'论文与对话内容过长，请缩短后重试'});
        controller = new AbortController();controllers.add(controller);
        res.on('close',() => { if (!res.writableEnded) controller.abort(); });
        const selectedModel = data.codexModel || process.env.PAPERLENS_CODEX_MODEL || DEFAULT_CODEX_MODEL;
        const content = await runCodex(data.messages,{ model:selectedModel, images:data.images || [], signal:controller.signal });
        return send(res,200,{ content, provider:'codex', model:selectedModel, imageCount:images.length });
      }
      if (!base || !model) return send(res, 400, { error: '请在模型设置中填写服务地址和模型名称' });
      controller = new AbortController();controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 150_000);
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      let upstream;
      try {
        upstream = await fetch(resolveEndpoint(base), {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({ model, messages:images.length ? data.messages.map((m,i) => i === data.messages.length-1 && m.role === 'user' ? {...m,content:[{type:'text',text:m.content},...images.map(image=>({type:'image_url',image_url:{url:image.dataUrl}}))]} : m) : data.messages, temperature: 0.2, max_tokens: data.maxTokens || 7000, stream: false })
        });
      } finally { clearTimeout(timeout); }
      if (!upstream.ok) {
        await upstream.text();
        const messages = { 401: '模型服务验证失败，请检查 API Key', 403: '模型服务拒绝访问，请检查权限', 404: '未找到模型或接口，请检查服务地址与模型名称', 429: '模型服务额度不足或请求过于频繁，请稍后重试' };
        return send(res, 502, { error: messages[upstream.status] || `模型服务返回错误（${upstream.status}）` });
      }
      const result = await upstream.json();
      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('模型返回内容为空，请检查模型是否支持 Chat Completions 接口');
      return send(res, 200, { content });
    } catch (error) {
      return send(res, 500, { error: error.name === 'AbortError' ? '解读超时，请稍后重试或使用更快的模型' : error.message === 'fetch failed' ? '无法连接模型服务，请检查地址与网络连接' : error.message });
    } finally {if(controller)controllers.delete(controller);}
  }
  if (req.url.startsWith('/api/')) return send(res, 404, { error: '接口不存在' });
  if (vite) return vite.middlewares(req, res);
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, 'dist', '.' + pathname);
    const distRoot = path.resolve(root, 'dist');
    if (file !== distRoot && !file.startsWith(distRoot + path.sep)) return send(res, 403, { error: '无效路径' });
    const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.bcmap':'application/octet-stream' };
    let target = file;
    try { if (!(await fs.stat(target)).isFile()) target = path.join(distRoot, 'index.html'); } catch { target = path.join(distRoot, 'index.html'); }
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
    res.end(await fs.readFile(target));
  } catch { send(res, 500, { error: '页面加载失败，请先运行 npm run build' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`PaperLens ready: http://127.0.0.1:${port}`));
const shutdown=()=>{translations.shutdown();for(const controller of controllers)controller.abort();server.close();vite?.close();if(process.parentPort)setTimeout(()=>process.exit(0),1000).unref();};
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,shutdown);
process.parentPort?.on('message',event=>{if(event.data?.type==='paperlens:shutdown')shutdown();});
