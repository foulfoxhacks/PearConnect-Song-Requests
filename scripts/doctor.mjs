import 'dotenv/config';
import { loadConfig } from '../src/config.js';
try {
  const config = loadConfig({ ...process.env, ...(process.argv.includes('--dry-run') ? { DRY_RUN: 'true' } : {}) });
  console.log('PASS: configuration valid; credentials not printed.');
  if (process.argv.includes('--config-only')) process.exit(0);
  if (!config.port) throw new Error('Webhook is disabled (TIKFINITY_PORT=0); there is no local bridge to check.');
  const headers = { 'Content-Type': 'application/json', ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {}) };
  for (const path of ['/healthz', '/readyz', '/tikfinity/test']) {
    const res = await fetch(`http://127.0.0.1:${config.port}${path}`, {
      method: path.endsWith('/test') ? 'POST' : 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs + 2000),
      ...(path.endsWith('/test') ? { body: JSON.stringify({ user: 'pearconnect-diagnostic', query: 'validation only' }) } : {}),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(`${path}: HTTP ${res.status} (${body.code || 'failed'}).`);
    console.log(`PASS: ${path}${body.mode ? ` [${body.mode}]` : ''}`);
    if (path === '/readyz' && body.mode === 'dry-run') console.log('NOTE: dry-run does not verify Pear Desktop connectivity.');
  }
  console.log('No queue mutations sent. Live TikTok delivery and audible playback require a separate live check.');
} catch (error) { console.error('FAIL:', error.message); process.exitCode = 1; }
