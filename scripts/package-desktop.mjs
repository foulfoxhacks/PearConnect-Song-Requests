import { packager } from '@electron/packager';
import { mkdtemp, cp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { listPackage } from '@electron/asar';
await mkdir('dist/staging', { recursive: true });
const stage = await mkdtemp(resolve('dist/staging/desktop-'));
for (const path of ['src', 'desktop', 'integrations', 'LICENSE', 'package-lock.json']) await cp(path, join(stage, path), { recursive: true });
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
pkg.main = 'desktop/main.mjs';
await writeFile(join(stage, 'package.json'), JSON.stringify(pkg, null, 2));
const installed = spawnSync(process.execPath, [process.env.npm_execpath, 'ci', '--omit=dev', '--ignore-scripts'], { cwd: stage, stdio: 'inherit' });
if (installed.status !== 0) process.exit(installed.status || 1);
const paths = await packager({ dir: stage, name: 'PearConnect', executableName: 'PearConnect', platform: 'win32', arch: 'x64', out: resolve('dist'), overwrite: true,
  asar: true, prune: false, electronVersion: pkg.devDependencies.electron.replace(/^[~^]/, ''), appVersion: pkg.version, appCopyright: 'MIT · PearConnect contributors',
  win32metadata: { CompanyName: 'PearConnect', FileDescription: 'PearConnect Desktop', ProductName: 'PearConnect' } });
console.log(`Windows portable application created: ${paths[0]}`);
const entries = listPackage(join(paths[0], 'resources', 'app.asar'));
if (entries.some(path => /(?:^|[\\/])(?:\.env|settings\.json|\.git)(?:$|[\\/])/.test(path) || /[\\/]node_modules[\\/]electron[\\/]/.test(path))) throw new Error('Unexpected private/development files in application archive.');
const hash = createHash('sha256').update(await readFile(join(paths[0], 'PearConnect.exe'))).digest('hex');
await writeFile(join(paths[0], 'BUILD-INFO.txt'), `PearConnect ${pkg.version}\nElectron ${pkg.devDependencies.electron}\nWindows x64 portable preview\nExecutable SHA-256: ${hash}\nUnsigned community build. Unzip the complete folder before running PearConnect.exe.\n`);
console.log('Packaged archive checked: no .env, saved credentials, Git metadata or Electron development dependency.');
