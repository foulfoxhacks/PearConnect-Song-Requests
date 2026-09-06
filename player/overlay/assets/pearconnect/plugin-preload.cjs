const { contextBridge, ipcRenderer } = require('electron');
// Permission is checked in main for every call, not entrusted to plugin code.
contextBridge.exposeInMainWorld('pearconnect', Object.freeze({
  version: 1,
  getPlayback: () => ipcRenderer.invoke('pearconnect:plugin-playback'),
}));
