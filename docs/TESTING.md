# Testing and acceptance

## Repeatable checks

Run from the repository root:

```bash
npm ci
npm run check
npm test
npm run check:streamerbot
npm audit
```

On Windows with the .NET SDK and .NET Framework 4.8 targeting pack:

```bash
npm run test:streamerbot
```

The original 12-assertion smoke test is preserved byte-for-byte. The added Node suite covers configuration and payload validation; fixed-column duration parsing; bounded upstream calls and redirects; cooldown races; failed-write accounting; scoped skip permissions; real loopback HTTP routing, secrets, malformed bodies and response codes; idempotency; dry-run; process startup; setup preservation; and deterministic native import generation.

The C# test compiles all five generated variants and sends actual POSTs through the Node HTTP bridge. Its player is a test double. Its CPH implementation is a narrow test double for the documented host API. This verifies serialization, command-prefix handling, route selection, authentication, optional chat envelope shape, policy rejections, and preservation of successful requests when chat delivery fails. It is not a real TikFinity, Streamer.bot desktop, Twitch, YouTube, or Pear Desktop session.

The CI workflow runs the Node checks on Windows and Linux under Node 22 and 24, plus the C# bridge checks on Windows. No live account credentials are required or supplied. A checked-in .sb file must reproduce from source or the checks fail.

## Live acceptance checklist

Record application versions and sanitized outcomes. Do not capture tokens, complete .env content, or personal persisted globals in screenshots.

1. Back up Streamer.bot, preview the native import, confirm exactly five PearConnect actions and no unexpected server/trigger changes, then compile all five. Resolve required references using Find Refs when needed.
2. Connect TikFinity to the local Streamer.bot WebSocket server. Map only one `!sr` event to the Song Request action.
3. Start the bridge in dry-run mode. Submit a real TikTok command and confirm the handle, user ID, and query arrive correctly with an explicit dry-run result and no playback change.
4. Run Connection Test and Doctor. Distinguish payload validation from actual player readiness; dry-run readiness intentionally does not contact the player.
5. Stop dry-run, authorize Pear Desktop, start the live bridge, and confirm Doctor reports the player reachable.
6. Submit one short, clearly identified song. Confirm the expected entry appears in the player queue exactly once, then manually confirm playback/audio. A successful HTTP enqueue does not prove audible output.
7. Submit another request during cooldown and confirm rejection. Check a blocked phrase, a song longer than the limit, and a result with unavailable duration. Confirm none are added.
8. Test now playing, next-track information, unauthorized skip, and authorized skip. An authorized skip changes playback, so do this outside a sensitive live moment.
9. Enable optional TikTok replies and confirm one response per event. Check direct Twitch and YouTube adapters separately when those platforms are used; YouTube responses remain terminal-only.
10. Disconnect the player and confirm readiness/errors are clear. After any timeout inspect the queue before retrying. Restart and confirm local configuration has been preserved.

Only mark live acceptance complete after these checks have actually been performed on the target applications. Automated CI success alone is not that evidence.

## Audit interpretation

Functional tests and a vulnerability audit answer different questions. Preserve audit findings rather than suppressing them to make a check green. Dependencies and advisory data change; inspect the current `npm audit` output after installations or upgrades. Any transitive override must be documented and regression-tested, not forced across incompatible major versions.

The 2026-09-05 dependency refresh pins compatible transitive overrides `qs=6.16.0` and `body-parser=1.20.6`. The clean-install audit reported zero known vulnerabilities. These address the upstream advisories [qs](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) and [body-parser](https://github.com/advisories/GHSA-v422-hmwv-36x6). Remove the overrides only after parent dependencies resolve to patched versions and the regression suite still passes.
