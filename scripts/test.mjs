import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const args of [['scripts/smoke.mjs'], ['--test', ...(await readdir('test')).filter(name => name.endsWith('.test.js')).sort().map(name => `test/${name}`)]]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
