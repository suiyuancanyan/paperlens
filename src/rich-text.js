import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {escapeHTML} from './core.js';
export function readingHTML(value, pageCount = 9999) {
  const math=[];
  let text=String(value||'').replace(/\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([^\n]+?)\\\)|(?<!\\)\$([^$\n]+?)\$/g,(_,block,dollars,inline,single)=>{
    const formula=block||dollars||inline||single;
    let html;try {html=katex.renderToString(formula,{displayMode:Boolean(block||dollars),throwOnError:false,trust:false,strict:'ignore',maxExpand:200,maxSize:12});}catch{html=escapeHTML(formula);}
    math.push(html);return `PAPERLENSMATH${math.length-1}TOKEN`;
  });
  const bold=[];text=text.replace(/\*\*([^*\n]{1,2000})\*\*/g,(_,value)=>{bold.push('<strong>'+escapeHTML(value)+'</strong>');return `PAPERLENSBOLD${bold.length-1}TOKEN`;});
  const renderer=new Renderer();renderer.html=token=>escapeHTML(token.text);
  let html=marked.parse(text,{breaks:true,renderer});
  html=DOMPurify.sanitize(html,{FORBID_TAGS:['img','style','input','form'],FORBID_ATTR:['style']});
  html=html.replace(/PAPERLENSBOLD(\d+)TOKEN/g,(_,n)=>bold[Number(n)]||'');
  html=html.replace(/PAPERLENSMATH(\d+)TOKEN/g,(_,n)=>math[Number(n)]||'');
  const host=document.createElement('div');host.innerHTML=html;
  const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);const nodes=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('a,button,.katex,code,pre'))nodes.push(walker.currentNode);
  const regex=/[\[【]?(?:第\s*(\d+)(?:\s*[-—–至、,，]\s*(\d+))?\s*页|p(?:age)?\.?\s*(\d+))[\]】]?/gi;
  for(const node of nodes){const original=node.textContent;regex.lastIndex=0;if(!regex.test(original))continue;regex.lastIndex=0;const frag=document.createDocumentFragment();let offset=0;let match;
    while((match=regex.exec(original))){frag.append(original.slice(offset,match.index));const start=Number(match[1]||match[3]);const end=Number(match[2]||start);
      if(start>=1&&start<=pageCount){const button=document.createElement('button');button.className='source-link';button.dataset.page=String(start);button.dataset.sourceQuery=original.slice(Math.max(0,match.index-140),match.index).replace(/[^\p{L}\p{N}\s]/gu,' ').trim();button.textContent=match[0];button.title=`查看原文第 ${start}${end!==start?'—'+end:''} 页`;frag.append(button);}else frag.append(match[0]);offset=regex.lastIndex;
    }frag.append(original.slice(offset));node.replaceWith(frag);
  }
  host.querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});return host.innerHTML;
}
