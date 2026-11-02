const { app, BrowserWindow, Menu, dialog, ipcMain, shell, screen, utilityProcess } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {randomUUID}=require('node:crypto');
const fsp = require('node:fs/promises');
const { resolveCodexPath } = require('./paths.cjs');
const {createLibraryStore}=require('./library-store.cjs');

app.setName('砚读 PaperLens');
app.setAppUserModelId('cn.paperlens.desktop');
const userData = process.env.PAPERLENS_USER_DATA_DIR || path.join(app.getPath('appData'), 'PaperLens');
app.setPath('userData', userData);
const libraryData = process.env.PAPERLENS_USER_DATA_DIR || path.join(app.getPath('documents'), 'PaperLens资料');
const port = Number(process.env.PAPERLENS_DESKTOP_PORT || 4174);
const origin = `http://127.0.0.1:${port}`;
const instance=randomUUID();let backendStopped=false;let quitRequested=false;
let window; let backend; let quitting = false; let startupError = '';
const migrationFile = path.join(userData, 'migration', 'initial-backup.json');
const migrationDone = path.join(userData, 'migration', 'completed.json');
const nativeStorageReady=path.join(libraryData,'migration','native-storage-v1.json');
const library=createLibraryStore(libraryData);
const icon = path.join(__dirname, 'icon.ico');

function log(message) {
  try { fs.mkdirSync(path.join(userData,'logs'),{recursive:true});fs.appendFileSync(path.join(userData,'logs','desktop.log'), `${new Date().toISOString()} ${message}\n`); } catch {}
}
function trusted(event) { if (!event.senderFrame || !event.senderFrame.url.startsWith(origin+'/')) throw new Error('请求来源无效'); }
function openExternal(url) { try { if (['https:','http:'].includes(new URL(url).protocol)) shell.openExternal(url); } catch {} }
function sendCommand(command) { window?.webContents.send('paperlens:command',command); }
function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label:'文件', submenu:[{label:'导入论文…',accelerator:'CmdOrCtrl+O',click:()=>sendCommand('import')},{label:'导出完整备份…',accelerator:'CmdOrCtrl+Shift+S',click:()=>sendCommand('backup')},{type:'separator'},{label:'退出砚读',accelerator:'Alt+F4',click:()=>window?.close()}] },
    { label:'编辑', submenu:[{label:'撤销',role:'undo'},{label:'重做',role:'redo'},{type:'separator'},{label:'剪切',role:'cut'},{label:'复制',role:'copy'},{label:'粘贴',role:'paste'},{label:'全选',role:'selectAll'}] },
    { label:'视图', submenu:[{label:'实际大小',role:'resetZoom'},{label:'放大界面',role:'zoomIn'},{label:'缩小界面',role:'zoomOut'},{type:'separator'},{label:'全屏',role:'togglefullscreen'}] },
    { label:'帮助', submenu:[{label:'使用指南与备份',click:()=>sendCommand('help')},{label:'模型与阅读设置',click:()=>sendCommand('settings')},{type:'separator'},{label:'打开资料文件夹',click:()=>shell.openPath(libraryData)},{label:'关于砚读',click:()=>dialog.showMessageBox(window,{type:'info',title:'关于砚读',message:'砚读 PaperLens',detail:`版本 ${app.getVersion()}\n论文图文阅读与研究工作台\n\n文献、笔记与阅读位置保存在：\n${libraryData}\n\nAI 解读使用设置中选择的模型服务。`})}] },
  ]));
}
async function startBackend() {
  const runtime = app.isPackaged ? path.join(process.resourcesPath,'runtime') : path.join(__dirname,'..','desktop-runtime');
  const executable = await resolveCodexPath(process.env, path.dirname(process.execPath));
  const env = {...process.env,PORT:String(port),PAPERLENS_DESKTOP_INSTANCE:instance,...(executable?{PAPERLENS_CODEX_PATH:executable}:{})};
  // The service runs with Electron's bundled Node runtime; no system Node is needed.
  backend = utilityProcess.fork(path.join(runtime,'server.mjs'),['--production'],{cwd:userData,env,stdio:'pipe',serviceName:'砚读本地服务'});
  backend.stdout?.on('data',chunk=>log(chunk.toString().trim()));
  backend.stderr?.on('data',chunk=>{startupError=chunk.toString().slice(-3000);log(startupError);});
  backend.on('exit',code=>{backendStopped=true;if(!quitting){log(`Backend exited ${code}`);if(window)dialog.showMessageBox(window,{type:'error',title:'砚读本地服务已停止',message:'请关闭砚读后重新打开，已保存的文献与笔记会保留。'});}});
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    if(startupError.includes('EADDRINUSE')) throw new Error('砚读的本地服务地址正被其他程序占用。请关闭其他砚读窗口后重试。');
    try {const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)});const status=await response.json();if(response.ok&&status.app==='paperlens'&&status.instance===instance)return;} catch {}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error('砚读启动未完成。请重新打开应用；详细记录已保存在资料文件夹的 logs 中。');
}
async function createWindow() {
  const area=screen.getPrimaryDisplay().workAreaSize;
  window = new BrowserWindow({width:Math.min(1340,area.width-70),height:Math.min(920,area.height-60),minWidth:900,minHeight:620,title:'砚读 PaperLens',backgroundColor:'#f7f8f2',icon,show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false,backgroundThrottling:false}});
  window.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/')){event.preventDefault();openExternal(url);}});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.webContents.on('will-prevent-unload',event=>{const choice=dialog.showMessageBoxSync(window,{type:'question',title:'仍有论文正在整理',message:'退出后会中断当前整理，重新打开可重试。',buttons:['继续阅读','退出应用'],defaultId:0,cancelId:0});if(choice===1)event.preventDefault();});
  window.webContents.on('did-fail-load',(_event,code,description)=>log(`Page load failed ${code}: ${description}`));
  window.once('ready-to-show',()=>window.show());
  window.on('closed',()=>{window=null;});
  await window.loadURL(origin+'/');
}

if(!app.requestSingleInstanceLock()){app.quit();}else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(async()=>{
    await fsp.mkdir(userData,{recursive:true});await fsp.mkdir(path.dirname(nativeStorageReady),{recursive:true});menu();
    // Adopt existing desktop records once; keep their originals available.
    const previousLibrary=createLibraryStore(userData);
    for(const paper of await previousLibrary.allPapers())if(!await library.getPaper(paper.id))await library.savePaper(paper,await previousLibrary.getFile(paper.id));
    ipcMain.handle('paperlens:storage:all',async event=>{trusted(event);return library.allPapers();});
    ipcMain.handle('paperlens:storage:paper',async(event,id)=>{trusted(event);return library.getPaper(id);});
    ipcMain.handle('paperlens:storage:save',async(event,paper,bytes)=>{trusted(event);return library.savePaper(paper,bytes);});
    ipcMain.handle('paperlens:storage:file',async(event,id)=>{trusted(event);return library.getFile(id);});
    ipcMain.handle('paperlens:storage:delete',async(event,id)=>{trusted(event);return library.deletePaper(id);});
    ipcMain.handle('paperlens:storage:needs-migration',async event=>{trusted(event);return !fs.existsSync(nativeStorageReady);});
    ipcMain.handle('paperlens:initial-backup',async event=>{trusted(event);if(fs.existsSync(nativeStorageReady)||!fs.existsSync(migrationFile))return null;const info=await fsp.stat(migrationFile);if(info.size>300*1024*1024)throw new Error('迁移备份超过 300 MB，请通过使用指南手动恢复');return fsp.readFile(migrationFile,'utf8');});
    ipcMain.handle('paperlens:migration-complete',async event=>{trusted(event);await fsp.mkdir(path.dirname(migrationDone),{recursive:true});const completed=JSON.stringify({completedAt:new Date().toISOString()});await fsp.writeFile(migrationDone,completed);await fsp.writeFile(nativeStorageReady,completed);return true;});
    try {await startBackend();await createWindow();}catch(error){log(error.stack||error.message);await dialog.showMessageBox({type:'error',title:'砚读暂时无法启动',message:error.message});app.quit();}
  });
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',event=>{quitting=true;if(backend&&!backendStopped){event.preventDefault();if(quitRequested)return;quitRequested=true;backend.postMessage({type:'paperlens:shutdown'});backend.once('exit',()=>app.quit());setTimeout(()=>{if(!backendStopped)backend.kill();app.quit();},2200).unref();}});
}
