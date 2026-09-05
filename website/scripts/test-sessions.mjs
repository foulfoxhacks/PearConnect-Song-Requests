import { chromium, expect } from '@playwright/test';
import { Miniflare, convertV4MiniflareOptions } from '../../relay/node_modules/miniflare/dist/src/index.js';
import { PearConnectEngine } from '../../src/engine.js';
import { SessionClient } from '../../src/session-client.js';
import { loadConfig } from '../../src/config.js';
import { fixture, log } from '../../test/helpers.js';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:5174', root = resolve('dist'), output = resolve('../dist/session-browser');
await mkdir(output, { recursive: true });
const mf = new Miniflare(convertV4MiniflareOptions({ modulesRoot: resolve('../relay/dist'), modules: [{ type: 'ESModule', path: resolve('../relay/dist/index.js') }], compatibilityDate: '2026-09-05', compatibilityFlags: ['nodejs_compat'],
  bindings: { SITE_ORIGIN: origin }, durableObjects: { SESSIONS: { className: 'StreamSession', useSQLite: true } },
  ratelimits: { CREATE_LIMIT: { namespace_id: '41001', simple: { limit: 5, period: 60 } }, API_LIMIT: { namespace_id: '41002', simple: { limit: 120, period: 60 } } } }));
const csp = (await readFile(resolve(root, '_headers'), 'utf8')).match(/Content-Security-Policy: (.+)/)[1];
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname.startsWith('/api/session/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await mf.dispatchFetch(url, { method: req.method, headers: { ...req.headers, 'CF-Connecting-IP': '192.0.2.20' }, body: Buffer.concat(chunks) });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    let path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(404); res.end(); return; }
    if (url.pathname.endsWith('/')) path = resolve(path, 'index.html'); else if (!extname(path)) path += '.html';
    const bytes = await readFile(path);
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' }[extname(path)] || 'text/plain');
    res.setHeader('Content-Security-Policy', csp); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(5174, '127.0.0.1'); await once(server, 'listening');
const f = fixture();
const engine = new PearConnectEngine(loadConfig({ YTMD_TOKEN: 'local-test-player', TIKFINITY_PORT: '0', CONNECTION_MODE: 'advanced' }), { player: f.ytmd, logger: log, lock: async () => async () => {}, connectPlatforms: false });
const client = new SessionClient(engine, { origin, intervalMs: 500 });
let browser;
try {
  await engine.start(); const session = await client.create(15); await client.update({ enabled: true });
  browser = await chromium.launch({ headless: true, ...(process.env.PEARCONNECT_CHROME ? { executablePath: process.env.PEARCONNECT_CHROME } : {}) });
  const owner = await browser.newContext(); const dashboard = await owner.newPage();
  const errors = []; dashboard.on('pageerror', e => errors.push(e.message));
  await dashboard.goto(await client.pairingUrl());
  await expect(dashboard.locator('.session-large-code')).toHaveText(session.code);
  assert.equal(new URL(dashboard.url()).hash, ''); assert.equal(await dashboard.evaluate(() => document.cookie.includes('pc_dashboard')), false);
  await dashboard.getByLabel('Set expiration from now').fill('60'); await dashboard.getByRole('button', { name: 'Update expiration', exact: true }).click();
  await expect(dashboard.getByRole('status').filter({ hasText: 'Expiration updated' })).toBeVisible();
  const viewers = await browser.newContext(); const page = await viewers.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/web/dashboard`); await expect(page.getByRole('heading', { name: 'Start from Desktop.' })).toBeVisible();
  await page.goto(`${origin}/sessioncode`); await page.getByLabel('Session code', { exact: true }).fill('BAD'); await page.getByRole('button', { name: 'Check code', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('8-character');
  await page.getByLabel('Session code', { exact: true }).fill(session.code); await page.getByRole('button', { name: 'Check code', exact: true }).click();
  await expect(page.getByText('Website requests are open', { exact: true })).toBeVisible();
  await page.getByLabel('Display name').fill('<img src=x onerror=alert(1)>'); await page.getByLabel('Artist and song', { exact: true }).fill('Björk “Jóga” 🦊');
  await page.getByRole('button', { name: 'Send song request' }).click();
  await expect(page.getByRole('heading', { name: 'Enqueue confirmed.' })).toBeVisible({ timeout: 15000 });
  assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 1);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Enqueue confirmed.' })).toBeVisible();
  assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 1);
  await page.getByRole('button', { name: 'Request another song', exact: true }).click();
  await page.getByLabel('Display name').fill('Changed name'); await page.getByLabel('Artist and song', { exact: true }).fill('Another song');
  await page.getByRole('button', { name: 'Send song request' }).click();
  await expect(page.locator('.session-receipt')).toContainText('slow down', { timeout: 15000 });
  assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 1);
  await dashboard.getByRole('button', { name: 'Pause website requests', exact: true }).click();
  await expect.poll(() => engine.requestsEnabled).toBe(false);
  await page.getByRole('button', { name: 'Request another song', exact: true }).click(); await expect(page.getByText('Requests are paused', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send song request' })).toBeDisabled();
  for (const width of [320, 390, 768, 1440]) {
    for (const [tab, name] of [[page, 'request'], [dashboard, 'dashboard']]) {
      await tab.setViewportSize({ width, height: 940 });
      await tab.evaluate(() => scrollTo(0, 0));
      await tab.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflow at ${width}`);
      if ([390,1440].includes(width)) await tab.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: true });
    }
  }
  await dashboard.getByRole('button', { name: 'End this session', exact: true }).click();
  await expect(dashboard.getByRole('status')).toContainText('Session ended');
  await expect.poll(() => engine.webFallback, { timeout: 10000 }).toBe(false);
  await page.getByRole('button', { name: 'Check code', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('ended or expired');
  assert.deepEqual(errors, []);
  console.log('PASS: real browser pairing, HttpOnly credential, expiry update, invalid code, Unicode request, enqueue confirmation, refresh without replay, rename cooldown, pause/end controls, 320–1440px layouts and no page errors.');
  console.log(`Screenshots: ${output}`);
} finally {
  await browser?.close(); await client.close(); await engine.stop(); server.closeAllConnections(); await new Promise(r => server.close(r)); await mf.dispose();
}
