import { canvasJPEG } from './visuals.js';
export function pageLines(content, viewport) {
  const lines=[];
  for(const item of content.items){if(!item.str?.trim())continue;const x=item.transform[4]*viewport.scale;const y=viewport.height-item.transform[5]*viewport.scale;const size=Math.abs(item.transform[3])*viewport.scale;
    let line=lines.find(l=>Math.abs(l.y-y)<3*viewport.scale);if(!line){line={text:'',x,y,size,width:0};lines.push(line);}line.text+=(line.text?' ':'')+item.str;line.x=Math.min(line.x,x);line.width=Math.max(line.width,x+item.width*viewport.scale-line.x);line.size=Math.max(line.size,size);
  }return lines.sort((a,b)=>a.y-b.y||a.x-b.x);
}
export function captionRegions(lines,width,height) {
  const captions=lines.filter(l=>/^(?:Figure\s*\d+|Fig\.\s*\d+|Table\s*\d+|[图表]\s*\d+)[\s.:：]/i.test(l.text.trim()));
  return captions.map((line,index)=>{
    const table=/^(Table|表)/i.test(line.text);let top,bottom;
    if(table){top=Math.max(0,line.y-line.size*1.6);const next=lines.find(l=>l.y>line.y+height*.18&&l.text.length>90);bottom=Math.min(captions[index+1]?.y||height*.94,next?next.y-next.size*1.5:line.y+height*.38);}
    else{const previous=lines.filter(l=>l.y<line.y-line.size*2&&l.text.length>80&&l.width>width*.6).at(-1);top=Math.max(height*.04,previous?previous.y+line.size*.6:height*.04);bottom=Math.min(height*.97,line.y+line.size*2.3);}
    if(bottom-top<height*.08)top=Math.max(height*.04,bottom-height*.3);
    const label=line.text.match(/^(?:Figure\s*\d+|Fig\.\s*\d+|Table\s*\d+|[图表]\s*\d+)/i)?.[0]||'图表';
    return {label,caption:line.text,bbox:[.075,top/height,.85,Math.min(.94,(bottom-top)/height)]};
  });
}
export async function cropImage(dataUrl,bbox) {
  const image=await createImageBitmap(await fetch(dataUrl).then(r=>r.blob()));const [x,y,w,h]=bbox;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*w));canvas.height=Math.max(1,Math.round(image.height*h));canvas.getContext('2d').drawImage(image,x*image.width,y*image.height,w*image.width,h*image.height,0,0,canvas.width,canvas.height);image.close();return canvasJPEG(canvas,.9);
}
export async function pageCrops(page,content,dataUrl,number) {
  const viewport=page.getViewport({scale:1});const lines=pageLines(content,viewport);const regions=captionRegions(lines,viewport.width,viewport.height);const result=[];
  for(const [index,region] of regions.entries())result.push({id:`crop-${number}-${index}`,page:number,source:'pdf-crop',label:region.label,caption:region.caption,bbox:region.bbox,autoCrop:true,dataUrl:await cropImage(dataUrl,region.bbox)});
  return {lines,result};
}
export function figureVisuals(p,filter='figures') {
  const all=p.visuals||[];
  if(filter==='all')return all;
  if(filter==='pages')return all.filter(v=>v.source==='pdf-page');
  const crops=all.filter(v=>v.source!=='pdf-page');
  return crops.length?crops:all.filter(v=>p.analysis.figures.some(f=>f.page===v.page));
}
