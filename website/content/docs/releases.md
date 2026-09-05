---
title: Release notes
description: Download the current PearConnect desktop preview and understand what has been tested and what remains planned.
---

# Release notes

## 0.3.0-beta.3 · Visual studio

**5 September 2026** · Windows x64 · Portable ZIP

[Download the current Windows preview](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/v0.3.0-beta.3/PearConnect-0.3.0-beta.3-win-x64.zip) · [Release and checksums](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/tag/v0.3.0-beta.3)

- Live player artwork, elapsed/remaining time, duration and pause state in Overview.
- A [visual studio](/docs/visual-studio) with live/sample previews, three OBS widget layouts, custom accents, surfaces, fonts and optional ambient animation.
- A separate private read-only localhost overlay server. No player credentials or Last.fm data appear in OBS output.
- Four desktop backgrounds, font and text-size choices, three original icon presets and a packaged Windows icon replacing Electron's default.
- Optional Last.fm genre tags, listener counts and similar-track discovery using your own encrypted API key. This does not queue suggestions, scrobble or add Spotify playback.
- A refreshed website with an interactive widget-style example and a new app preview.

Ambient motion is decorative and follows play/pause; it does not capture or analyze audio. External Last.fm service availability needs verification with your own key. Automated checks use controlled music/image fixtures; an OBS and real-player rehearsal is still required. The Windows build remains an unsigned preview.

Close the old app, extract the complete new ZIP and launch its `PearConnect.exe`. Existing settings are preserved. Website publication does not update Desktop.

## 0.3.0-beta.2 · Guided validation & session codes

**5 September 2026** · Windows x64 · Portable ZIP

[Download the current Windows preview](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/v0.3.0-beta.2/PearConnect-0.3.0-beta.2-win-x64.zip) · [Release and checksums](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/tag/v0.3.0-beta.2)

- An interactive [guided connection test](/docs/validation) checks the player, an actual incoming command marker and a read-only song search before deliberately enabling requests.
- Optional [session codes](/docs/session-codes) let viewers request songs on the website when TikTok commands are not reaching Desktop.
- Codes expire after a configurable 15 minutes to 24 hours. Create them in Desktop, or manage their active expiry from a securely paired web dashboard.
- The Cloudflare relay keeps management credentials separate from viewer codes, applies rate limits and never automatically replays a claimed request.
- Anonymous website names cannot bypass chat allowlists. Shared network identities enforce website cooldowns; TikTok command intake remains suspended while the fallback exists.
- Browser tests cover pairing, expiry controls, Unicode requests, confirmation, refresh without replay, cooldowns, pause/end controls and mobile layouts. Engine tests exercise live local WebSocket delivery; Electron tests walk the actual guide.

These checks use controlled player/chat fixtures. Live TikTok delivery, actual audible playback, fresh-machine acceptance and sustained streaming workloads still require a stream rehearsal. The build remains an unsigned preview.

**Upgrade required:** updating the website does not update Desktop. Close your old PearConnect instance, extract the new ZIP into a separate folder, and run its `PearConnect.exe`. Saved settings remain in your Windows user-data folder; every launch starts paused. Session codes must be recreated after restarting Desktop.

## 0.3.0-beta.1 · Windows desktop preview

**5 September 2026** · Windows x64 · Portable ZIP

[Download the Windows preview](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/v0.3.0-beta.1/PearConnect-0.3.0-beta.1-win-x64.zip) · [Release and checksums](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/tag/v0.3.0-beta.1)

### Included

- A shared engine for desktop and CLI, with identical request rules and accounting.
- Simple TikFinity event input with reconnection and message-ID deduplication.
- Advanced Streamer.bot integration, preserving existing configuration behavior.
- Desktop authorization, connection status, rules, request controls and diagnostics.
- A refreshed desktop layout with persistent intake controls, activity tables and a separate read-only player queue.
- Encrypted desktop credentials, validated app communication and cross-interface instance exclusion.

### Verified automatically

The [desktop source build](https://github.com/foulfoxhacks/PearConnect-Song-Requests/actions/runs/33985424189) passed all seven CI jobs: Node 22/24 on Windows/Linux, the Streamer.bot C# contract harness, dependency audit, and real Electron checks plus Windows packaging.

Tests use controlled player/chat fixtures, real local sockets and Windows credential encryption. They do not establish successful live TikTok delivery or audible playback on every setup.

### Preview limitations

- Portable Windows build is unsigned.
- Live-platform fixtures, fresh-machine onboarding and sustained streaming workloads still need acceptance testing.
- Request history is session-only and bounded.
- Per-user tracking is an approximate duration window, not exact queue ownership.
- Simple TikTok and YouTube replies remain in PearConnect.
- Attach-to-running-CLI, persistent history, approvals and queue cancel/remove/reorder controls are not included.

### Upgrading

Close the old engine before starting the new one. Import existing `.env` files deliberately from desktop Connections. Configurations without a connection mode stay Advanced; desktop imports and launches start paused.

See [installation](./install) and [troubleshooting](./troubleshooting) before enabling requests on a stream.

## Website and documentation

The homepage and these guides are hosted on Cloudflare. The site provides a versioned Windows download, locally indexed documentation search, setup guides and current capability notes. Website updates do not update an installed PearConnect app automatically.
