const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('paperlensDesktop',{
  storage:{
    allPapers:()=>ipcRenderer.invoke('paperlens:storage:all'),
    getPaper:id=>ipcRenderer.invoke('paperlens:storage:paper',id),
    savePaper:(paper,bytes)=>ipcRenderer.invoke('paperlens:storage:save',paper,bytes),
    getFile:id=>ipcRenderer.invoke('paperlens:storage:file',id),
    deletePaper:id=>ipcRenderer.invoke('paperlens:storage:delete',id),
    needsMigration:()=>ipcRenderer.invoke('paperlens:storage:needs-migration'),
  },
  initialBackup:()=>ipcRenderer.invoke('paperlens:initial-backup'),
  completeMigration:()=>ipcRenderer.invoke('paperlens:migration-complete'),
  onCommand:callback=>{const listener=(_event,command)=>{if(['import','backup','help','settings'].includes(command))callback(command);};ipcRenderer.on('paperlens:command',listener);return ()=>ipcRenderer.removeListener('paperlens:command',listener);},
});
