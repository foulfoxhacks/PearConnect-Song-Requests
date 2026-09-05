# Regression ledger

## Invariants

- PC-001: Preserve TikTok LIVE -> TikFinity -> Streamer.bot -> PearConnect -> Pear Desktop. PearConnect is a local bridge, not an audio player.
- PC-002: Retain the four POST endpoints and their `user`/`query` JSON contract. Never add GET-driven queue mutations as a shortcut.
- PC-003: Keep the webhook bound to 127.0.0.1; never commit tokens, completed .env files, or user-specific Streamer.bot settings.
- PC-004: Preserve the existing smoke tests. Add deterministic tests for validation, authentication, concurrency, failure handling, and the documented Streamer.bot payloads.
- PC-005: A transport success must not be advertised as an accepted song. Dry-run tests must never mutate playback or quota state.
- PC-006: Test output must distinguish mocked/local contract checks from actual desktop imports and live-platform verification.
- PC-007: Build generated integration assets from reviewed source; keep source and generated output synchronized.
- PC-008: Simple and Advanced share one engine; only one TikTok input route accepts commands at a time. Mode changes pause intake and drain in-flight work without erasing counters.
- PC-009: Desktop and CLI share instance exclusion. Pausing requests never pauses playback. Only enqueue confirmation may be claimed after a successful write.
- PC-010: New configurations select Simple and start paused; missing mode in existing configurations preserves Advanced.

## Next-version foundation audit (2026-09-05)

Audited baseline: `0bb62c7`. Added shared engine lifecycle, repairable disconnected setup, shared command parsing and permissions, cross-input capacity, intake cancellation before enqueue, bounded request activity, sanitized diagnostics, instance exclusion, direct TikFinity WebSocket input and CLI controls. Preserved native webhook authentication, Origin/host guards, POST-only mutations and the unchanged Streamer.bot package. Local original smoke assertions and 67 Node regression tests pass. See `docs/NEXT-VERSION.md` for migration and the distinction between synthetic fixtures, real loopback tests and outstanding live acceptance.

## Integration hardening pass

Baseline: `0a82358bcae8011f23050191aaa41d88fc267ec3`.

Planned checks: baseline smoke suite; webhook HTTP methods, malformed input, secrets and errors; Pear Desktop request/response contracts and timeouts; queue race prevention and cooldown accounting; safe Streamer.bot integration assets; configuration and startup diagnostics; documentation consistency; Windows/Linux CI.

Status: implementation complete; automated verification recorded below. No live TikTok/Pear Desktop verification has been claimed.

## v0.2.0 implementation

Implemented typed configuration and inputs; fixed pre-search quota races; introduced bounded HTTP calls, explicit result codes, JSON errors, native-client loopback/Origin guards, and short-lived idempotency. Added non-mutating validation, full dry-run, safe setup and doctor commands, scoped YouTube skip identities, fixed-column duration parsing, bounded approximate request accounting, and five generated Streamer.bot actions with private local globals. Preserved the original smoke suite. Added Node and Windows C# contract checks, a four-target Node CI matrix, and an unsuppressed dependency audit. Updated package identity, supported Node baseline, template, documentation and migration details.

Local validation: original 12 smoke assertions plus 56 added Node tests passed; JavaScript syntax and generated import source checks passed. Cross-platform and Windows C# results are recorded below. Live desktop import/TikTok/Pear Desktop/audio acceptance has not been claimed.

## Windows exit regression follow-up

CI run `33979014131`: C# bridge 17/17 passed; Linux Node 22/24 and Windows Node 22 passed; audit reported zero vulnerabilities. Windows Node 24 hit a native libuv shutdown assertion after the original 12 smoke assertions passed, before the added suite ran. No test failure was ignored. The smoke runner now verifies the original file fingerprint and preserves its requested exit code while allowing network handles to drain naturally. Normal application shutdown also avoids an unnecessary forced successful exit. Full CI is rerun for this change. The upstream symptom is tracked in nodejs/node#56645 and actions/ai-inference#227.

## Automated verification record (2026-09-05)

Verified implementation commit: `ca90d94d3ee9ddc9f248de03e5dc47adddec8fc4`.
GitHub Actions run: [33979258651](https://github.com/foulfoxhacks/PearConnect-Song-Requests/actions/runs/33979258651).

- All four Node targets passed: Windows/Linux, Node 22/24. Each ran the original 12 smoke assertions, 56 added Node tests, syntax/package checks, and generated-import consistency.
- Windows .NET Framework 4.8 C# contract test passed 17 assertions plus exact HTTP payload and mutation-count checks against the Node bridge and a fake player.
- Clean-install dependency audit reported zero known vulnerabilities. The audit gate was not suppressed.
- Additional local process check passed: dry-run startup, Doctor health/readiness/test POSTs, and clean SIGTERM shutdown. No music or live chat account was used.
- Source files uploaded for the implementation were verified byte-identical to the locally tested Git tree.

The Windows shutdown failure from the previous run was fixed, not ignored. Native Streamer.bot desktop import, live TikTok/Twitch/YouTube connectivity, actual Pear Desktop behavior, and audible playback remain target-machine acceptance checks in `docs/TESTING.md`.
