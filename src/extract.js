import { pdfjs } from './pdf.js';
import mammoth from 'mammoth/mammoth.browser';
import { localExtract, uid } from './core.js';
import { renderPageImage, wordImages } from './visuals.js';
import { pageCrops } from './crops.js';
export { pdfjs };

export async function extractPaper(file, onProgress = () => {}) {
  const type = file.name.split('.').pop().toLowerCase();
  if (!['pdf','docx'].includes(type)) throw new Error(type === 'doc' ? '旧版 .doc 请先在 Word 中另存为 .docx，再拖入砚读' : '请选择 PDF 或 Word (.docx) 格式的论文');
  if (file.size > 50 * 1024 * 1024) throw new Error('单篇文件请控制在 50 MB 以内');
  if (!file.size) throw new Error('这个文件为空，请重新选择');
  const buffer = await file.arrayBuffer();
  let pages = []; let metadata = {}; const visuals=[]; let skippedImages=0;
  if (type === 'pdf') {
    let pdf;
    try { pdf = await pdfjs.getDocument({ data:buffer, cMapUrl:'/cmaps/', cMapPacked:true, standardFontDataUrl:'/standard_fonts/', wasmUrl:'/wasm/' }).promise; }
    catch (error) { if (error.name === 'PasswordException') throw new Error('这篇 PDF 已加密，请解除密码后重新导入'); throw new Error('PDF 无法打开，请确认文件完整且格式正确'); }
    try {
      const info = await pdf.getMetadata().catch(() => ({})); metadata = { title:info.info?.Title, author:info.info?.Author };
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n); const content = await page.getTextContent();
        let text = ''; let lastY = null;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform?.[5];
          if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 4 && !text.endsWith('\n')) text += '\n';
          text += item.str + (item.hasEOL ? '\n' : ' '); lastY = y;
        }
        const dataUrl=await renderPageImage(page);
        const cropped=await pageCrops(page,content,dataUrl,n);
        pages.push({ number:n, text:text.trim(), lines:cropped.lines });
        onProgress((n-0.5) / pdf.numPages * 90, `正在读取图文 · ${n} / ${pdf.numPages} 页`);
        visuals.push({id:`page-${n}`,label:`第 ${n} 页`,source:'pdf-page',page:n,dataUrl});
        visuals.push(...cropped.result);
        page.cleanup();
      }
    } finally { await pdf.destroy(); }
  } else {
    let result;
    try { result = await mammoth.extractRawText({ arrayBuffer:buffer }); } catch { throw new Error('Word 文件读取失败，请确认文件是有效的 .docx 格式'); }
    const paragraphs = result.value.split(/\n\s*\n/).filter(x => x.trim());
    let section = '';
    for (const p of paragraphs) { if (section.length + p.length > 4500 && section) { pages.push({ number:pages.length + 1, text:section.trim() }); section = ''; } section += p + '\n\n'; }
    if (section) pages.push({ number:pages.length + 1, text:section.trim() });
    onProgress(85, '正在提取 Word 图像');
    const images=await wordImages(buffer);visuals.push(...images.images);skippedImages=images.skipped;
    if(!pages.length&&visuals.length)pages.push({number:1,text:''});
  }
  const textLength = pages.reduce((sum, p) => sum + p.text.length, 0);
  if (textLength < 60 && !visuals.length) throw new Error('文档中未检测到可读取的文字或图像，请检查文件内容。');
  const analysis = localExtract(pages, file.name, metadata);
  if(textLength<60)analysis.summary='已导入图像型文档。可按页查看原图，AI 将结合附带的页面图像解读。';
  onProgress(100, '原文整理完成');
  return { id:uid(), filename:file.name, type, size:file.size, pages, analysis, visuals, visualsVersion:3, skippedImages, scanned:textLength<60, createdAt:Date.now(), updatedAt:Date.now(), favorite:false, read:false, notes:'', chat:[] };
}
