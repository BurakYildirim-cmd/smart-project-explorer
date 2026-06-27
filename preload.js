const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  openFile: () => ipcRenderer.invoke('open-file'),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});
