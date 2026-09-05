const { contextBridge, ipcRenderer } = require('electron');
const call = (operation, payload) => ipcRenderer.invoke('pearconnect', operation, payload);
// No raw IPC, HTTP, filesystem, shell, credential read or arbitrary command API.
contextBridge.exposeInMainWorld('pearconnect', Object.freeze({
  openLastfmSetup: () => call('openLastfmSetup'), openLastfmTerms: () => call('openLastfmTerms'),
  appearance: values => call('appearance', values), removeLastfm: () => call('removeLastfm'), similarTracks: () => call('similarTracks'), openTrackInfo: () => call('openTrackInfo'), copyOverlay: () => call('copyOverlay'), rotateOverlay: () => call('rotateOverlay'),
  snapshot: () => call('snapshot'), testPlayer: () => call('testPlayer'), authorize: () => call('authorize'),
  beginVerification: () => call('beginVerification'), verifySong: value => call('verifySong', value), finishVerification: () => call('finishVerification'),
  copyTestCommand: () => call('copyTestCommand'),
  createSession: values => call('createSession', values), updateSession: values => call('updateSession', values),
  endSession: () => call('endSession'), pairDashboard: () => call('pairDashboard'), copySessionLink: () => call('copySessionLink'),
  pause: () => call('pause'), resume: () => call('resume'), mode: value => call('mode', value),
  rules: values => call('rules', values), connections: values => call('connections', values),
  testRequest: values => call('testRequest', values), playerQueue: () => call('playerQueue'),
  testIntegration: () => call('testIntegration'),
  reconnect: () => call('reconnect'), disconnect: () => call('disconnect'),
  importConfig: () => call('importConfig'), copyEndpoint: () => call('copyEndpoint'),
  revealSecret: () => call('revealSecret'), rotateSecret: () => call('rotateSecret'),
  exportActions: () => call('exportActions'), openPlayer: () => call('openPlayer'),
  previewDiagnostics: () => call('previewDiagnostics'), exportDiagnostics: () => call('exportDiagnostics'),
}));
