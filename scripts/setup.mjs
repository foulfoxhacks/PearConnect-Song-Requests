import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
try {
  const template = await readFile(new URL('../.env.txt', import.meta.url), 'utf8');
  const content = template.replace(/^TIKFINITY_SECRET=.*$/m, 'TIKFINITY_SECRET=' + randomBytes(32).toString('hex'));
  await writeFile(new URL('../.env', import.meta.url), content, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with a private webhook secret. Open it locally and complete Pear Desktop authentication.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('Existing .env preserved. No settings or tokens were changed.');
  else { console.error('Setup failed:', error.code || error.name); process.exitCode = 1; }
}
