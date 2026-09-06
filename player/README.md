# PearConnect Player

An independently modified Windows player based on **th-ch / pear-devs YouTube Music 3.11.0**, upstream commit `721271d902ebff0bc5870b96b2b95deb0ebeb23e`. This is a separate player executable, used alongside PearConnect Desktop. It is not an official upstream release.

## Player Studio

Open **PearConnect → Player Studio**, the **PearConnect Studio** button beside search, or **Ctrl+Shift+P**.

- Four colour palettes, three typography choices, comfortable/compact queue spacing, and three PearConnect window icons.
- Import PNG/JPEG/WebP backgrounds (8 MB maximum); decoded images are normalized before being applied. A dark layer maintains text contrast.
- A live artwork preview with elapsed, remaining and total track time. The player bar also shows time played and time left.
- Import sandboxed HTML/CSS/JavaScript `.pearplugin` files. Review permissions and a SHA-256 fingerprint in the native installation dialog, then open the plugin from Studio. Imports do not execute automatically.
- Export a working now-playing plugin to customize. See [the plugin format and API](PLUGINS.md).
- SponsorBlock category selection, automatic or manual skipping, a minimum segment length and an Undo button. Enabling/disabling requires a player restart; mode/category changes refresh the current track.

The player uses its own application identity and Pear icon. The executable's file icon remains the default Pear; selecting an icon changes running window icons. Appearance presets do not replace YouTube's service identity or sign-in UI.

The packaged Windows build uses **Electron 44.2.0**, the runtime pinned by PearConnect Desktop, while retaining the **3.11.0 player and bundled plugin sources**. It does not switch to the 3.12.0 player implementation.

## SponsorBlock improvements

Lookups have a six-second timeout, bounded caching and a generation check that rejects late responses for an earlier track. Only skip actions in selected categories with finite, in-range timestamps and compatible recording lengths are used. Overlapping segments are combined during skipping. Undo returns to the pre-skip position and exempts those overlapping segments for the remainder of the track. Missing data and service errors leave playback alone. Counters track skips and time saved in the current application session and subtract an undone skip.

New installations select sponsor and self-promotion segments when SponsorBlock is enabled. Existing configured categories are preserved. SponsorBlock remains off by default; it is distinct from the ad-blocker plugin.

## Use the portable executable

1. Close the other YouTube Music / Pear Desktop player so its API releases port 26538.
2. Open `PearConnect-Player-3.11.0-pearconnect.1-win-x64.exe`.
3. This edition uses its own **PearConnect Player** profile. Sign in normally if you want your account's library. Existing player credentials and profiles are not copied.
4. The API Server plugin is enabled on `127.0.0.1:26538` and requires authorization. In PearConnect Desktop → Connections, authorize this player again.
5. Start a track in the player to initialize its queue. Test a request, then look at the end of **Up next**. Only a verified addition is reported as successful.

The upstream 3.11.0 ad-blocking plugin remains included and enabled by default. Its effectiveness depends on changes to YouTube; this build does not claim to fix advertising filters. Upstream automatic updates are removed so they cannot replace this modified edition. **Options → PearConnect Player releases** opens this project's release page.

## Queue changes

- Retrieve the exact video's queue renderer using `videoIds`, without forwarding an existing radio/playlist's queue context into the metadata request.
- Validate the returned video ID and reject unavailable data; never construct a fake playable queue entry.
- Serialize additions and check the queue instance and operation deadline immediately before insertion.
- Dispatch once, preserve existing ordering/playback, then confirm the increased occurrence count in the visible queue API.
- Correlate renderer responses by request ID and sender. The API waits for a result instead of immediately returning HTTP 204.
- Return an explicit failure or uncertain outcome when insertion cannot be verified. Never automatically retry a queue mutation.

`POST /api/v1/queue` now returns HTTP 200 JSON on verified success and HTTP 502 JSON on failure/uncertainty. Existing PearConnect beta.4 clients support this. Other clients that require a literal 204 response may need adjustment.

Two authenticated diagnostic routes are added:

- `GET /api/v1/queue/compatibility`: build/capability information.
- `POST /api/v1/queue/preview` with `{ "videoId": "PLXzNgd-Wgw" }`: fetch and validate metadata without enqueueing.

## Validation and limits

The regression suite covers metadata errors, exact IDs, a changing queue, deadlines, no-op/throwing dispatch, duplicate-ID verification, serialization, play-next positioning, preview mode, package permissions, appearance validation, SponsorBlock timestamps and stale responses. The isolated Electron acceptance test exercises the real YouTube Music page, real local API, and PearConnect request engine, checking that the requested 220-second recording becomes the next visible queue entry without changing the selected track. It also exercises the imported-plugin sandbox and the SponsorBlock controls with deterministic segment fixtures.

The original handler also worked in a clean profile. The earlier no-op on the streamer's existing 3.11.0/3.12.0 sessions was not reproduced in that fresh profile. This build removes the playlist-context dependency and silent-success behavior; validation against the streamer's signed-in session remains a separate check. It does not promise reliable queue ownership after unrelated external edits.

## Build from source

Use Node 22.18+ and the pinned pnpm 10 toolchain. From the PearConnect repository:

```powershell
npm ci
git clone --depth 1 --branch v3.11.0 https://github.com/pear-devs/pear-desktop.git dist/player-source-3.11.0
node player/prepare.mjs
node --experimental-strip-types --test player/test-queue.mjs player/test-studio.mjs
Set-Location dist/player-source-3.11.0
npx --yes pnpm@10.17.1 install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/electron-vite/bin/electron-vite.js build
node node_modules/electron-builder/cli.js --win portable --x64 --publish never
```

Run `node player/test-live.mjs` from the repository root for the isolated acceptance test. After packaging, use `node player/test-live.mjs --packaged` to exercise the packaged ASAR and dependencies under the same Electron runtime. It uses a new profile under `dist/player-tests`, a muted player and test API port 27639. It does not read or modify the streamer's player profile. The SponsorBlock portion seeks only within that isolated test session.

The source preparation also narrows an existing Float32Array annotation to resolve the locked TypeScript/Web Audio signature mismatch; that change has no runtime effect. The SponsorBlock implementation is modified as described above; the other bundled plugin implementations are retained. The upstream developer dependency still supplies Electron 38 type definitions; `electron-builder.yml` explicitly packages the tested 44.2.0 runtime.

Release executables are unsigned prerelease builds. Functional checks do not establish that every third-party plugin is trustworthy or that every legacy integration is compatible with the newer runtime. Imported plugins are isolated from the legacy player/preload and its authenticated session, and do not receive native plugin APIs.

## Licensing

Upstream YouTube Music is MIT licensed; its original `license` and third-party notices remain in the player/source distribution. PearConnect modifications are MIT licensed under this repository's LICENSE. YouTube branding and hosted content belong to their respective owners.
