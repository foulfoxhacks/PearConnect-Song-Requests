import electron from 'electron';
import { launchDesktop } from './runtime.js';
const { app, dialog } = electron;
app.setName('PearConnect Desktop');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window;
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(async () => { ({ window } = await launchDesktop()); }).catch(() => { dialog.showErrorBox('PearConnect could not open', 'Check the local application data folder and restart PearConnect.'); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
