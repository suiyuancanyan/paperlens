import './floating-panel.css';

export function attachFloatingPanel(element) {
  element.classList.add('floating-panel');
  const storageKey='paperlens-floating-'+element.id;
  let position;let drag;let suppressClick=false;
  try { const saved=JSON.parse(localStorage.getItem(storageKey));if(Number.isFinite(saved?.x)&&Number.isFinite(saved?.y))position=saved; } catch {}
  function place(x,y,save=false) {
    const bounds=element.getBoundingClientRect();
    position={x:Math.max(8,Math.min(x,innerWidth-bounds.width-8)),y:Math.max(8,Math.min(y,innerHeight-bounds.height-8))};
    Object.assign(element.style,{left:position.x+'px',top:position.y+'px',right:'auto',bottom:'auto'});
    if(save)try{localStorage.setItem(storageKey,JSON.stringify(position));}catch{}
  }
  function constrain(){if(position&&!element.hidden&&element.offsetWidth)place(position.x,position.y);}
  element.addEventListener('pointerdown',event=>{
    suppressClick=false;
    if(event.button!==0||!event.target.closest('[data-panel-drag]')||event.target.closest('[data-panel-no-drag]'))return;
    const bounds=element.getBoundingClientRect();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:bounds.left,top:bounds.top,moved:false};
  });
  window.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    if(!drag.moved)element.setPointerCapture(event.pointerId);
    drag.moved=true;element.classList.add('is-dragging');place(drag.left+dx,drag.top+dy);event.preventDefault();
  });
  function finish(event){
    if(!drag||drag.id!==event.pointerId)return;
    if(drag.moved){suppressClick=true;place(position.x,position.y,true);}
    drag=null;element.classList.remove('is-dragging');
    if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);
  }
  window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
  element.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
  element.addEventListener('keydown',event=>{
    if(!event.target.matches('[data-panel-grip]')||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    const bounds=element.getBoundingClientRect(),step=event.shiftKey?30:10;
    place(bounds.left+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),bounds.top+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),true);event.preventDefault();
  });
  new ResizeObserver(constrain).observe(element);window.addEventListener('resize',constrain);
  return {show(){element.hidden=false;requestAnimationFrame(constrain);},hide(){element.hidden=true;},layout:constrain};
}

export const panelGrip = '<span class="floating-panel-grip" data-panel-drag data-panel-grip tabindex="0" role="button" aria-label="拖动任务窗，或用方向键调整位置" title="拖动调整位置，也可使用方向键">⠿</span>';
