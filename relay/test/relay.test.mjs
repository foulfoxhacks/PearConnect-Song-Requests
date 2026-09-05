import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PearConnectEngine } from '../../src/engine.js';
import { SessionClient } from '../../src/session-client.js';
import { loadConfig } from '../../src/config.js';
import { fixture, log } from '../../test/helpers.js';

// Fault controls exist only in this local test Worker. They are never part of a deploy bundle.
const mf = new Miniflare(convertV4MiniflareOptions({ modules: [{ type: 'ESModule', path: resolve('dist/test-entry.js'),
  contents: `import app, {StreamSession} from './index.js';
    export class TestSession extends StreamSession {
      fixture(kind) {
        const sql=this.ctx.storage.sql; const row=sql.exec('SELECT data FROM session WHERE id=1').toArray()[0]; const s=JSON.parse(row.data);
        if(kind==='expire') s.expiresAt=Date.now()-1;
        if(kind==='offline') s.lastSeen=Date.now()-30000;
        if(kind==='pair-expire') s.pairExpires=Date.now()-1;
        if(kind==='request-expire') sql.exec('UPDATE requests SET deadline=?',Date.now()-1);
        if(kind==='retention') sql.exec('UPDATE requests SET created=?',Date.now()-16*60000);
        sql.exec('UPDATE session SET data=? WHERE id=1',JSON.stringify(s)); return true;
      }
    }
    export default {async fetch(req,env,ctx){const url=new URL(req.url);if(url.pathname==='/__fixture'){const b=await req.json();await env.SESSIONS.getByName(b.code).fixture(b.kind);return Response.json({ok:true});}return app.fetch(req,env,ctx);}};` }, { type: 'ESModule', path: resolve('dist/index.js') }],
  compatibilityDate: '2026-09-05', compatibilityFlags: ['nodejs_compat'],
  bindings: { SITE_ORIGIN: 'https://pearconnect.mellozone.site' },
  durableObjects: { SESSIONS: { className: 'TestSession', useSQLite: true } },
  ratelimits: { CREATE_LIMIT: { namespace_id: '41001', simple: { limit: 5, period: 60 } }, API_LIMIT: { namespace_id: '41002', simple: { limit: 120, period: 60 } } }
}));
test.after(() => mf.dispose());
const origin = 'https://pearconnect.mellozone.site';
let ipCounter = 0;
async function raw(path, body = {}, headers = {}) {
  const response = await mf.dispatchFetch(`${origin}${path.startsWith('/__') ? path : `/api/session/${path}`}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function create() {
  const ip = `192.0.2.${++ipCounter}`;
  const res = await raw('create', { minutes: 15 }, { 'CF-Connecting-IP': ip }); assert.equal(res.status, 200);
  const { code, ownerToken } = res.data;
  const native = { 'CF-Connecting-IP': ip, Authorization: `Bearer ${ownerToken}` };
  const send = (operation, body = {}) => raw(`${code}/${operation}`, body, native);
  await send('poll', { ready: true, intake: true }); await send('update', { enabled: true });
  return { code, ownerToken, send, native, ip };
}
test('viewer requests are bounded, isolated and claimed once; result confirms the actual engine outcome', async () => {
  const s = await create();
  const id = randomUUID(), body = { id, name: 'Viewer 🦊', query: 'Björk “Jóga”' };
  assert.equal((await raw(`${s.code}/submit`, body)).data.state, 'received');
  assert.equal((await raw(`${s.code}/submit`, body)).data.state, 'received');
  assert.equal((await raw(`${s.code}/submit`, { ...body, query: 'changed' })).status, 409);
  const [a, b] = await Promise.all([s.send('poll', { ready: true, intake: true }), s.send('poll', { ready: true, intake: true })]);
  assert.equal([a, b].filter(r => r.data.request).length, 1);
  assert.equal((await s.send('permit', { id })).data.permitted, true);
  await s.send('complete', { id, result: { ok: true, code: 'added', message: 'Enqueue confirmed.' } });
  assert.equal((await raw(`${s.code}/result`, { id })).data.code, 'added');
  assert.equal((await raw(`${s.code}/result`, { id })).data.queueVerified, false, 'legacy Desktop acknowledgements are not upgraded into queue proof');
  assert.equal((await raw(`${s.code}/result`, { id }, { 'CF-Connecting-IP': '198.51.100.2' })).status, 404);
  assert.equal((await s.send('poll', { ready: true, intake: true })).data.request, null);
  assert.doesNotMatch(JSON.stringify((await raw(`${s.code}/public`)).data), new RegExp(s.ownerToken));
});
test('public codes cannot manage sessions; pairing is one-use, expiring, replaceable and revocable', async () => {
  const s = await create(); const browser = { Origin: origin };
  assert.equal((await raw(`${s.code}/update`, { enabled: false }, browser)).status, 401);
  assert.equal((await raw(`${s.code}/poll`, {}, browser)).status, 401);
  const pair = (await s.send('pair-link')).data.pairingToken;
  const paired = await raw(`${s.code}/pair`, { token: pair }, browser);
  assert.equal(paired.status, 200); assert.doesNotMatch(JSON.stringify(paired.data), /dashboardToken|ownerToken/);
  assert.match(paired.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await raw(`${s.code}/pair`, { token: pair }, browser)).status, 403);
  const Cookie = paired.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await raw('dashboard/status', {}, { Cookie })).status, 403);
  assert.equal((await raw('dashboard/status', {}, { Cookie, Origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await raw('dashboard/status', {}, { Cookie, ...browser })).status, 200);
  await raw('dashboard/update', { minutes: 60 }, { Cookie, ...browser });
  assert.ok((await s.send('status')).data.expiresAt > Date.now() + 59 * 60000);
  await s.send('update', { unpair: true });
  assert.equal((await raw('dashboard/status', {}, { Cookie, ...browser })).status, 401);
  const expired = (await s.send('pair-link')).data.pairingToken; await raw('/__fixture', { code: s.code, kind: 'pair-expire' });
  assert.equal((await raw(`${s.code}/pair`, { token: expired }, browser)).status, 403);
});
test('expiry, pause and offline checks stop new and in-flight work; uncertain claims never replay', async () => {
  const s = await create(); const id = randomUUID();
  await raw(`${s.code}/submit`, { id, name: 'Alice', query: 'A song' });
  await s.send('poll', { ready: true, intake: true });
  await s.send('update', { enabled: false });
  assert.equal((await s.send('permit', { id })).data.permitted, false);
  assert.equal((await raw(`${s.code}/submit`, { id: randomUUID(), name: 'Alice', query: 'song' })).data.code, 'requests_paused');
  await raw('/__fixture', { code: s.code, kind: 'request-expire' });
  assert.equal((await raw(`${s.code}/result`, { id })).data.state, 'uncertain');
  await s.send('update', { enabled: true });
  assert.equal((await s.send('poll', { ready: true, intake: true })).data.request, null);
  await raw('/__fixture', { code: s.code, kind: 'offline' });
  assert.equal((await raw(`${s.code}/submit`, { id: randomUUID(), name: 'Alice', query: 'song' })).data.code, 'desktop_offline');
  await raw('/__fixture', { code: s.code, kind: 'expire' });
  assert.equal((await s.send('update', { minutes: 15 })).status, 410);
  assert.equal((await raw(`${s.code}/public`)).status, 404);
});
test('attempt limits, malformed payloads, retained receipts and origin protections fail clearly', async () => {
  const s = await create();
  assert.equal((await raw('create', { minutes: 0 })).status, 400);
  assert.equal((await raw('create', { minutes: 15 }, { Origin: origin })).status, 403);
  assert.equal((await raw(`${s.code}/public`, {}, { Origin: 'null' })).status, 403);
  assert.equal((await raw(`${s.code}/submit`, { id: randomUUID(), name: ['bad'], query: 'song' })).status, 400);
  assert.equal((await raw(`${s.code}/submit`, { id: randomUUID(), name: 'A', query: 'x'.repeat(9000) })).status, 400);
  for (let i = 0; i < 6; i++) assert.equal((await raw(`${s.code}/submit`, { id: randomUUID(), name: `name${i}`, query: 'song' })).status, 200);
  assert.equal((await raw(`${s.code}/submit`, { id: randomUUID(), name: 'new-name', query: 'song' })).status, 429);
  await raw('/__fixture', { code: s.code, kind: 'retention' });
  assert.equal((await s.send('status')).data.recent.length, 0);
});
test('native relay client and shared engine enforce cooldowns, permission changes and no replay end to end', async t => {
  const f = fixture(); const e = new PearConnectEngine(loadConfig({ YTMD_TOKEN: 'private-player-token', CONNECTION_MODE: 'advanced', TIKFINITY_PORT: '0' }), { player: f.ytmd, logger: log, lock: async () => async () => {}, connectPlatforms: false });
  await e.start();
  const client = new SessionClient(e, { fetcher: (url, options) => mf.dispatchFetch(url, { ...options, headers: { ...options.headers, 'CF-Connecting-IP': '203.0.113.50' } }), intervalMs: 25 });
  t.after(async () => { await client.close(); await e.stop(); });
  const s = await client.create(15); assert.equal(e.webFallback, true); assert.equal(e.requestsEnabled, false);
  await client.update({ enabled: true });
  async function waitFor(check) { for (let i=0;i<100;i++) { const result=await check(); if(result) return result; await new Promise(r=>setTimeout(r,25)); } throw new Error('Timed out waiting for relay'); }
  await waitFor(async () => (await raw(`${s.code}/public`)).data.accepting);
  async function song(name) { const id=randomUUID(); await raw(`${s.code}/submit`,{id,name,query:'Björk “Jóga”'}); return waitFor(async()=>{const r=(await raw(`${s.code}/result`,{id})).data; return r.state==='done' ? r : null;}); }
  const accepted = await song('alice'); assert.equal(accepted.code, 'added'); assert.equal(accepted.queueVerified, true);
  assert.equal((await song('different-name')).code, 'cooldown');
  assert.equal(f.calls.filter(c=>c[0]==='addToQueue').length,1);
  assert.doesNotMatch(JSON.stringify(client.snapshot()), /ownerToken.*[a-f0-9]{64}|private-player-token/);
  e.updateRules({ REQUEST_ALLOWLIST: 'tiktok:alice' });
  await waitFor(async()=>!(await raw(`${s.code}/public`)).data.accepting);
  await client.close(); assert.equal(e.webFallback,false); assert.equal(e.requestsEnabled,false);
});
