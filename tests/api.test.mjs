import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
let child, mock, base, upstream;
before(async()=>{
  mock=http.createServer(async(req,res)=>{
    let raw='';for await(const c of req) raw+=c;
    const data=JSON.parse(raw);
    if(data.model==='bad-key'){res.writeHead(401);return res.end('{}');}
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:data.messages[0].content}}]}));
  });
  mock.listen(0,'127.0.0.1');await once(mock,'listening');upstream=`http://127.0.0.1:${mock.address().port}/v1`;
  const probe=http.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs','--production'],{env:{...process.env,PORT:String(port),PAPERLENS_API_BASE:'',PAPERLENS_API_KEY:'',PAPERLENS_MODEL:''},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),10000);child.stdout.on('data',data=>{if(data.toString().includes('PaperLens ready')){clearTimeout(timer);resolve();}});child.on('error',reject);child.on('exit',code=>{if(code)reject(new Error(`Server exited ${code}`));});});
});
after(async()=>{child?.kill();await new Promise(r=>mock?.close(r));});
const call=(body,origin)=>fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
test('local proxy forwards Chinese context to a compatible endpoint',async()=>{
  const response=await call({base:upstream,model:'fixture',messages:[{role:'user',content:'中文论文：问题、方法与证据。'}]});
  assert.equal(response.status,200);assert.equal((await response.json()).content,'中文论文：问题、方法与证据。');
});
test('missing model and authentication failure produce actionable errors',async()=>{
  const missing=await call({messages:[{role:'user',content:'hello'}]});assert.equal(missing.status,400);
  const response=await call({base:upstream,model:'bad-key',messages:[{role:'user',content:'hello'}]});
  assert.equal(response.status,502);assert.match((await response.json()).error,/API Key/);
});
test('proxy rejects requests from unrelated websites and non-HTTP endpoints',async()=>{
  const foreign=await call({base:upstream,model:'fixture',messages:[{role:'user',content:'hello'}]},'https://unrelated.example');assert.equal(foreign.status,403);
  const response=await call({base:'file:///secret',model:'fixture',messages:[{role:'user',content:'hello'}]});assert.equal(response.status,500);assert.match((await response.json()).error,/HTTP/);
});
