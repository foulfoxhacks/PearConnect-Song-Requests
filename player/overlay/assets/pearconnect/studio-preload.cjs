const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pearStudio', Object.freeze({
  status: () => ipcRenderer.invoke('pearconnect:studio', 'status'),
  appearance: value => ipcRenderer.invoke('pearconnect:studio', 'appearance', value),
  importBackground: () => ipcRenderer.invoke('pearconnect:studio', 'background'),
  removeBackground: () => ipcRenderer.invoke('pearconnect:studio', 'remove-background'),
  importPlugin: () => ipcRenderer.invoke('pearconnect:studio', 'import-plugin'),
  openPlugin: id => ipcRenderer.invoke('pearconnect:studio', 'open-plugin', id),
  stopPlugin: id => ipcRenderer.invoke('pearconnect:studio', 'stop-plugin', id),
  removePlugin: id => ipcRenderer.invoke('pearconnect:studio', 'remove-plugin', id),
  sponsor: value => ipcRenderer.invoke('pearconnect:studio', 'sponsor', value),
  focusPlayer: () => ipcRenderer.invoke('pearconnect:studio', 'focus-player'),
  examplePlugin: () => ipcRenderer.invoke('pearconnect:studio', 'example-plugin'),
}));
