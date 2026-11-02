export const validSourcePage = (value, count) => Number.isInteger(Number(value)) && Number(value)>=1 && Number(value)<=count ? Number(value) : null;
export function logicKey(node) {
  let hash=2166136261;for(const char of `${node.label}\n${node.detail}`){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return `logic-${(hash>>>0).toString(36)}`;
}
export function readingMap(paper) {
  const pages=(paper.pages||[]).map((page,index)=>({number:index+1,text:page.text||'',figures:[],evidence:[],notes:[]}));
  for(const item of paper.analysis?.figures||[]){const page=validSourcePage(item.page,pages.length);if(page)pages[page-1].figures.push(item);}
  for(const key of ['innovations','results','logic','datasets','limitations'])for(const item of paper.analysis?.[key]||[]){const page=validSourcePage(item.page,pages.length);if(page)pages[page-1].evidence.push({kind:key,...item});}
  for(const item of [...paper.clips||[],...paper.annotations||[]]){const page=validSourcePage(item.page,pages.length);if(page)pages[page-1].notes.push(item);}
  return pages;
}
export function logicLayout(nodes, compact=false) {
  const width=compact?320:640;const cardWidth=256;const cardHeight=132;const step=compact?172:188;
  const positions=nodes.map((node,index)=>{
    const row=compact?index:Math.floor(index/2);const column=compact?0:row%2===0?index%2:1-index%2;
    return {node,index,key:logicKey(node),x:compact?32:column===0?32:352,y:32+row*step,width:cardWidth,height:cardHeight};
  });
  const edges=positions.slice(1).map((target,index)=>{const from=positions[index];let d;
    if(from.y===target.y){const right=target.x>from.x;const x1=right?from.x+cardWidth:from.x;const x2=right?target.x:target.x+cardWidth;const y=from.y+cardHeight/2;d=`M ${x1} ${y} C ${(x1+x2)/2} ${y}, ${(x1+x2)/2} ${y}, ${x2} ${y}`;}
    else{const x1=from.x+cardWidth/2,y1=from.y+cardHeight,x2=target.x+cardWidth/2,y2=target.y;d=`M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}`;}
    return {from:index,to:index+1,d};
  });
  return {compact,width,height:positions.length?positions.at(-1).y+cardHeight+32:200,positions,edges};
}
