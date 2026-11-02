import http from 'node:http';
const answer = {
  title:'PaperLens Import Validation', authors:'Example Author', year:'',venue:'',doi:'',language:'English', tags:['功能验证'],
  summary:'这份合成文档用于验证论文阅读工作台的文件导入与结构化解读流程。',question:'如何整理文献中的问题、方法与证据？',method:'按文档结构提取阅读信息。',conclusion:'此为软件功能验证文档，未报告实证研究结果。',
  innovations:[{title:'结构化阅读流程',description:'将问题、方法、证据与结论连接起来。',page:1}],results:[],
  figures:[{label:'Figure 1',title:'Document processing workflow',description:'展示导入、提取、整理与阅读的流程。',page:1,kind:'figure'}],
  datasets:[{name:'Synthetic test dataset',description:'合成文本，用于软件功能测试。',size:'',task:'功能验证',page:1}],
  logic:[{label:'问题',detail:'文献整理',page:1},{label:'方法',detail:'结构化提取',page:1},{label:'验证',detail:'合成文档测试',page:1},{label:'结果',detail:'形成阅读卡片',page:1}],limitations:[]
};
http.createServer(async(req,res)=>{
  let raw=''; for await(const c of req) raw+=c;
  const data=JSON.parse(raw||'{}');
  if(data.model==='slow') await new Promise(resolve=>setTimeout(resolve,10000));
  if(data.model==='unauthorized') {res.writeHead(401);return res.end('{}');}
  const content=data.messages?.[0]?.content?.includes('仅返回合法 JSON')?JSON.stringify(answer):data.messages?.length===1?'OK':'这份文档展示了从问题到方法、证据与结论的结构化阅读流程。[第1页]';
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content}}]}));
}).listen(4191,'127.0.0.1',()=>console.log('Test model ready at http://127.0.0.1:4191/v1'));
