import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function prepareStudio(target){
  async function edit(file,from,to){const p=join(target,file);const text=await readFile(p,'utf8');if(text.split(from).length!==2)throw Error(`Studio marker missing or repeated in ${file}`);await writeFile(p,text.replace(from,to));}
  await edit('src/index.ts',"import path from 'node:path';","import { setupStudio } from './pearconnect/studio';\nimport path from 'node:path';");
  await edit('src/index.ts','  const win = new BrowserWindow(electronWindowSettings);','  const win = new BrowserWindow(electronWindowSettings);\n  await setupStudio(win);');
  await edit('src/menu.ts',"import is from 'electron-is';","import { openStudio } from './pearconnect/studio';\nimport is from 'electron-is';");
  await edit('src/menu.ts',"  return [\n    {\n      label: t('main.menu.plugins.label'),","  return [\n    { label: 'PearConnect', submenu: [\n      { label: 'Player Studio', accelerator: 'CmdOrCtrl+Shift+P', click: () => { void openStudio(win); } },\n      { label: 'Documentation', click: () => { void shell.openExternal('https://pearconnect.mellozone.site/docs/'); } },\n    ] },\n    {\n      label: t('main.menu.plugins.label'),");
  await edit('src/renderer.ts',"import { createQueueCompatibility } from './queue-compat';","import { mountPearConnect } from './pearconnect/renderer';\nimport { createQueueCompatibility } from './queue-compat';");
  await edit('src/renderer.ts','registerWindowDefaultTrustedTypePolicy();','registerWindowDefaultTrustedTypePolicy();\nmountPearConnect();');
  await edit('src/config/defaults.ts',"customWindowTitle: 'PearConnect Player · Queue edition'","customWindowTitle: 'PearConnect Player'");
}
