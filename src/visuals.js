import { pdfjs } from './pdf.js';
import mammoth from 'mammoth/mammoth.browser';

export const safeImageURL = value => typeof value === 'string' && (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(value) || /^\/samples\/[a-z0-9-]+\.png$/.test(value)) ? value : '';
export function canvasJPEG(canvas, quality = 0.82) { return canvas.toDataURL('image/jpeg',quality); }
export async function renderPageImage(page, maxWidth = 720) {
  const base = page.getViewport({scale:1});
  const scale = Math.min(maxWidth/base.width,2200/base.height);
  const viewport = page.getViewport({scale});
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
  const dataUrl = canvasJPEG(canvas); canvas.width=0;canvas.height=0;return dataUrl;
}
export async function normalizeImage(dataUrl,maxWidth = 1600) {
  const blob = await fetch(dataUrl).then(r=>r.blob());
  const image = await createImageBitmap(blob);
  const scale = Math.min(1,maxWidth/image.width,2200/image.height);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
  const result=canvasJPEG(canvas);canvas.width=0;canvas.height=0;return result;
}
export async function wordImages(arrayBuffer) {
  const images=[];let skipped=0;
  const result=await mammoth.convertToHtml({arrayBuffer},{convertImage:mammoth.images.imgElement(async image=>{
    if(!['image/png','image/jpeg','image/gif','image/webp'].includes(image.contentType)){skipped++;return {src:''};}
    try{
      const encoded=await image.readAsBase64String();
      if(encoded.length>20_000_000){skipped++;return {src:''};}
      const dataUrl=await normalizeImage(`data:${image.contentType};base64,${encoded}`);
      const id=`word-image-${images.length+1}`;
      images.push({id,label:`文档图像 ${images.length+1}`,source:'docx-image',page:null,dataUrl});
      return {src:id};
    }catch{skipped++;return {src:''};}
  })});
  const html=new DOMParser().parseFromString(result.value,'text/html');
  for(const img of html.querySelectorAll('img')){
    const visual=images.find(v=>v.id===img.getAttribute('src'));if(!visual)continue;
    const block=img.closest('p')||img;let next=block.nextElementSibling;
    for(let i=0;i<2&&next;i++,next=next.nextElementSibling){const caption=next.textContent.trim();if(/^(fig(?:ure)?\.?\s*\d|图\s*\d)/i.test(caption)){visual.label=caption.slice(0,250);break;}}
  }
  return {images,skipped};
}
export async function extractVisuals(file,onProgress=()=>{}) {
  if(file.name.toLowerCase().endsWith('.docx'))return (await wordImages(await file.arrayBuffer())).images;
  const doc=await pdfjs.getDocument({data:await file.arrayBuffer(),cMapUrl:'/cmaps/',cMapPacked:true,standardFontDataUrl:'/standard_fonts/',wasmUrl:'/wasm/'}).promise;
  const images=[];
  try{for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);images.push({id:`page-${n}`,label:`第 ${n} 页`,source:'pdf-page',page:n,dataUrl:await renderPageImage(page)});onProgress(n,doc.numPages);page.cleanup();}}finally{await doc.destroy();}
  return images;
}
