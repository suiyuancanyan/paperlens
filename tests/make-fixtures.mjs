import { mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
await mkdir('artifacts/test-fixtures', { recursive:true });
const lines = [
  'PaperLens Import Validation', 'Example Author', '', 'Abstract',
  'We propose a structured workflow for reading scientific documents.',
  'This is a software validation fixture, not an empirical research paper.',
  'The workflow connects questions, methods, evidence, and conclusions.',
  '', '1 Introduction', 'We use a small synthetic dataset to test document import.',
  '', 'Figure 1: Document processing workflow',
  'Import -> Extract -> Organize -> Read',
  '', '2 Results', 'The results show that content can be organized into reading cards.',
  'Table 1: Functional validation checklist', 'PDF import: check. Word import: check.'
];
const stream = 'BT /F1 15 Tf 48 780 Td 22 TL ' + lines.map((x,i) => `${i ? 'T* ' : ''}(${x.replace(/[()\\]/g,'\\$&')}) Tj`).join('\n') + ' ET';
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
];
let pdf='%PDF-1.4\n'; const offsets=[0];
for (let i=0;i<objs.length;i++) { offsets.push(Buffer.byteLength(pdf)); pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`; }
const xref=Buffer.byteLength(pdf);
pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(x => String(x).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
await writeFile('artifacts/test-fixtures/validation.pdf',pdf);
const zip=new JSZip();
zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+['砚读 Word 导入验证文档','软件功能验证示例','摘要','本文提出面向文献阅读的结构化整理流程。这是用于软件功能检查的合成文档，不包含真实研究数据。','1 引言','本研究提出一个从研究问题到证据和结论的阅读流程。','图 1：文献整理流程示意','研究问题、方法与结果按原文顺序整理。','2 数据与结果','本示例数据集由合成文本构成，仅用于检查导入功能。','表 1：文献整理字段','结果表明，文献内容可以按研究问题、方法和结论组织成阅读卡片。'].map(x=>`<w:p><w:r><w:t>${x}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>');
await writeFile('artifacts/test-fixtures/validation.docx',await zip.generateAsync({type:'nodebuffer'}));
console.log('Test fixtures ready');
