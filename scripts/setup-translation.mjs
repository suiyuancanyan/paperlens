import { ensureTranslationRuntime } from '../translation-runtime.mjs';
try { console.log('翻译环境已就绪：' + await ensureTranslationRuntime({onProgress:console.log,onOutput:chunk=>process.stdout.write(chunk)})); }
catch (error) { console.error(error.message); process.exitCode = 1; }
