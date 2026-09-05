import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from './helpers.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const cleanEnv = { ...process.env, YTMD_TOKEN: '', DRY_RUN: 'false', TIKFINITY_PORT: '0', TIKFINITY_SECRET: '', TWITCH_CHANNEL: '', YOUTUBE_CHANNEL_ID: '' };
async function run(file, args = [], env = cleanEnv, cwd = root) {
  const child = spawn(process.execPath, [file, ...args], { cwd, env });
  let output = ''; child.stdout.on('data', c => output += c); child.stderr.on('data', c => output += c);
  const timer = setTimeout(() => child.kill(), 10000);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); }).finally(() => clearTimeout(timer));
  return { code, output };
}
test('real process dry-run requires neither token nor player and makes mode explicit', async () => {
  const r = await run('src/index.js', ['--dry-run']); assert.equal(r.code, 0); assert.match(r.output, /DRY RUN/); assert.match(r.output, /PearConnect Song Requests is running/);
});
test('real process missing token fails before running claim', async () => {
  const r = await run('src/index.js'); assert.equal(r.code, 1); assert.match(r.output, /YTMD_TOKEN/); assert.doesNotMatch(r.output, /is running/);
});
test('occupied port is a clear startup failure', async t => {
  const { server } = await serve(t, (_req, res) => res.end());
  const r = await run('src/index.js', ['--dry-run'], { ...cleanEnv, TIKFINITY_PORT: String(server.address().port) });
  assert.equal(r.code, 1); assert.match(r.output, /already in use/); assert.doesNotMatch(r.output, /is running/);
});
test('setup generates a private secret and never overwrites an existing configuration', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'pearconnect-setup-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { mkdir } = await import('node:fs/promises'); await mkdir(join(dir, 'scripts'));
  await copyFile(join(root, 'scripts/setup.mjs'), join(dir, 'scripts/setup.mjs')); await copyFile(join(root, '.env.txt'), join(dir, '.env.txt'));
  assert.equal((await run('scripts/setup.mjs', [], cleanEnv, dir)).code, 0);
  const before = await readFile(join(dir, '.env'), 'utf8'); assert.match(before, /TIKFINITY_SECRET=[a-f0-9]{64}/);
  const again = await run('scripts/setup.mjs', [], cleanEnv, dir); assert.match(again.output, /preserved/); assert.equal(await readFile(join(dir, '.env'), 'utf8'), before);
});
