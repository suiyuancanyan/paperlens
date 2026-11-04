import './full-translation.css';

export function createFullTranslation({state,current,getFile,persist,modal,toast,e,ic,isConfigured,settingsModal,download,refreshIcons}) {
  const records=new Map();
  let panelPaper=null;
  const running=job=>job?.status==='running';
  async function request(url,options){const response=await fetch(url,options);const data=await response.json();if(!response.ok)throw new Error(data.error||'无法连接全文翻译服务');return data;}
  function content(p){
    const job=records.get(p.id)||p.translation;
    const source=p.analysis.language==='中文'?'zh':'en';
    return `<div class="full-translation-intro"><span>${ic('languages')}</span><div><strong>${e(p.analysis.title)}</strong><p>保留分栏、图片、表格与公式，译文在原页面内排版。</p></div></div>
      ${job?`<div class="full-translation-status" role="status"><div><strong>${job.status==='done'?'全文翻译完成':job.status==='running'?'正在翻译全文':'上次翻译未完成'}</strong><span>${Math.round(job.progress||0)}%</span></div><progress max="100" value="${job.progress||0}"></progress><p>${e(job.label||'')}</p></div>`:''}
      ${job?.status==='done'?`<div class="full-translation-downloads"><button class="primary" data-action="download-full-mono">${ic('file-check')}下载译文 PDF</button><button class="secondary" data-action="download-full-dual">${ic('columns-2')}下载双语对照 PDF</button></div>`:''}
      ${running(job)?`<p class="full-translation-note">可关闭此面板继续阅读，应用需保持运行。</p><div class="modal-footer"><button class="secondary" data-action="cancel-full-translation">取消翻译</button></div>`:`<label class="form-label">翻译方向<select id="full-translation-direction" aria-label="全文翻译方向"><option value="en:zh-CN" ${source==='en'?'selected':''}>英文 → 简体中文</option><option value="zh:en" ${source==='zh'?'selected':''}>中文 → 英文</option></select></label><p class="full-translation-note">使用当前模型：${e(state.settings.provider==='codex'?'本机 Codex · '+state.settings.codexModel:state.settings.model||'已配置的 API')}。正文会发送给该模型，图像由本机排版引擎处理。首次运行会下载版面模型与字体。</p><p class="full-translation-note">原文件保留。译文的换行与字号会随文字长度调整，图片内嵌文字通常保留原样。参考文献保留原文，扫描件请先进行 OCR。</p><div class="modal-footer"><button class="primary" data-action="start-full-translation">${ic('languages')}${job?'重新翻译全文':'翻译全文'}</button></div>`}`;
  }
  function update(){
    const container=document.querySelector('#full-translation-content');
    if(container&&panelPaper){const p=state.papers.find(p=>p.id===panelPaper);if(p)container.innerHTML=content(p);}
    const job=[...records.values()].find(running);
    let dock=document.querySelector('#full-translation-dock');
    if(!dock){dock=document.createElement('aside');dock.id='full-translation-dock';document.body.append(dock);}
    dock.innerHTML=job?`<button data-action="show-full-translation"><span>${ic('languages')}</span><div><strong>全文翻译 · ${Math.round(job.progress||0)}%</strong><small>${e(job.label)}</small></div>${ic('chevron-up')}</button>`:'';
    refreshIcons();
  }
  async function watch(p,initial){
    if(records.get(p.id)?.watching)return;
    const record={...initial,watching:true};records.set(p.id,record);state.fullTranslationBusy=[...records.values()].some(running);update();
    try{
      while(running(record)){
        await new Promise(resolve=>setTimeout(resolve,1500));
        Object.assign(record,await request('/api/translations/'+record.id));update();
      }
      await persist(p,{translation:{id:record.id,status:record.status,targetLang:record.targetLang,progress:record.progress,label:record.label}});
      if(record.status==='done')toast('全文翻译完成，可下载译文与双语对照 PDF');
      else if(record.status==='error')toast(record.label,true);
    }catch(error){record.status='error';record.label=error.message;toast(error.message,true);}
    finally{record.watching=false;state.fullTranslationBusy=[...records.values()].some(running);update();}
  }
  async function open(p=current()){
    if(!p)return;
    if(p.type!=='pdf'){toast(p.type==='docx'?'保留原排版的全文翻译支持 PDF，请将 Word 另存为 PDF 后导入':'请先导入一篇 PDF 论文',true);return;}
    if(p.translation?.id&&!records.has(p.id)){
      try{const job=await request('/api/translations/'+p.translation.id);records.set(p.id,job);if(running(job))void watch(p,job);}
      catch{records.set(p.id,{...p.translation,status:'interrupted',label:'翻译记录已不在本机，可重新翻译'});}
    }
    panelPaper=p.id;
    modal('全文翻译 · 保留版式','让整篇论文，用熟悉的语言呈现。',`<div id="full-translation-content">${content(p)}</div>`,'full-translation-modal');
  }
  async function start(){
    const p=state.papers.find(p=>p.id===panelPaper);if(!p)return;
    if(state.fullTranslationBusy||state.analysisId||state.chatBusy||state.visionBusy||state.translationBusy)return toast('阅读模型正在处理其他请求，请稍后重试');
    if(!isConfigured())return settingsModal();
    const direction=document.querySelector('#full-translation-direction')?.value||'en:zh-CN';
    const [sourceLang,targetLang]=direction.split(':');
    const button=document.querySelector('[data-action="start-full-translation"]');if(button?.disabled)return;if(button)button.disabled=true;
    state.fullTranslationBusy=true;
    try{
      const file=await getFile(p.id);if(!file)throw new Error('原始 PDF 不存在，请重新导入');
      const pdf=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
      const job=await request('/api/translations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...state.settings,key:state.key,pdf,sourceLang,targetLang,title:p.analysis.title,context:p.pages.slice(0,2).map(page=>page.text).join('\n').slice(0,4000)})});
      records.set(p.id,job);
      await persist(p,{translation:{id:job.id,status:job.status,targetLang,progress:0,label:job.label}});
      void watch(p,job);
    }catch(error){state.fullTranslationBusy=false;toast(error.message,true);}
    finally{if(button?.isConnected)button.disabled=false;update();}
  }
  async function cancel(){const job=records.get(panelPaper);if(!running(job))return;Object.assign(job,await request('/api/translations/'+job.id,{method:'DELETE'}));update();}
  async function downloadResult(kind){
    const p=state.papers.find(p=>p.id===panelPaper);const job=records.get(panelPaper)||p?.translation;if(!p||job?.status!=='done')return;
    const response=await fetch(`/api/translations/${job.id}/${kind}`);if(!response.ok)throw new Error((await response.json()).error||'译文下载失败');
    download(await response.arrayBuffer(),p.analysis.title.replace(/[\\/:*?"<>|]/g,'').slice(0,90)+(kind==='mono'?'-译文':'-双语对照')+'.pdf','application/pdf');
  }
  async function recover(){for(const p of state.papers.filter(p=>p.translation?.status==='running')){try{const job=await request('/api/translations/'+p.translation.id);void watch(p,job);}catch{/* The translation panel offers a retry when opened. */}}}
  return {open,start,cancel,downloadResult,recover,show:()=>open(state.papers.find(p=>running(records.get(p.id)))||current())};
}
