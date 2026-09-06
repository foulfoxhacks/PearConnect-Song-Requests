import { randomUUID } from 'node:crypto';
import { ipcMain, type BrowserWindow } from 'electron';
import type { QueueResult } from '../queue-compat';

export function queueRequest(win: BrowserWindow, videoId: string, position: string, preview = false): Promise<QueueResult> {
  const requestId = randomUUID();
  const deadline = Date.now() + 8000;
  return new Promise(resolve => {
    const complete = (result: QueueResult) => {
      clearTimeout(timer);
      ipcMain.removeListener('pearconnect:queue-result', listener);
      resolve(result);
    };
    const listener = (event: Electron.IpcMainEvent, id: unknown, result: QueueResult) => {
      if (event.sender !== win.webContents || id !== requestId || result?.videoId !== videoId || typeof result?.ok !== 'boolean') return;
      complete(result);
    };
    const timer = setTimeout(() => complete({ ok: false, code: 'queue_timeout', videoId, outcomeUncertain: !preview }), 8500);
    ipcMain.on('pearconnect:queue-result', listener);
    try { win.webContents.send('ytmd:add-to-queue', videoId, position, requestId, deadline, preview); }
    catch { complete({ ok: false, code: 'queue_not_ready', videoId }); }
  });
}
