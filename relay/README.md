# PearConnect session relay

Cloudflare Worker plus one SQLite Durable Object per random eight-character stream code. The static website remains on Pages; only `pearconnect.mellozone.site/api/session*` routes to this Worker.

```powershell
cd relay
npm ci
npm test
$env:CLOUDFLARE_ACCOUNT_ID='61ac4bebbe92f78de54198ee6c9a3b3c'
npm run deploy
```

Deployment is explicit. CI tests the relay and browser flows without production credentials. Run `npm run dev` here and `npm run dev` in `website/` for local integration; the Vite development server proxies the API to port 8790. `website`'s static Pages preview alone does not emulate the relay.

## Delivery contract

- Desktop creates a paused session using outbound HTTPS. Owner credentials remain in the main process and are not persisted or sent to the renderer.
- Viewer codes allow submission and receipt checks. Display names are unverified. A per-session salted network hash supplies the shared engine's `web` identity; raw network addresses are not persisted in the database.
- Desktop polls every two seconds. A claim is persisted before its response is sent. A claimed request is never redelivered. The native engine checks shared rules, asks the relay for a final permit, and enqueues once. A failed/lost enqueue or response is not retried automatically.
- Requests expire after 90 seconds or at session expiry, whichever comes first. A request claimed before losing connectivity becomes uncertain; an unclaimed request expires without an enqueue. Records are removed after 15 minutes by Durable Object alarms.
- A 20-second heartbeat bounds offline detection. On a network error Desktop pauses; it does not automatically resume when connectivity returns. Expiry, ending, switching inputs and closing Desktop revoke intake.
- A pause cannot undo an enqueue already started. Network-based identities cannot be reconciled with platform identities, and users who change networks may acquire a different website identity. Restricted allowlists deny all anonymous website requests.

## Dashboard authentication

Desktop mints a two-minute, single-use 256-bit pairing token. The browser consumes it from a URL fragment, clears the fragment immediately, and receives a separate secure HttpOnly SameSite cookie. Tokens are stored as SHA-256 digests on the relay. New pairing replaces prior browser access; Desktop or the dashboard can revoke it. Public codes never grant control access.

Browser mutations require the approved origin and JSON. Native owner credentials are rejected when a browser Origin header is present. Responses are no-store/noindex. The existing localhost webhook's Origin/Host restrictions remain intact.

API attempt limits are 120 requests/minute/network at Cloudflare, session creation 5/minute/network, submissions 6/minute/network/session, 20 active requests/session, and 500 retained records/session. This is an anonymous service with bounded use, not proof of viewer identity. No analytics or raw-argument logs are added.

## Tests

`npm test` generates current Cloudflare types, type-checks, builds a dry-run bundle and exercises the real Workers runtime using Miniflare. Test-only fault controls simulate expiration, stale heartbeats and receipt retention; they are never included in the deployed bundle. The test covers the native `SessionClient` and actual shared queue manager.

From `website/`, after building both packages, `npm run test:sessions` runs real Chromium against the local Worker and shared engine with controlled player fixtures. Set `PEARCONNECT_CHROME` to an installed Chrome executable on Windows, or install Playwright Chromium for CI.

The `sessions.yml` workflow runs both suites. These tests do not establish real TikTok delivery or audible playback.
