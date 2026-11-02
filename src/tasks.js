export function createTaskQueue(ctx) {
  const {state,extractPaper,savePaper,persist,analyze,render,toast,e,ic,isConfigured,openPaper}=ctx;
  let running=false;let expanded=false;
  const owner=sessionStorage.getItem('paperlens-task-owner')||crypto.randomUUID();sessionStorage.setItem('paperlens-task-owner',owner);
  const active=job=>['queued','extracting','analyzing'].includes(job.status);
  function update(){
    let dock=document.querySelector('#task-dock');if(!dock){dock=document.createElement('aside');dock.id='task-dock';dock.setAttribute('aria-label','论文整理任务');document.body.append(dock);}
    const jobs=state.jobs;if(!jobs.length){dock.innerHTML='';return;}
    const busy=jobs.filter(active).length;
    dock.innerHTML=`<button class="task-dock-heading" data-task-toggle="true">${ic(busy?'loader-circle':'list-checks',busy?'spin':'')}<strong>${busy?`${busy} 个整理任务进行中`:'论文整理任务'}</strong><span>${expanded?'收起':'展开'}</span></button>${expanded?`<div class="task-list">${jobs.map(j=>`<div class="task-item"><strong>${e(j.name)}</strong><p>${e(j.label)}</p>${active(j)?`<progress max="100" value="${j.progress||0}"></progress>`:''}<div>${j.paperId?`<button class="text-button" data-task-open="${j.id}">阅读原文</button>`:''}${active(j)?`<button class="text-button" data-task-cancel="${j.id}">取消</button>`:['error','cancelled','interrupted'].includes(j.status)?`<button class="text-button" data-task-retry="${j.id}">重试</button>`:''}${!active(j)?`<button class="text-button" data-task-dismiss="${j.id}">移除记录</button>`:''}</div></div>`).join('')}</div>${busy?'<p class="task-page-note">整理期间保持此页面打开；中断后可重试。</p>':''}`:''}`;
    dock.querySelectorAll('[data-lucide]').forEach(el=>{el.textContent=el.dataset.lucide==='loader-circle'?'◌':'☷';el.removeAttribute('data-lucide');});
  }
  async function status(job,status,label,progress=job.progress){job.status=status;job.label=label;job.progress=progress;update();if(job.paperId){const p=state.papers.find(p=>p.id===job.paperId);if(p)await persist(p,{task:{id:job.id,status,label,progress,owner,lease:Date.now()+45000}});}}
  async function pump(){
    if(running)return;running=true;
    try{
      while(true){
        const job=state.jobs.find(j=>j.status==='queued');if(!job)break;
        if(state.analysisId||state.chatBusy||state.visionBusy||state.translationBusy){setTimeout(pump,800);break;}
        job.controller=new AbortController();
        try{
          let p=state.papers.find(p=>p.id===job.paperId);
          if(!p){
            await status(job,'extracting','正在读取原文…',2);state.importing=true;
            p=await extractPaper(job.file,(progress,label)=>{job.controller.signal.throwIfAborted();job.progress=Math.round(progress*.45);job.label=label;update();});
            job.controller.signal.throwIfAborted();const saved=await savePaper(p,job.file);p=saved;state.papers.unshift(p);job.paperId=p.id;state.importing=false;
            toast('原文已就绪，可以开始阅读');if(!document.activeElement?.matches('input,textarea,select'))render();
          }
          if(!isConfigured()){await status(job,'done','原文已保存；连接模型后可生成解读',100);continue;}
          await status(job,'analyzing','模型正在后台阅读…',50);
          await analyze(p,true,job.controller.signal,(progress,label)=>{job.progress=Math.round(45+progress*.5);job.label=label;update();});
          await status(job,'done','解读完成，原文与阅读卡片均已保存',100);toast(`「${p.analysis.title.slice(0,30)}」解读完成`);
        }catch(error){const cancelled=job.controller.signal.aborted;await status(job,cancelled?'cancelled':'error',cancelled?'已取消；已导入的原文仍可阅读':error.message);}
        finally{state.importing=false;job.controller=null;update();}
      }
    }finally{running=false;}
  }
  async function enqueue(p){
    if(!p||p.type==='demo')return toast('请导入你的论文使用 AI 解读');if(!isConfigured())return toast('请先连接阅读模型',true);
    if(state.jobs.some(j=>j.paperId===p.id&&active(j)))return toast('这篇论文已经在整理队列中');
    const job={id:crypto.randomUUID(),paperId:p.id,name:p.filename,status:'queued',label:'等待后台解读',progress:0};
    await persist(p,latest=>{if(latest.task&&['queued','analyzing'].includes(latest.task.status)&&latest.task.owner!==owner&&latest.task.lease>Date.now())throw new Error('另一页面正在解读这篇论文');return {task:{id:job.id,status:'queued',label:job.label,owner,lease:Date.now()+45000}};});
    state.jobs.push(job);expanded=true;update();pump();
  }
  function importFiles(files){
    for(const file of Array.from(files)){
      const duplicate=state.papers.find(p=>p.filename===file.name&&p.size===file.size);
      if(duplicate){toast(`「${file.name}」已在文献库中`);continue;}
      if(state.jobs.some(j=>active(j)&&j.name===file.name&&j.file?.size===file.size))continue;
      state.jobs.push({id:crypto.randomUUID(),file,name:file.name,status:'queued',label:'等待读取原文',progress:0});
    }
    expanded=true;ctx.closeModal?.();document.querySelector('#modal-root').innerHTML='';update();pump();
  }
  function cancel(job){if(!job||!active(job))return;if(job.controller)job.controller.abort();else status(job,'cancelled','已取消等待');}
  async function handleClick(button){if(!button)return false;
    if(button.dataset.taskToggle){expanded=!expanded;update();return true;}
    for(const key of ['taskOpen','taskCancel','taskRetry','taskDismiss'])if(button.dataset[key]){
      const job=state.jobs.find(j=>j.id===button.dataset[key]);if(!job)return true;
      if(key==='taskOpen')await openPaper(job.paperId,'original');if(key==='taskCancel')cancel(job);
      if(key==='taskRetry'){if(!job.file&&!job.paperId)return toast('请重新选择原文件');job.status='queued';job.label='等待重试';pump();}
      if(key==='taskDismiss')state.jobs=state.jobs.filter(j=>j!==job);update();return true;
    }return false;
  }
  setInterval(()=>{for(const job of state.jobs.filter(active)){if(job.paperId){const p=state.papers.find(p=>p.id===job.paperId);if(p)persist(p,{task:{id:job.id,status:job.status,label:job.label,progress:job.progress,owner,lease:Date.now()+45000}}).catch(ctx.err);}}},15000);
  window.addEventListener('beforeunload',event=>{if(state.jobs.some(active)){event.preventDefault();event.returnValue='';}});
  return {shouldRecover:p=>!p.task.owner||p.task.owner===owner||p.task.lease<Date.now(),update,enqueue,importFiles,handleClick,cancelPaper:id=>state.jobs.filter(j=>j.paperId===id).forEach(cancel),recover:p=>state.jobs.push({id:p.task.id||crypto.randomUUID(),paperId:p.id,name:p.filename,status:p.task.status,label:p.task.label||'上次整理中断，可继续解读',progress:0})};
}
