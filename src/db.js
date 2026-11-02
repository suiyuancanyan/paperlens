let handle;
const native=typeof window!=='undefined'?window.paperlensDesktop?.storage:null;
let nativeQueue=Promise.resolve();
function nativeWrite(run){const next=nativeQueue.then(run);nativeQueue=next.catch(()=>{});return next;}

const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('paperlens-updates') : null;
channel?.unref?.();
export function onLibraryChange(listener) { if (channel) channel.addEventListener('message', event => listener(event.data)); }
const announce = (id, deleted = false) => channel?.postMessage({ id, deleted, at:Date.now() });
export function openDB() {
  if (handle) return handle;
  handle = new Promise((resolve, reject) => {
    const request = indexedDB.open('paperlens-library', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('papers', { keyPath:'id' }); request.result.createObjectStore('files'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地文献库，请检查浏览器存储权限'));
  });
  return handle;
}
async function transaction(stores, mode, run) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode); const result = run(tx);
    tx.oncomplete = () => resolve(result?.result); tx.onerror = () => reject(tx.error || new Error('本地保存失败')); tx.onabort = () => reject(tx.error || new Error('本地保存失败'));
  });
}
export const legacyAllPapers=()=>transaction(['papers'],'readonly',tx=>tx.objectStore('papers').getAll());
export const legacyGetFile=id=>transaction(['files'],'readonly',tx=>tx.objectStore('files').get(id));
export const allPapers=()=>native?native.allPapers():legacyAllPapers();
export const getPaper=id=>native?native.getPaper(id):transaction(['papers'],'readonly',tx=>tx.objectStore('papers').get(id));
// Creation never replaces an existing record. Updates must name the changed fields.
export async function savePaper(paper, file) {
  if(native)return nativeWrite(async()=>{const existing=await native.getPaper(paper.id);if(existing)return existing;const saved={...paper,revision:1,history:paper.history||[]};await native.savePaper(saved,file?new Uint8Array(await file.arrayBuffer()):null);announce(paper.id);return saved;});
  const db = await openDB();
  const result = await new Promise((resolve, reject) => {
    const tx = db.transaction(file ? ['papers','files'] : ['papers'], 'readwrite'); const store = tx.objectStore('papers'); let saved;
    const request = store.get(paper.id);
    request.onsuccess = () => { saved = request.result || { ...paper, revision:1, history:paper.history || [] }; if (!request.result) { store.add(saved); if (file) tx.objectStore('files').put(file, paper.id); } };
    tx.oncomplete = () => resolve(saved); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); announce(paper.id); return result;
}
function preparePatch(latest,changes,label){
  if (!latest) throw new Error('这篇论文已被移除，未保存旧页面的更改');
  const patch = typeof changes === 'function' ? changes(structuredClone(latest)) : changes;
  if (!patch || typeof patch !== 'object') throw new Error('没有可保存的修改');
  const history = latest.history || [];
  const fields = Object.keys(patch).filter(key => !['history','updatedAt','revision','readPosition','task'].includes(key) && JSON.stringify(latest[key]) !== JSON.stringify(patch[key]));
  const previous = Object.fromEntries(fields.map(key => [key, latest[key] ?? null]));
  if (patch.metadataOverrides && fields.length) previous.analysis = latest.analysis;
  const last = history[history.length - 1];
  if (label && fields.length && !(label === '编辑笔记' && last?.label === label && Date.now()-last.at < 30000)) history.push({id:crypto.randomUUID(), at:Date.now(),label,fields:previous});
  const next = { ...latest, ...patch, history:history.slice(-16), updatedAt:Date.now(), revision:(latest.revision || 0)+1 };
  if (patch.analysis || patch.metadataOverrides) next.analysis = { ...next.analysis, ...next.metadataOverrides };
  return next;
}
export async function patchPaper(id, changes, label = '') {
  if(native)return nativeWrite(async()=>{const latest=await native.getPaper(id);const next=preparePatch(latest,changes,label);await native.savePaper(next);announce(id);return next;});
  const db = await openDB();
  const result = await new Promise((resolve, reject) => {
    const tx = db.transaction(['papers'], 'readwrite'); const store = tx.objectStore('papers'); let next; let failure;
    const request = store.get(id);
    request.onsuccess = () => {
      try {
        next=preparePatch(request.result,changes,label);
        store.put(next);
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next); tx.onerror = () => reject(failure || tx.error); tx.onabort = () => reject(failure || tx.error || new Error('本地保存失败'));
  }); announce(id); return result;
}
export const getFile=async id=>{if(!native)return legacyGetFile(id);const bytes=await native.getFile(id);return bytes?new Blob([bytes]):undefined;};
export async function deletePaper(id) { if(native){await nativeWrite(()=>native.deletePaper(id));announce(id,true);return;}await transaction(['papers','files'], 'readwrite', tx => { tx.objectStore('papers').delete(id); tx.objectStore('files').delete(id); }); announce(id,true); }
