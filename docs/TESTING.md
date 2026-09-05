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

## Desktop and Simple preview checks

The preview adds tests for engine lifecycle, atomic mode switching, same-engine rules and permissions, global processing capacity, command parsing, instance exclusion, encrypted-settings handling and sanitized diagnostics. A real loopback WebSocket exercises malformed events, Unicode, string identities, duplicate IDs and reconnect behavior. Its fixture is synthetic and matches the documented event envelope; it is not a recording from a real TikTok stream.

On Windows, run:

```sh
node node_modules/electron/install.js
npm run test:desktop
npm run package:win
```

The hidden real Electron harness verifies renderer sandbox/context isolation, absence of Node/raw IPC, sender checks, invalid privileged operations, actual OS-encrypted persistence, rules form submission, request validation, all-page layout overflow and safe rendering of injected markup. It also authorizes through real local HTTP against a fake player without leaking the returned token to the renderer, tests pause/resume without playback writes, and starts a separate CLI to verify cross-interface instance exclusion. The Windows CI job runs this harness and publishes a portable preview artifact only after packaging and archive checks succeed.

The desktop redesign extends this harness with command-pattern rejection/acceptance, keyboard skip navigation without changing the trusted document URL, persistent intake controls across navigation, preservation of unfinished form edits during status refreshes, and queue reads/rendering without player writes. All six pages are captured after painted frames at 1240- and 860-pixel window widths; a separate startup capture exercises the empty state. Console errors fail the harness. Screenshots in `dist/desktop-test/run-*/` use synthetic fixtures and are not evidence of live song enqueue or playback.

Local source checks at the final preview audit: 73 Node tests, original 12 smoke assertions, 17 C# bridge assertions plus payload/mutation-count checks, the Electron harness, Windows packaging and zero known npm audit vulnerabilities. Final CI results are reported separately from these local checks.

The [desktop acceptance checklist](DESKTOP.md#release-acceptance-still-required) adds fresh-machine onboarding, live event capture, authorization against the real player and streaming-workload measurements. Preview success does not mark those checks complete.

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

## Recorded automated result: 2026-09-05

Implementation commit `ca90d94d3ee9ddc9f248de03e5dc47adddec8fc4` passed [GitHub Actions run 33979258651](https://github.com/foulfoxhacks/PearConnect-Song-Requests/actions/runs/33979258651): all four Windows/Linux and Node 22/24 jobs, the Windows C# contract job, and the dependency audit. Each Node target passed the original 12 smoke assertions and 56 added tests. The C# harness passed 17 assertions and verified exact local POST payloads, four enqueues, and one authorized skip against its fake player. The clean-install audit found zero known vulnerabilities at that time.

The original smoke file is fingerprint-checked and unchanged. Its wrapper preserves its requested success/failure code but lets network handles drain, avoiding the Windows Node 24 forced-exit assertion observed in the first CI pass. No failing assertion was removed, skipped, or converted to a warning.

A separate local real-process check also verified dry-run startup, all Doctor requests, and clean SIGTERM shutdown. These results do not mark the live acceptance checklist complete.
