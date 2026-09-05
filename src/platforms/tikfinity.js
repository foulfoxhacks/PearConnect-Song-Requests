// TikFinity -> Streamer.bot -> this local JSON POST API -> Pear Desktop.
import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { InputError, validatePayload } from '../validation.js';

const digest = (value) => createHash('sha256').update(value).digest();
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

export function createTikfinityApp({ secret = '', queue, skipAllowlist = [], log = console, dryRun = false, now = Date.now }) {
  const app = express();
  const expectedSecret = digest(secret);
  const cache = new Map();
  let active = 0;
  app.disable('x-powered-by');
  app.set('query parser', false);
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    // Native local clients do not need browser CORS. Reject browser origins and DNS rebinding.
    if (req.get('Origin') || !['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname)) {
      return res.status(403).json({ ok: false, code: 'forbidden', message: 'Use a native localhost client.' });
    }
    if (secret && !timingSafeEqual(expectedSecret, digest(req.get('X-Webhook-Secret') || ''))) {
      return res.status(403).json({ ok: false, code: 'forbidden', message: 'Webhook authentication failed.' });
    }
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ ok: true, mode: dryRun ? 'dry-run' : 'live' }));
  app.get('/readyz', asyncRoute(async (_req, res) => {
    if (dryRun) return res.json({ ok: true, mode: 'dry-run', pearDesktop: 'not_checked' });
    try {
      await queue.ytmd.getCurrentSong();
      res.json({ ok: true, mode: 'live', pearDesktop: 'reachable' });
    } catch {
      res.status(503).json({ ok: false, code: 'not_ready', message: 'Pear Desktop is unavailable or unauthorized.' });
    }
  }));

  const paths = new Map([
    ['/tikfinity', 'request'], ['/tikfinity/np', 'np'], ['/tikfinity/queue', 'queue'],
    ['/tikfinity/skip', 'skip'], ['/tikfinity/test', 'test'],
  ]);
  for (const [path, command] of paths) {
    app.all(path, (req, res, next) => {
      if (req.method !== 'POST') return res.set('Allow', 'POST').status(405).json({ ok: false, code: 'method_not_allowed', message: 'Use POST with application/json.' });
      if (!req.is('application/json')) return res.status(415).json({ ok: false, code: 'content_type', message: 'Content-Type must be application/json.' });
      next();
    }, express.json({ limit: '64kb', strict: true, inflate: false }), asyncRoute(async (req, res) => {
      const payload = validatePayload(req.body);
      if (command === 'test') {
        return res.json({ ok: true, code: 'validated', dryRun: true, message: 'Payload validated. No player or quota state was changed.', payload });
      }
      const key = req.get('Idempotency-Key');
      if (key && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new InputError('Idempotency-Key must contain 8-100 letters, digits, hyphens or underscores.');
      const fingerprint = digest(JSON.stringify([path, payload])).toString('hex');
      for (const [id, entry] of cache) if (entry.expires <= now() && entry.done) cache.delete(id);
      let entry = key && cache.get(key);
      if (entry && entry.fingerprint !== fingerprint) {
        return res.status(409).json({ ok: false, code: 'idempotency_conflict', message: 'This key was already used for a different request.' });
      }
      if (!entry) {
        if (active >= 32 || (key && cache.size >= 1000)) {
          return res.status(503).json({ ok: false, code: 'busy', message: 'Bridge is busy. Try later.' });
        }
        entry = { fingerprint, expires: now() + 300000, done: false };
        active++;
        entry.promise = (async () => {
          try {
            const data = { ...payload, platform: 'tiktok' };
            switch (command) {
              case 'request': return await queue.handleRequest(data);
              case 'np': return await queue.handleNowPlaying(data);
              case 'queue': return await queue.handleQueuePeek(data);
              case 'skip': return await queue.handleSkip({ ...data, allowlist: skipAllowlist });
            }
          } catch {
            log.error('[webhook] Unexpected handler failure.');
            return { ok: false, code: 'internal_error', message: 'The bridge could not process this request.' };
          } finally { active--; entry.done = true; }
        })();
        if (key) cache.set(key, entry);
      }
      const result = await entry.promise;
      const status = { invalid_input: 400, upstream_error: 502, upstream_timeout: 504, internal_error: 500 }[result.code] || 200;
      res.status(status).json(result);
    }));
  }
  app.use((_req, res) => res.status(404).json({ ok: false, code: 'not_found', message: 'Unknown endpoint.' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof InputError) return res.status(400).json({ ok: false, code: 'invalid_input', message: error.message });
    const status = error.type === 'entity.too.large' ? 413 : error.status === 415 ? 415 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ ok: false, code: status === 500 ? 'internal_error' : 'invalid_json', message: status === 500 ? 'Internal bridge error.' : 'Supply a valid, uncompressed JSON object smaller than 64 KiB.' });
  });
  return app;
}

export async function startTikfinity(options) {
  if (options.port === 0) {
    options.log.info('[tikfinity] disabled (TIKFINITY_PORT=0)');
    return null;
  }
  const app = createTikfinityApp(options);
  return new Promise((resolve, reject) => {
    const server = app.listen(options.port, '127.0.0.1', () => {
      server.off('error', reject);
      server.on('error', () => options.log.error('[tikfinity] HTTP server error.'));
      options.log.info(`[tikfinity] webhook listening on http://127.0.0.1:${server.address().port}`);
      resolve(server);
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    server.on('error', reject);
  });
}
