# Next-version implementation and acceptance

## Shared engine and Simple connection

The shared `PearConnectEngine` now owns commands, moderation, intake state, activity and lifecycle. The CLI uses this engine; graphical controls will use the same operations. Existing configurations with no `CONNECTION_MODE` remain Advanced. Newly generated `.env` files select Simple and start paused.

```sh
npm start -- --mode simple --dry-run --accept-requests
npm start -- --mode simple --accept-requests
npm start -- --mode advanced
npm start -- --allow-disconnected --paused
npm start -- --dry-run --validate-config
npm start -- --status
npm start -- --diagnostics diagnostic-report.json
```

Use `--json` for structured logs. Simple reads TikFinity even in dry-run, but no player calls, request accounting, Twitch connections or YouTube connections occur. Without `--accept-requests`, new Simple installations reject requests as paused. The existing Advanced default continues accepting requests for migration compatibility. `--allow-disconnected` keeps the CLI running while the player needs repair; normal CLI startup retains a failing exit code when the player cannot be reached.

`TIKFINITY_WS_URL` defaults to `ws://127.0.0.1:21213/` and is restricted to loopback. Only recognized chat commands are processed. Unknown events update the last-event time without retaining chat content. Socket connection, chat arrival and recognized-command times are separate. Results of `!np` and `!queue` appear in activity/status; Simple does not send TikTok chat replies.

Event IDs suppress repeat deliveries for five minutes within a bounded in-memory cache that survives reconnects, but not engine restarts or mode switches. Events without message IDs cannot be deduplicated reliably; repeated text alone is not a duplicate identifier. Missing handles and non-string IDs are rejected. No request write is automatically retried.

Switching modes pauses requests, stops the previous input and waits for outstanding commands before connecting the new input. A search that has not begun writing is cancelled by the intake generation check. A write already sent must finish; its outcome can be uncertain on network failure. The Advanced listener may remain available for authenticated status and validation, but its TikTok command routes are inactive in Simple mode. Resume is deliberate after switching. Pause affects new song requests, leaving existing playback and separately authorized skip controls alone.

GUI and CLI enforce a shared instance lock independently of the webhook port. A second engine refuses startup; attach-to-running-engine is not implemented. Read-only CLI status/diagnostics use the existing authenticated localhost HTTP server and require it to be enabled.

`REQUEST_ALLOWLIST` is optional: empty permits everyone; entries use the same scoped identity matching as skip permissions. All adapters share command parsing, request policy and processing capacity. Rule changes preserve existing counters. The maximum per-user setting remains an approximate duration window, not queue ownership.

Activity is bounded to 200 command results in memory. Enqueue confirmation is distinct from playback; write failures carry an uncertain-outcome flag. Diagnostics deliberately omit credentials, configuration paths/URLs, viewer identities, queries, song metadata and raw logs. No persistent queue ownership, cancellation, approval queue or reordering is claimed.

## Verification boundary

Baseline `0bb62c7`: original 12 smoke assertions and 56 Node tests passed locally, with zero known npm audit vulnerabilities. Added tests exercise lifecycle repair, pause/switch during in-flight work, rule changes without counter resets, permissions, processing capacity, singleton exclusion and a real loopback WebSocket with reconnect/repeated/malformed events.

`test/fixtures/tikfinity-chat.json` is a **synthetic fixture matching the documented envelope**, not a recording from a real livestream. Real TikFinity event capture and fresh-machine player/chat acceptance remain required before declaring Simple production-ready. No live chat or audible playback has been tested in this audit.

## Upstream references checked 2026-09-05

- [TikFinity event API](https://tikfinity.zerody.one/tiktok/dapi): local Desktop event feed, WebSocket address and `event`/`data` envelope. The page references [TikTok-Live-Connector events](https://github.com/zerodytrash/TikTok-Live-Connector#events) for payload fields.
- [TikFinity Streamer.bot integration](https://tikfinity.zerody.one/streamerbot-integration): action parameters and separately configured chat reply relay.
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) and [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): renderer isolation, sandbox, sender validation and platform-dependent credential protection.
