const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  openFile: () => ipcRenderer.invoke('open-file'),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  scanLocalModels: () => ipcRenderer.invoke('scan-local-models'),
  aiChat: (payload) => ipcRenderer.invoke('ai-chat', payload),
  runCommand: (cmd) => ipcRenderer.invoke('run-command', cmd),
  renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', { oldPath, newName }),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  createFile: (dirPath, name) => ipcRenderer.invoke('create-file', { dirPath, name }),
  createFolder: (dirPath, name) => ipcRenderer.invoke('create-folder', { dirPath, name }),
  renameFolder: (oldPath, newName) => ipcRenderer.invoke('rename-folder', { oldPath, newName }),
  deleteFolder: (folderPath) => ipcRenderer.invoke('delete-folder', folderPath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});
