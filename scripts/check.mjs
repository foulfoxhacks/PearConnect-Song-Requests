import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const dir of ['src', 'scripts', 'test', 'desktop']) {
  const files = await readdir(dir, { recursive: true });
  for (const file of files.filter(name => /\.(mjs|cjs|js)$/.test(name))) {
    const result = spawnSync(process.execPath, ['--check', `${dir}/${file}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
const p = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
if (p.name !== lock.name || p.name !== lock.packages[''].name || p.version !== lock.version || p.version !== lock.packages[''].version) throw new Error('Package/lock metadata mismatch');
if (JSON.stringify(p.dependencies) !== JSON.stringify(lock.packages[''].dependencies)) throw new Error('Lock dependencies mismatch');
console.log('JavaScript syntax and package metadata checks passed.');
