import { DurableObject } from 'cloudflare:workers';

const CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9-]{36}$/;
const MINUTE = 60000;
const RESULT_TTL = 15 * MINUTE;
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
function equal(a: string, b: string) { return a.length === b.length && crypto.subtle.timingSafeEqual(new TextEncoder().encode(a), new TextEncoder().encode(b)); }
function fail(code: string, message: string, status = 400) { return { ok: false as const, code, message, status }; }
function minutes(value: unknown): number | null { return typeof value === 'number' && Number.isInteger(value) && value >= 15 && value <= 1440 ? value : null; }
function clean(value: unknown, max: number): string | null { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f]/u.test(value) ? value.trim() : null; }
type JsonValue = string | number | boolean | null | Json | JsonValue[];
type Json = { [key: string]: JsonValue };
type State = { code: string; ownerHash: string; ipSalt: string; expiresAt: number; enabled: boolean; ended: boolean; revision: number; lastSeen: number; ready: boolean; intake: boolean; pairHash?: string; pairExpires?: number; dashboardHash?: string; lastTestAt?: number };
type RequestRow = { id: string; identity: string; fingerprint: string; name: string; query: string; state: string; created: number; deadline: number; result: string | null; test: number };

export class StreamSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, identity TEXT NOT NULL, fingerprint TEXT NOT NULL, name TEXT NOT NULL, query TEXT NOT NULL, state TEXT NOT NULL, created INTEGER NOT NULL, deadline INTEGER NOT NULL, result TEXT, test INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (identity TEXT PRIMARY KEY, at INTEGER NOT NULL, count INTEGER NOT NULL);`);
  }
  private read(): State | null { const row = this.ctx.storage.sql.exec<{ data: string }>('SELECT data FROM session WHERE id=1').toArray()[0]; return row ? JSON.parse(row.data) : null; }
  private write(s: State) { this.ctx.storage.sql.exec('INSERT OR REPLACE INTO session VALUES(1, ?)', JSON.stringify(s)); }
  private valid(s: State | null): s is State { return !!s && !s.ended && s.expiresAt > Date.now(); }
  private auth(s: State | null, digest: string, dashboard = false): s is State {
    return !!s && !!digest && equal(digest, dashboard ? s.dashboardHash || '' : s.ownerHash);
  }
  private view(s: State) {
    const online = s.lastSeen > Date.now() - 20000;
    return { ok: true, code: s.code, expiresAt: s.expiresAt, enabled: s.enabled, ended: s.ended || s.expiresAt <= Date.now(),
      online, ready: s.ready, accepting: this.valid(s) && online && s.ready && s.intake && s.enabled,
      revision: s.revision, lastTestAt: s.lastTestAt || null };
  }
  private prune() {
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM requests WHERE created < ?', now - RESULT_TTL);
    this.ctx.storage.sql.exec('DELETE FROM limits WHERE at < ?', now - MINUTE);
  }
  async create(code: string, ownerHash: string, duration: number) {
    if (this.read()) return fail('collision', 'Try a new session code.', 409);
    const state: State = { code, ownerHash, ipSalt: token(), expiresAt: Date.now() + duration * MINUTE, enabled: false, ended: false, revision: 0, lastSeen: 0, ready: false, intake: false };
    this.write(state);
    await this.ctx.storage.setAlarm(state.expiresAt + RESULT_TTL);
    return this.view(state);
  }
  async alarm() {
    const s = this.read();
    this.prune();
    if (s && Date.now() < s.expiresAt + RESULT_TTL) { await this.scheduleCleanup(); return; }
    await this.ctx.storage.deleteAll();
  }
  private async scheduleCleanup() {
    const s = this.read(); if (!s) return;
    const first = this.ctx.storage.sql.exec<{ at: number | null }>('SELECT min(created) AS at FROM requests').one().at;
    await this.ctx.storage.setAlarm(Math.min(s.expiresAt + RESULT_TTL, first === null ? Infinity : first + RESULT_TTL + 1));
  }
  async access(operation: string, digest: string, dashboard: boolean, bodyJson: string, ip: string): Promise<string> {
    return JSON.stringify(await this.dispatch(operation, digest, dashboard, JSON.parse(bodyJson), ip));
  }
  private async dispatch(operation: string, digest: string, dashboard: boolean, body: Json, ip: string): Promise<Json> {
    this.prune();
    let s = this.read();
    if (operation === 'public') return this.valid(s) ? this.view(s) : fail('session_expired', 'This code has ended or expired. Ask the streamer for a new code.', 404);
    if (operation === 'pair') {
      const pairHash = typeof body.token === 'string' && TOKEN.test(body.token) ? await hash(body.token) : '';
      s = this.read(); // Never consume a stale pairing token across an await.
      if (!this.valid(s) || !s.pairHash || !pairHash || !equal(s.pairHash, pairHash) || (s.pairExpires || 0) <= Date.now()) return fail('pair_expired', 'This pairing link was used or expired. Open a new one from Desktop.', 403);
      const key = token(); const keyHash = await hash(key);
      s = this.read();
      if (!this.valid(s) || !s.pairHash || !equal(s.pairHash, pairHash)) return fail('pair_expired', 'Open a new pairing link from Desktop.', 403);
      s.dashboardHash = keyHash; delete s.pairHash; delete s.pairExpires; this.write(s);
      return { ...this.view(s), dashboardToken: key };
    }
    if (operation === 'submit' || operation === 'result') {
      if (!this.valid(s)) return fail('session_expired', 'This code has ended or expired. Ask the streamer for a new code.', 404);
      const identity = await hash(`${s.ipSalt}:${ip}`);
      s = this.read();
      if (!this.valid(s)) return fail('session_expired', 'This session has expired.', 404);
      const id = typeof body.id === 'string' && ID.test(body.id) ? body.id : null;
      if (!id) return fail('invalid_input', 'A valid request ID is required.');
      const row = this.ctx.storage.sql.exec<RequestRow>('SELECT * FROM requests WHERE id=?', id).toArray()[0];
      if (operation === 'result') {
        if (!row || row.identity !== identity) return fail('not_found', 'Request receipt unavailable. Check with the streamer before retrying.', 404);
        return this.receipt(row);
      }
      const name = clean(body.name, 60), query = clean(body.query, 512);
      if (!name || !query || /^pearcheck-/i.test(query)) return fail('invalid_input', 'Enter your display name and an artist and song (up to 512 characters).');
      const fingerprint = JSON.stringify([name, query]);
      if (row) return row.identity === identity && row.fingerprint === fingerprint ? this.receipt(row) : fail('idempotency_conflict', 'This request ID was already used. Check your previous result.', 409);
      const view = this.view(s);
      if (!view.online || !s.ready) return fail('desktop_offline', 'The streamer’s desktop is unavailable or its player is not ready. Nothing was queued.', 409);
      if (!view.accepting) return fail('requests_paused', 'The streamer has paused website requests. Nothing was queued.', 409);
      const rate = this.ctx.storage.sql.exec<{ count: number }>('SELECT count FROM limits WHERE identity=?', identity).toArray()[0];
      if ((rate?.count || 0) >= 6) return fail('rate_limited', 'Too many attempts from this connection. Wait one minute.', 429);
      const count = this.ctx.storage.sql.exec<{ n: number }>('SELECT count(*) AS n FROM requests').one().n;
      const pending = this.ctx.storage.sql.exec<{ n: number }>("SELECT count(*) AS n FROM requests WHERE state IN ('received','checking') AND deadline > ?", Date.now()).one().n;
      if (count >= 500 || pending >= 20) return fail('busy', 'This stream is processing several requests. Try again shortly.', 429);
      this.ctx.storage.sql.exec('INSERT INTO limits VALUES(?,?,1) ON CONFLICT(identity) DO UPDATE SET count=count+1', identity, Date.now());
      this.ctx.storage.sql.exec("INSERT INTO requests VALUES(?,?,?,?,?,'received',?,?,NULL,0)", id, identity, fingerprint, name, query, Date.now(), Math.min(s.expiresAt, Date.now() + 90000));
      await this.scheduleCleanup();
      return { ok: true, id, state: 'received', message: 'Request received. Waiting for the streamer’s desktop to check it.' };
    }
    if (!this.auth(s, digest, dashboard)) return fail('unauthorized', 'Pair this browser from PearConnect Desktop to manage the session.', 401);
    if (operation === 'status') return { ...this.view(s), recent: this.ctx.storage.sql.exec<RequestRow>('SELECT * FROM requests ORDER BY created DESC LIMIT 20').toArray().map(row => ({ id: row.id, name: row.name, query: row.query, created: row.created, ...this.receipt(row) })) };
    if (!this.valid(s)) return fail('session_expired', 'This session has ended. Create a new one in Desktop.', 410);
    if (operation === 'update') {
      if (Object.keys(body).some(k => !['minutes', 'enabled', 'end', 'unpair'].includes(k))) return fail('invalid_input', 'Unsupported session setting.');
      if (body.minutes !== undefined && !minutes(body.minutes)) return fail('invalid_input', 'Choose an expiration from 15 to 1440 minutes.');
      if (['enabled', 'end', 'unpair'].some(k => body[k] !== undefined && typeof body[k] !== 'boolean')) return fail('invalid_input', 'Use true or false for session controls.');
      if (body.enabled === true && (s.lastSeen <= Date.now() - 20000 || !s.ready)) return fail('desktop_offline', 'Connect the player in Desktop before enabling website requests.', 409);
      if (body.minutes !== undefined) s.expiresAt = Date.now() + Number(body.minutes) * MINUTE;
      if (typeof body.enabled === 'boolean') { s.enabled = body.enabled; s.revision++; }
      if (body.end === true) { s.ended = true; s.enabled = false; s.expiresAt = Date.now(); }
      if (body.unpair === true || s.ended) { delete s.dashboardHash; delete s.pairHash; }
      this.write(s);
      await this.scheduleCleanup();
      return this.view(this.read()!);
    }
    if (dashboard) return fail('forbidden', 'This operation requires the desktop connection.', 403);
    if (operation === 'pair-link') {
      const key = token(); const pairHash = await hash(key);
      s = this.read(); if (!this.valid(s)) return fail('session_expired', 'Session expired.', 410);
      s.pairHash = pairHash; s.pairExpires = Date.now() + 120000; this.write(s);
      return { ok: true, pairingToken: key };
    }
    if (operation === 'poll') {
      s.lastSeen = Date.now(); s.ready = body.ready === true; s.intake = body.intake === true; this.write(s);
      const next = s.ready && s.enabled && s.intake ? this.ctx.storage.sql.exec<RequestRow>("SELECT * FROM requests WHERE state='received' AND deadline>? ORDER BY created LIMIT 1", Date.now()).toArray()[0] : undefined;
      // A claim is persisted before delivery. Lost responses never cause automatic redelivery.
      if (next) this.ctx.storage.sql.exec("UPDATE requests SET state='checking' WHERE id=?", next.id);
      return { ...this.view(s), request: next ? { id: next.id, name: next.name, userId: next.identity, query: next.query, deadline: next.deadline } : null };
    }
    if (operation === 'permit' || operation === 'complete') {
      const row = this.ctx.storage.sql.exec<RequestRow>('SELECT * FROM requests WHERE id=?', String(body.id)).toArray()[0];
      if (!row || row.state !== 'checking') return fail('not_found', 'This request is not awaiting a result.', 409);
      if (operation === 'permit') return { ok: true, permitted: row.deadline > Date.now() && s.enabled && this.view(s).accepting };
      const result = body.result as Json | undefined;
      if (!result || typeof result.ok !== 'boolean' || !clean(result.code, 60) || !clean(result.message, 1200)) return fail('invalid_input', 'Invalid request result.');
      const safeResult = { ok: result.ok, code: result.code, message: result.message, outcomeUncertain: result.outcomeUncertain === true,
        queueVerified: result.code === 'added' && result.ok === true && result.queueVerified === true };
      this.ctx.storage.sql.exec("UPDATE requests SET state='done', result=? WHERE id=?", JSON.stringify(safeResult), row.id);
      return { ok: true };
    }
    return fail('not_found', 'Unknown session operation.', 404);
  }
  private receipt(row: RequestRow) {
    if (row.result) return { id: row.id, state: 'done', ...JSON.parse(row.result) };
    if (row.deadline <= Date.now()) return { id: row.id, state: row.state === 'checking' ? 'uncertain' : 'expired', ok: false,
      message: row.state === 'checking' ? 'Outcome uncertain. Ask the streamer to check the player before retrying.' : 'Request expired before Desktop collected it. Nothing was queued.' };
    return { ok: true, id: row.id, state: row.state, message: row.state === 'checking' ? 'Desktop is checking your request. This is not a queue confirmation yet.' : 'Waiting for Desktop to collect your request.' };
  }
}

async function bodyOf(request: Request): Promise<Json> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('json');
  const reader = request.body?.getReader(); if (!reader) throw new Error('json');
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw new Error('size'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('json');
  return body as Json;
}
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
function response(value: Json) { const { status, ...data } = value; return Response.json(data, { status: typeof status === 'number' ? status : 200, headers }); }
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    if (origin && origin !== env.SITE_ORIGIN && !(url.hostname === '127.0.0.1' && origin === 'http://127.0.0.1:5173')) return response(fail('forbidden', 'Use the PearConnect website.', 403));
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return response(fail('forbidden', 'Use the PearConnect website.', 403));
    if (request.method !== 'POST') return response(fail('method_not_allowed', 'Use JSON POST.', 405));
    const ip = request.headers.get('CF-Connecting-IP') || (url.hostname === '127.0.0.1' ? 'local-test' : 'unknown');
    if (!(await env.API_LIMIT.limit({ key: ip })).success) return response(fail('rate_limited', 'Too many requests. Wait one minute.', 429));
    let body: Json; try { body = await bodyOf(request); } catch { return response(fail('invalid_json', 'Supply a JSON object smaller than 8 KiB.')); }
    try {
      if (url.pathname === '/api/session/create') {
        if (origin || request.headers.has('Cookie')) return response(fail('forbidden', 'Create sessions from PearConnect Desktop.', 403));
        const duration = minutes(body.minutes); if (!duration) return response(fail('invalid_input', 'Choose 15 to 1440 minutes.'));
        if (!(await env.CREATE_LIMIT.limit({ key: ip })).success) return response(fail('rate_limited', 'Too many new sessions. Wait one minute.', 429));
        for (let attempt = 0; attempt < 3; attempt++) {
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => alphabet[byte % alphabet.length]).join('');
          const ownerToken = token(); const result = await env.SESSIONS.getByName(code).create(code, await hash(ownerToken), duration);
          if (result.ok) return response({ ...result, ownerToken });
        }
        return response(fail('busy', 'Could not create a code. Try again shortly.', 503));
      }
      const match = url.pathname.match(/^\/api\/session\/([A-HJ-NP-Z2-9]{8})\/([a-z-]+)$/);
      // Dashboard cookie discovers its code without exposing the management credential to JS.
      const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)pc_dashboard=([A-HJ-NP-Z2-9]{8})\.([a-f0-9]{64})(?:;|$)/);
      const dashboardPath = url.pathname.match(/^\/api\/session\/dashboard\/(status|update|logout)$/);
      if (dashboardPath && !origin) return response(fail('forbidden', 'Open the web dashboard to manage a paired session.', 403));
      if (dashboardPath?.[1] === 'logout') {
        if (cookie) await env.SESSIONS.getByName(cookie[1]).access('update', await hash(cookie[2]), true, JSON.stringify({ unpair: true }), ip);
        const out = response({ ok: true }); out.headers.set('Set-Cookie', 'pc_dashboard=; Path=/api/session; HttpOnly; Secure; SameSite=Strict; Max-Age=0'); return out;
      }
      const code = dashboardPath ? cookie?.[1] : match?.[1]; const operation = dashboardPath?.[1] || match?.[2];
      if (!code || !CODE.test(code) || !operation) return response(fail('unauthorized', 'Open and pair the dashboard from PearConnect Desktop.', 401));
      const bearer = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      const digest = dashboardPath && cookie ? await hash(cookie[2]) : bearer ? await hash(bearer) : '';
      if (bearer && origin) return response(fail('forbidden', 'Desktop credentials are not accepted from browsers.', 403));
      const result: Json = JSON.parse(await env.SESSIONS.getByName(code).access(operation, digest, !!dashboardPath, JSON.stringify(body), ip));
      if ('dashboardToken' in result) {
        const { dashboardToken, ...data } = result;
        const out = response(data); out.headers.set('Set-Cookie', `pc_dashboard=${code}.${dashboardToken}; Path=/api/session; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`); return out;
      }
      return response(result);
    } catch {
      console.error(JSON.stringify({ event: 'session_operation_failed' }));
      return response(fail('unavailable', 'The session service is unavailable. Check the previous result before retrying.', 503));
    }
  }
} satisfies ExportedHandler<Env>;
