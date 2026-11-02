import {readFile,writeFile,mkdir} from 'node:fs/promises';
import JSZip from 'jszip';
await mkdir('artifacts/test-fixtures',{recursive:true});
const zip=await JSZip.loadAsync(await readFile('artifacts/test-fixtures/validation.docx'));
zip.file('[Content_Types].xml',(await zip.file('[Content_Types].xml').async('string')).replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>'));
zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure.png"/></Relationships>');
zip.file('word/media/figure.png',await readFile('public/samples/transformer-architecture.png'));
let xml=await zip.file('word/document.xml').async('string');
xml=xml.replace('<w:body>','<w:body>').replace('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"','xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"');
xml=xml.replace('</w:body>','<w:p><w:r><w:drawing><wp:inline><wp:extent cx="3600000" cy="4800000"/><wp:docPr id="1" name="Figure" descr="Transformer architecture"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="figure.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3600000" cy="4800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:p><w:r><w:t>图 2：Word 内嵌图片功能验证（原图来源：Vaswani et al.）</w:t></w:r></w:p></w:body>');
zip.file('word/document.xml',xml);
await writeFile('artifacts/test-fixtures/validation-images.docx',await zip.generateAsync({type:'nodebuffer'}));
const stream=`BT /F1 18 Tf 45 780 Td (PaperLens Visual Reading Validation) Tj 0 -34 Td /F1 11 Tf (Synthetic fixture. This document tests PDF vector rendering, not research outcomes.) Tj ET
0.93 0.96 0.88 rg 45 300 505 340 re f
0.15 0.35 0.25 rg 75 400 110 100 re f
0.4 0.58 0.3 rg 245 400 110 100 re f
0.65 0.73 0.45 rg 415 400 110 100 re f
0.35 0.48 0.26 RG 2 w 185 450 m 245 450 l S 355 450 m 415 450 l S
1 1 1 rg BT /F1 16 Tf 90 445 Td (IMPORT) Tj 170 0 Td (EXTRACT) Tj 180 0 Td (READ) Tj ET
0.15 0.27 0.15 rg BT /F1 13 Tf 55 270 Td (Figure 1: A vector workflow connecting import, extraction and reading.) Tj 0 -35 Td /F1 11 Tf (Method: Preserve the original page as an image and interpret the visible structure.) Tj 0 -25 Td (The diagram is drawn with PDF vector operators; it is not a raster image.) Tj ET`;
const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n';const offsets=[];for(const [i,obj]of objs.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;}
const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
await writeFile('artifacts/test-fixtures/validation-visual.pdf',pdf);
console.log('PDF vector and Word embedded-image fixtures ready');
