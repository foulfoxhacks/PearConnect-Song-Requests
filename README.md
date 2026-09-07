# PearConnect Song Requests

Local-first song requests for **Pear Desktop**, with a **desktop console or CLI** and two TikTok connection modes.

The `0.3.0-beta.5` preview adds a live player-queue overlay, portrait layouts for TikTok Studio, a separate social ticker with platform icon packs, and Discord desktop Rich Presence. Duration lookup, verified queue additions, guided validation, and expiring website request codes remain included.

**Project website:** https://pearconnect.mellozone.site/  
**Documentation:** https://pearconnect.mellozone.site/docs/  
**Creator:** [Sammy The Femboy Puppy](https://akasammythepuppy.me/) · [creator/development portfolio](https://akasammythepuppy.me/work/)

> **Player compatibility note:** a live test with YouTube Music Desktop 3.11.0 reproduced an acknowledged enqueue with no new queue entry. This preview reports that outcome rather than claiming to repair the external player's enqueue implementation. Update the player and verify one request before a stream.

## Connection model

```text
TikTok LIVE -> TikFinity local WebSocket (Simple) --------\
TikTok LIVE -> TikFinity -> Streamer.bot POST (Advanced) -> shared PearConnect engine -> Pear Desktop
Twitch / YouTube chat -----------------------------------/
                         Desktop console or CLI controls the same engine
```

- **Simple** receives TikFinity chat events without Streamer.bot.
- **Advanced** preserves the existing automation flow where TikFinity triggers Streamer.bot and Streamer.bot sends the local HTTP POST.
- Only one TikTok input route accepts commands at a time.

| Connection | Desktop | CLI / headless |
| --- | --- | --- |
| Simple / TikFinity Connection | Recommended for new users | Direct event input without a window |
| Advanced / Streamer.bot & Automation | Visual integration settings | Existing automation workflow |

New setup files default to Simple with requests paused. Existing `.env` files without a mode remain Advanced. The desktop imports existing configuration explicitly and starts paused.

## What is included

- song requests
- now playing
- next-track information
- allowlisted skipping
- platform/user cooldowns
- best-effort per-user request limits
- maximum song-length checks
- query/title/artist blocklists
- local webhook with explicit success/rejection codes
- reusable Streamer.bot C# source
- generated five-action `.sb` import
- desktop and CLI workflows
- guided setup/test flow
- temporary website request codes
- Discord desktop Rich Presence
- portrait-friendly queue/player overlays

PearConnect searches and moderates requests. **Pear Desktop owns playback.** There is no hosted PearConnect playback service, though the music/chat platforms still require internet access.

This is an independent community project and is not an official integration endorsed by TikTok, Twitch, YouTube, Discord, Pear Desktop, or Streamer.bot.

## Inputs

| Input | Connection | Replies |
| --- | --- | --- |
| TikTok LIVE / Simple | TikFinity local event WebSocket | Desktop activity / CLI results |
| TikTok LIVE / Advanced | TikFinity -> Streamer.bot -> local JSON API | Optional TikFinity chatbot relay |
| Twitch | `tmi.js` adapter | Twitch chat |
| YouTube Live | unofficial `youtube-chat` adapter | PearConnect terminal only |
| Local automation | JSON POST API | JSON response |

## Requirements

The portable Windows desktop build includes its runtime.

For CLI/source development:

- Node.js 22 or 24
- npm
- Pear Desktop with the **API Server** plugin enabled
- TikFinity Desktop on the same computer for TikTok
- Streamer.bot only when using Advanced mode

The supplied Streamer.bot import uses the 0.2.6 export schema and requires 0.2.6 or later.

## Quick start

For the graphical application, use the project documentation:

- [`docs/DESKTOP.md`](docs/DESKTOP.md)
- [`docs/STREAMERBOT.md`](docs/STREAMERBOT.md)
- [`docs/TESTING.md`](docs/TESTING.md)

CLI workflow:

```bash
git clone https://github.com/foulfoxhacks/PearConnect-Song-Requests.git
cd PearConnect-Song-Requests
npm ci --omit=dev --ignore-scripts
npm run setup
```

`setup` creates `.env` from the included `.env.txt`, generates a private webhook secret, and does not overwrite an existing `.env`.

Never share or commit `.env`.

## Authorize Pear Desktop

Enable Pear Desktop's **API Server** plugin and keep it on localhost.

Default configuration:

```dotenv
YTMD_HOST=http://127.0.0.1:26538
YTMD_CLIENT_ID=ytmd-stream-bot
YTMD_TOKEN=
```

Authorize:

```bash
npm run auth
```

Approve the request in Pear Desktop, then store the returned token in `YTMD_TOKEN`.

## Start the bridge

```bash
npm start -- --mode simple --accept-requests
```

In another terminal:

```bash
npm run doctor
```

The bridge checks the Pear Desktop connection before reporting a successful startup.

## Safe testing

Before enabling live requests:

```bash
npm run start:dry-run -- --accept-requests
```

Then:

```bash
npm run doctor -- --dry-run
```

Dry-run mode does not call the player, update accounting, or connect Twitch/YouTube. It can still receive the selected local TikFinity input so the command flow can be tested without claiming a track was queued.

## Commands

| Default command | Behavior |
| --- | --- |
| `!sr <artist and title>` | Searches and adds the first usable result |
| `!np` | Reports current song or idle state |
| `!queue` | Reports the next song |
| `!skip` | Advances playback for allowlisted identities |

Requests are search text, not a guaranteed YouTube URL or playlist resolver. Use artist and title.

## Important configuration

| Variable | Typical default / behavior | Meaning |
| --- | --- | --- |
| `CONNECTION_MODE` | Simple for new setup; legacy Advanced when absent | Active TikTok route |
| `TIKFINITY_WS_URL` | `ws://127.0.0.1:21213/` | Simple local event feed |
| `REQUESTS_ENABLED` | paused for new setup | Initial request intake |
| `YTMD_HOST` | `http://127.0.0.1:26538` | Pear Desktop API origin |
| `YTMD_CLIENT_ID` | `ytmd-stream-bot` | Authorization client identifier |
| `YTMD_TOKEN` | empty | Required in live mode |
| `TIKFINITY_PORT` | `7280` | Local PearConnect bridge port |
| `TIKFINITY_SECRET` | generated during setup | Local shared webhook secret |
| `DRY_RUN` | `false` | Disable player/accounting mutations |
| `COOLDOWN_SECONDS` | `60` | Per-platform/user cooldown |
| `MAX_SONG_SECONDS` | `420` | Maximum verified duration |
| `MAX_PER_USER` | `2` | Best-effort tracked request limit |
| `BLOCKLIST` | empty | Query/title/artist substring blocklist |
| `SKIP_ALLOWLIST` | empty | Identities permitted to skip |

## Local HTTP API

The bridge binds to loopback.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Process health and live/dry-run mode |
| GET | `/readyz` | Player readiness or explicit dry-run bypass |
| GET | `/status` | Sanitized engine state and recent command results |
| GET | `/diagnostics` | Report excluding credentials/identities/request content |
| POST | `/tikfinity` | Song request |
| POST | `/tikfinity/np` | Now playing |
| POST | `/tikfinity/queue` | Next song |
| POST | `/tikfinity/skip` | Allowlisted skip |
| POST | `/tikfinity/test` | Non-mutating payload validation |

Example:

```http
POST http://127.0.0.1:7280/tikfinity
Content-Type: application/json
X-Webhook-Secret: your_private_value
Idempotency-Key: a_unique_request_key
```

```json
{"user":"viewer_handle","userId":"123456789","query":"Artist Song Title"}
```

Do not expose the local webhook to the public internet.

## Website request-code fallback

If TikTok commands cannot connect, the desktop can create a temporary website request code for:

https://pearconnect.mellozone.site/sessioncode

Expiration is configurable from 15 minutes to 24 hours. The fallback suspends TikTok command intake and does not bypass configured request allowlists.

See the session guide:

https://pearconnect.mellozone.site/docs/session-codes

## Project status and testing

PearConnect deliberately distinguishes transport success from confirmed player behavior. Before a live stream:

1. update Pear Desktop
2. run the guided test
3. verify a unique live request
4. confirm the track actually appears in the player queue
5. only then enable normal request intake

See [`docs/TESTING.md`](docs/TESTING.md) for the maintained acceptance notes.

## Issues and contributions

For PearConnect bugs and feature requests, use the repository issue tracker. Include your connection mode, app versions, sanitized logs, and the smallest reproducible sequence.

## Creator

PearConnect is built and maintained by **[Sammy The Femboy Puppy](https://akasammythepuppy.me/)** (`@foulfoxhacks`).

More streaming integrations, creator systems, VRChat work, and development projects are documented in **[Sammy's Work & Skills Portfolio](https://akasammythepuppy.me/work/)**.
