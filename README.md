# PearConnect Song Requests

Local-first song requests for **Pear Desktop**, with **TikFinity + Streamer.bot** for TikTok LIVE and direct adapters for Twitch and YouTube Live.

```text
TikTok LIVE -> TikFinity -> Streamer.bot --\
Twitch chat ------------------------------> PearConnect -> Pear Desktop API -> music queue
YouTube Live chat ------------------------/
```

**Streamer.bot sends the HTTP POST. TikFinity triggers the Streamer.bot action.** You do not need to find POST, Content-Type, or JSON-body settings in TikFinity's normal action editor.

PearConnect searches and moderates requests; Pear Desktop owns playback. There is no hosted PearConnect service, but the music and chat platforms still require internet access. This is an independent community project, not an official integration endorsed by those platforms.

## Start here

| Goal | Guide |
| --- | --- |
| Install and authorize Pear Desktop | [Quick start](#quick-start) |
| Import all five Streamer.bot actions | [Streamer.bot setup](docs/STREAMERBOT.md) |
| Diagnose the connection without playing music | [Safe testing](#safe-testing) |
| Configure rules or another chat platform | [Configuration](#configuration) |
| Understand what has actually been tested | [Testing and live acceptance](docs/TESTING.md) |

## What is included

Song requests, now playing, next-track information, allowlisted skipping, per-platform/user cooldowns, a best-effort request-count limit, song-length checks, and a query/title/artist blocklist. The local webhook validates input and returns explicit success or rejection codes. A reusable Streamer.bot C# source and generated five-action `.sb` import are included.

| Input | Connection | Replies |
| --- | --- | --- |
| TikTok LIVE | TikFinity -> Streamer.bot -> local JSON API | Optional TikFinity chatbot relay |
| Twitch | `tmi.js` adapter | Sent to Twitch chat |
| YouTube Live | Unofficial `youtube-chat` adapter | PearConnect terminal only |
| Local automation | JSON POST API | JSON response |

## Requirements

Use **Node.js 22 or 24**, npm, and Pear Desktop with its **API Server** plugin enabled. The supported runtime minimum is Node.js 22; do not use the old Node.js 18 recommendation. The TikTok path additionally needs TikFinity Desktop and Streamer.bot on Windows. The supplied import uses the Streamer.bot 0.2.6 export schema and requires 0.2.6 or later; the desktop acceptance checklist remains important for your installed version.

Upstream resources: [Pear Desktop](https://github.com/pear-devs/pear-desktop), [Node.js releases](https://nodejs.org/en/about/previous-releases), [TikFinity integration](https://tikfinity.zerody.one/streamerbot-integration), [Streamer.bot](https://streamer.bot/).

## Quick start

### 1. Install the bridge

```bash
git clone https://github.com/foulfoxhacks/PearConnect-Song-Requests.git
cd PearConnect-Song-Requests
npm ci
npm run setup
```

`setup` creates `.env` from the included **`.env.txt`**, generates a private webhook secret, and never overwrites an existing `.env`. Open `.env` locally. Do not share it, commit it, or include it in support screenshots.

Manual copying is also possible: `Copy-Item .env.txt .env` in PowerShell, `copy .env.txt .env` in Command Prompt, or `cp .env.txt .env` on macOS/Linux. Manual copying does not generate a secret; set one yourself. Never overwrite a configured `.env` just to upgrade.

### 2. Enable and authorize Pear Desktop

Enable Pear Desktop's **API Server** plugin. Keep it on localhost. PearConnect's default is:

```dotenv
YTMD_HOST=http://127.0.0.1:26538
YTMD_CLIENT_ID=ytmd-stream-bot
YTMD_TOKEN=
```

With Pear Desktop open and its first-request authorization enabled, run:

```bash
npm run auth
```

Approve the request in Pear Desktop, then paste the printed token into `YTMD_TOKEN` in `.env`. The auth command prints a sensitive token intentionally; redact that output before sharing it. A changed client ID may require a new authorization.

### 3. Start and check the bridge

```bash
npm start
```

In a second terminal, in the same project folder:

```bash
npm run doctor
```

The bridge checks the Pear Desktop connection before reporting a successful startup. Doctor checks configuration, process health, player reachability, and a non-mutating test POST. An idle player's `204 No Content` is a valid connection result, not a failure.

Keep Pear Desktop and the PearConnect terminal running. Configure only the chat platforms you need. Use `Ctrl+C` for shutdown.

### 4. Connect TikFinity through Streamer.bot

Follow [the full Streamer.bot guide](docs/STREAMERBOT.md). The included file is:

```text
integrations/streamerbot/PearConnect.sb
```

It contains **Song Request**, **Now Playing**, **Queue**, **Skip**, and **Connection Test** actions. It does not import credentials, servers, chat commands, automatic triggers, or an autorun action. You configure the connection and map your own TikFinity commands after importing.

## Safe testing

Before enabling live requests, start a no-playback bridge:

```bash
npm run start:dry-run
```

This mode needs no Pear Desktop token, does not call the player, does not connect Twitch or YouTube, and does not update cooldown or request counters. TikFinity/Streamer.bot can still POST to its localhost endpoint. Responses explicitly say `dry_run`; they do not claim a song was queued.

In a second terminal:

```bash
npm run doctor -- --dry-run
```

The **Connection Test** Streamer.bot action calls `/tikfinity/test`. This validates the submitted identity/query and authentication without changing player or quota state, even when the bridge is in live mode. It does **not** prove Pear Desktop is available. `/readyz` or `npm run doctor` checks player availability separately.

Stop dry-run before starting live mode on the same port. A port collision fails startup with a clear error instead of printing a misleading running message.

## Commands

| Default command | Behavior |
| --- | --- |
| `!sr <artist and title>` | Searches and adds the first usable result |
| `!np` | Reports the current song or idle state |
| `!queue` | Reports the next song, not the entire queue |
| `!skip` | Advances playback only for allowlisted identities |

`CMD_*` settings affect the direct Twitch/YouTube adapters. TikFinity command/event mappings are configured separately. When renaming `!sr`, also set Streamer.bot's `PearConnect.RequestCommand` to the same name without `!` so full-comment payloads normalize correctly.

Requests are **search text**, not a guaranteed YouTube URL/playlist resolver. Use artist and title. Enqueuing does not automatically start a paused player or guarantee the selected recording is the one you intended.

## Configuration

Restart PearConnect after changing `.env`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `YTMD_HOST` | `http://127.0.0.1:26538` | Pear Desktop API origin; no path or credentials |
| `YTMD_CLIENT_ID` | `ytmd-stream-bot` | Authorization client identifier |
| `YTMD_TOKEN` | Empty | Required in live mode |
| `YTMD_TIMEOUT_MS` | `10000` | Per-player-request timeout, 100-60000 ms |
| `TIKFINITY_PORT` | `7280` | Local bridge port; `0` disables HTTP listener |
| `TIKFINITY_SECRET` | Empty in template | Shared `X-Webhook-Secret`; setup generates one |
| `DRY_RUN` | `false` | No player calls or direct chat connections |
| `COOLDOWN_SECONDS` | `60` | Per-platform/user time between accepted requests; `0` disables |
| `MAX_SONG_SECONDS` | `420` | Reject longer or unverified-duration results; `0` disables length checks |
| `MAX_PER_USER` | `2` | Best-effort tracked-request window limit; `0` disables |
| `BLOCKLIST` | Empty | Comma-separated case-insensitive query/title/artist substrings |
| `SKIP_ALLOWLIST` | Empty | Comma-separated identities permitted to skip |
| `TWITCH_CHANNEL` | Empty | Lowercase channel; empty disables Twitch |
| `TWITCH_USERNAME` | Empty | Login name of the bot account |
| `TWITCH_OAUTH` | Empty | Bot token, `oauth:...` |
| `YOUTUBE_CHANNEL_ID` | Empty | Channel ID; empty disables YouTube |
| `CMD_REQUEST` | `sr` | Request command, without `!` |
| `CMD_NOWPLAYING` | `np` | Now-playing command, without `!` |
| `CMD_QUEUE` | `queue` | Next-song command, without `!` |
| `CMD_SKIP` | `skip` | Skip command, without `!` |

Invalid integers, conflicting commands, malformed hosts, and partial Twitch credentials fail early. `0` is honored rather than being silently replaced by a default.

### Twitch

Set `TWITCH_CHANNEL`, `TWITCH_USERNAME`, and `TWITCH_OAUTH`. Obtain an appropriate bot token for the account that will send replies. Never give this token to viewers. PearConnect uses Twitch's stable user ID when supplied for quota accounting and the login name for skip authorization. No Streamer.bot action is needed for this adapter.

### YouTube Live

Set `YOUTUBE_CHANNEL_ID`. The bundled adapter reads live chat through the unofficial `youtube-chat` package; upstream changes may break it. It cannot send replies to YouTube chat. Adding a separate chatbot does not automatically mirror terminal messages.

### Skip permissions

Prefer platform-scoped entries:

```dotenv
SKIP_ALLOWLIST=tiktok:yourhandle,twitch:yourlogin,youtube:UC_YOUR_EXACT_CHANNEL_ID
```

Bare usernames remain compatible for TikTok and Twitch. **YouTube requires `youtube:<exact channel ID>`** because display names are not unique. TikTok/Twitch usernames are compared case-insensitively; YouTube channel IDs are exact. Empty allowlist permits nobody. Supplied webhook identities are trusted only as input from your local automation: a secret-holder can impersonate another user, so the webhook is not a public authorization service.

## Local HTTP API

All addresses below use the bridge port, **not** Pear Desktop's port. The listener binds only to `127.0.0.1`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Process health and live/dry-run mode |
| GET | `/readyz` | Pear Desktop read check, or explicit dry-run bypass |
| POST | `/tikfinity` | Song request |
| POST | `/tikfinity/np` | Now playing |
| POST | `/tikfinity/queue` | Next song |
| POST | `/tikfinity/skip` | Allowlisted skip |
| POST | `/tikfinity/test` | Non-mutating payload validation |

POST example:

```http
POST http://127.0.0.1:7280/tikfinity
Content-Type: application/json
X-Webhook-Secret: your_private_value
Idempotency-Key: a_unique_request_key
```

```json
{"user":"viewer_handle","userId":"123456789","query":"Artist Song Title"}
```

`user` is required; `userId` is optional but recommended and must be a string; `query` is optional for non-request routes. Empty request queries produce usage help. Objects, arrays, unresolved placeholders, control characters, and overlong fields are rejected. Limits: user/userId 100 characters, query 512, body 64 KiB. No query-string mutation support or browser CORS is provided.

When the secret is nonempty, **every endpoint**, including health/readiness, requires it. A blank server secret disables that check; a surplus client header does not enable authentication. Native clients should omit `Origin` and use the localhost URL.

Typical results:

```json
{"ok":true,"code":"added","message":"@viewer added: Song - Artist (3:42)"}
```

```json
{"ok":false,"code":"cooldown","message":"@viewer slow down - try again in 42s.","retryAfter":42}
```

Policy rejections use HTTP 200 with `ok:false`; do not treat transport success as acceptance. Malformed input uses 400, authentication 403, unknown endpoints 404, wrong method 405, conflicting idempotency keys 409, oversized body 413, wrong content type 415, upstream failures 502/504, and capacity/readiness failures 503. Unexpected handler errors return safe JSON 500 responses.

Optional `Idempotency-Key` values (8-100 letters, digits, `_` or `-`) coalesce concurrent identical requests and replay their result for five minutes, including failures. Reusing a key for different input is rejected. This cache is in memory, capped at 1000 entries, and does not survive restarts. It cannot guarantee exactly-once playback across crashes. Streamer.bot creates a new key per action execution and never automatically retries a write. If a write times out, inspect the player queue before manually retrying.

## Queue behavior and limits

Cooldowns begin only after a successful enqueue. A same-user request reserves its processing slot before searching, preventing overlapping requests from bypassing limits. Stable IDs are used when supplied; usernames are the fallback, and platform quotas remain separate.

`MAX_PER_USER` is **not exact queue ownership tracking**. A known-length accepted request occupies a slot for its duration plus five seconds from submission, not from actual playback. When length checks are disabled, unknown-duration requests expire after 15 minutes instead of blocking forever. Skips, long queues, external edits, and restarts can make this approximation differ from actual queued songs. Disable this limit with `0` when that tradeoff is unsuitable. There is no persistent queue database, playlist import, guaranteed recording selection, or automatic ownership synchronization.

With a nonzero maximum duration, missing/unparseable durations are rejected rather than bypassing the limit. The parser supports flex and fixed duration columns, but YouTube Music's internal response shape is not a stable public contract.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| TikFinity has no POST/body fields | Use its Streamer.bot Action integration, not the normal webhook editor |
| Streamer.bot action missing | Import the package, confirm actions are enabled, reconnect TikFinity |
| C# reference/compile error | Open Execute C# Code, use Find Refs, verify System.Net.Http/Newtonsoft.Json; see [guide](docs/STREAMERBOT.md) |
| Missing user or unresolved placeholder | Trigger the real TikFinity custom command or supply test arguments; do not hardcode `%username%` |
| 403 | Compare local secrets; ensure native localhost request without Origin |
| 405 / `Cannot GET` | POST JSON from Streamer.bot; do not open a mutation URL in a browser |
| Startup cannot reach player | Open Pear Desktop, enable API plugin, check 26538 versus 7280, reauthorize token |
| No results / unknown duration | Try artist and title; check player availability and metadata compatibility |
| Requests stop at per-user limit | Understand the request window above; inspect settings rather than repeatedly restarting |
| No TikTok reply | Enable both `PearConnect.ChatReplies` and TikFinity's permission to accept Streamer.bot messages |
| Song appears twice | Remove duplicate event mappings/actions; do not retry uncertain requests automatically |
| `npm ci` engine error | Use Node.js 22 or 24 and the committed lockfile |

## Security and responsible use

Keep both APIs local. Do not port-forward them or expose them through tunnels. The localhost secret protects against unauthorized local calls, not against a compromised computer. Store Streamer.bot credentials in local persisted globals, never in exported code. The supplied relay broadcasts only a message, not the entire action argument dictionary.

Do not commit `.env`, logs with tokens, or personal Streamer.bot exports. Runtime errors redact upstream response bodies; the authentication command deliberately prints the token you requested. A music queue request does not grant permission to rebroadcast that music: respect the applicable platform rules and rights.

The dependency lock is reproducible; inspect `npm audit` when upgrading. See [testing notes](docs/TESTING.md) for audit status and any known limitations, rather than assuming a green functional test is a clean security audit.

## Development

```bash
npm ci
npm run check
npm test
npm run build:streamerbot
npm run check:streamerbot
```

On Windows with the .NET SDK and .NET Framework 4.8 targeting pack:

```bash
npm run test:streamerbot
```

The original `test-smoke.mjs` remains intact. Additional tests cover real loopback HTTP, mocked Pear Desktop contracts, validation, concurrency, dry-run, import generation, and process startup. The C# test compiles the same source embedded in the import and sends actual POSTs to the Node bridge, using a narrow CPH test double. **It is not a substitute for importing into the real Streamer.bot desktop or testing live TikTok and audible playback.** Follow [the live checklist](docs/TESTING.md).

```text
src/                      runtime, configuration, policy, platform adapters
scripts/                  setup, diagnostics, checks, integration build/tests
integrations/streamerbot/  reviewed C# source and generated native import
test/                     regression tests and Windows C# harness
docs/                     integration instructions and test boundaries
REGRESSION_LEDGER.md       safeguards and change record
```

## Contributing and license

Read [REGRESSION_LEDGER.md](REGRESSION_LEDGER.md) before changing integration behavior. Keep source and import synchronized, preserve POST-only mutations, add regression tests, and distinguish mock verification from live-platform evidence in pull requests.

MIT licensed; see [LICENSE](LICENSE). Built by [Aleksandr "Sammy" Freyermuth](https://github.com/foulfoxhacks). Thanks to Pear Desktop, TikFinity, Streamer.bot, `tmi.js`, and `youtube-chat` for the upstream tools and interfaces.
