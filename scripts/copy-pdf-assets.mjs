import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
for (const folder of ['cmaps','standard_fonts','wasm']) {
  await mkdir('public', { recursive:true });
  await cp(path.join('node_modules','pdfjs-dist',folder), path.join('public',folder), { recursive:true });
}
console.log('PDF rendering assets ready');
