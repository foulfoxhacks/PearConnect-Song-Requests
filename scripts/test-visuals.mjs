import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { PlaybackStudio, newOverlayToken } from '../desktop/studio.js';
const { chromium, expect } = createRequire(new URL('../website/package.json', import.meta.url))('@playwright/test');
const root = resolve(import.meta.dirname, '..'), output = resolve(root, 'dist/visual-browser');
await mkdir(output, { recursive: true });
const siteRoot = resolve(root, 'website/dist');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(siteRoot, `.${pathname}`);
    if (!file.startsWith(siteRoot + sep) && file !== siteRoot) { res.writeHead(404); res.end(); return; }
    if (pathname.endsWith('/')) file = resolve(file, 'index.html'); else if (!extname(file)) file += '.html';
    const body = await readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const site = `http://127.0.0.1:${server.address().port}`;
const art = await readFile(resolve(root, 'desktop/assets/sample-cover.png'));
const c = { env: { OVERLAY_ENABLED: 'true', OVERLAY_PORT: '0', OVERLAY_TOKEN: newOverlayToken() }, engine: { generation: 0, lifecycle: 'running', playerState: 'ready', config: { token: 'fixture-only' },
  currentTrack: { title: 'Night Drive', artist: 'PearConnect Sessions', videoId: 'abcdefghijk', songDuration: 246, elapsedSeconds: 83, isPaused: false, imageSrc: 'https://i.ytimg.com/sample.png' }, async testPlayer() {}, player: { async getQueue() { return { items: ['Night Drive', 'Golden Hour', 'Afterglow', 'New Horizons', 'Open Road', 'Daylight'].map((title, i) => ({ playlistPanelVideoRenderer: { videoId: i ? String(i).repeat(11) : 'abcdefghijk', selected: i === 0, title: { simpleText: title }, shortBylineText: { simpleText: 'PearConnect Sessions' }, lengthText: { simpleText: '3:42' } } })) }; } } } };
const studio = new PlaybackStudio(c, { fetcher: async () => new Response(art, { headers: { 'content-type': 'image/png' } }) });
let browser;
try {
  await studio.start();
  browser = await chromium.launch({ headless: true, ...(process.env.PEARCONNECT_CHROME ? { executablePath: process.env.PEARCONNECT_CHROME } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const layout of ['cover', 'compact', 'minimal']) {
      await page.getByRole('button', { name: layout, exact: true }).click();
      await expect(page.locator('.demo-stage')).toHaveAttribute('data-layout', layout);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${layout} fits at ${width}`);
    }
    await page.getByRole('button', { name: 'cover', exact: true }).click(); await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, `home-${width}.png`), fullPage: true });
  }
  await page.goto(site + '/docs/visual-studio'); await expect(page.getByRole('heading', { level: 1 })).toContainText('Visual studio & overlays');
  await page.setViewportSize({ width: 760, height: 520 }); await page.goto(studio.overlayUrl());
  await expect(page.locator('.widget-title')).toHaveText('Night Drive');
  await expect(page.locator('.widget-image')).toBeVisible();
  await expect.poll(() => page.locator('.widget-image').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  assert.equal(await page.evaluate(() => document.querySelector('.music-widget').getBoundingClientRect().height <= innerHeight), true);
  for (const layout of ['cover', 'compact', 'minimal', 'vertical']) {
    const size = await page.evaluate(layout => window.PearWidget.dimensions({ WIDGET_LAYOUT: layout }), layout);
    await page.setViewportSize(size);
    c.env.WIDGET_LAYOUT = layout; await expect(page.locator('.music-widget')).toHaveAttribute('data-layout', layout);
    assert.equal(await page.locator('.music-widget').evaluate(el => el.getBoundingClientRect().height <= innerHeight && el.getBoundingClientRect().width <= innerWidth), true, `${layout} fits its suggested canvas`);
    await page.screenshot({ path: resolve(output, `obs-${layout}.png`), omitBackground: true });
  }
  await expect(page.locator('.widget-queue-title')).toHaveText(['Golden Hour', 'Afterglow', 'New Horizons']);
  assert.equal(studio.snapshot().overlayClients, 1);
  c.env.OVERLAY_PORT = new URL(studio.overlayUrl()).port;
  await studio.stopOverlay(); await studio.configure();
  await expect.poll(() => studio.snapshot().overlayClients, { timeout: 10000 }).toBe(1);
  await expect(page.locator('.widget-queue-title')).toHaveText(['Golden Hour', 'Afterglow', 'New Horizons']);
  c.engine.currentTrack.elapsedSeconds = 120; c.engine.currentTrack.isPaused = true; await studio.poll();
  await expect(page.locator('.widget-label')).toHaveText('PAUSED'); await expect(page.locator('.widget-elapsed')).toHaveText('2:00 / 4:06');
  c.engine.currentTrack.title = '<script>unsafe()</script> “Jóga”'; await studio.poll();
  await expect(page.locator('.widget-title')).toHaveText('<script>unsafe()</script> “Jóga”'); assert.equal(await page.locator('.widget-title script').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.widget-motion i').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  c.engine.playerState = 'disconnected'; await expect(page.locator('.widget-label')).toHaveText('WAITING FOR MUSIC');
  c.env.SOCIAL_ENABLED = 'true'; c.env.SOCIAL_TIKTOK = '@yourchannel'; c.env.SOCIAL_TWITCH = '@yourchannel'; c.env.SOCIAL_DISCORD = 'discord.gg/your-community'; c.env.SOCIAL_SECONDS = '3';
  await page.setViewportSize({ width: 600, height: 120 }); await page.goto(studio.socialUrl());
  await expect(page.locator('.social-handle')).toHaveText('@yourchannel');
  await expect.poll(() => page.locator('.social-icon').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.social-label')).toContainText('Twitch', { timeout: 5000 });
  for (const pack of ['brand', 'mono', 'outline']) {
    c.env.SOCIAL_ICONS = pack; await expect(page.locator('.social-ticker')).toHaveAttribute('data-icons', pack);
    await page.screenshot({ path: resolve(output, `social-${pack}.png`), omitBackground: true });
  }
  c.env.SOCIAL_TIKTOK = '<script>unsafe()</script> @Jóga'; c.env.SOCIAL_TWITCH = ''; c.env.SOCIAL_DISCORD = '';
  await page.setViewportSize({ width: 400, height: 120 });
  await expect(page.locator('.social-handle')).toHaveText('<script>unsafe()</script> @Jóga');
  assert.equal(await page.locator('.social-handle script').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  c.env.SOCIAL_ENABLED = 'false'; await expect(page.locator('.social-ticker')).toBeHidden();
  assert.deepEqual(errors, []);
  console.log('PASS: 320–1440px website; WebSocket overlay and reconnect; four fitting widget layouts, queue, artwork, timing, safe text and reduced motion; separate social ticker, rotation, three icon packs, portrait fit and disable.');
  console.log(`Screenshots: ${output}`);
} finally { await browser?.close(); await studio.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
