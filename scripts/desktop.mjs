import electron from 'electron';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [fileURLToPath(new URL('../desktop/main.mjs', import.meta.url))], { stdio: 'inherit', windowsHide: true, env });
child.on('error', () => { console.error('Could not launch Electron. Install desktop development dependencies first.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
