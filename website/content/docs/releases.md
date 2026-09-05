---
title: Release notes
description: Download the current PearConnect desktop preview and understand what has been tested and what remains planned.
---

# Release notes

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
