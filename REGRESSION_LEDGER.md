# Regression ledger

## Invariants

- PC-001: Preserve TikTok LIVE -> TikFinity -> Streamer.bot -> PearConnect -> Pear Desktop. PearConnect is a local bridge, not an audio player.
- PC-002: Retain the four POST endpoints and their `user`/`query` JSON contract. Never add GET-driven queue mutations as a shortcut.
- PC-003: Keep the webhook bound to 127.0.0.1; never commit tokens, completed .env files, or user-specific Streamer.bot settings.
- PC-004: Preserve the existing smoke tests. Add deterministic tests for validation, authentication, concurrency, failure handling, and the documented Streamer.bot payloads.
- PC-005: A transport success must not be advertised as an accepted song. Dry-run tests must never mutate playback or quota state.
- PC-006: Test output must distinguish mocked/local contract checks from actual desktop imports and live-platform verification.
- PC-007: Build generated integration assets from reviewed source; keep source and generated output synchronized.

## Integration hardening pass

Baseline: `0a82358bcae8011f23050191aaa41d88fc267ec3`.

Planned checks: baseline smoke suite; webhook HTTP methods, malformed input, secrets and errors; Pear Desktop request/response contracts and timeouts; queue race prevention and cooldown accounting; safe Streamer.bot integration assets; configuration and startup diagnostics; documentation consistency; Windows/Linux CI.

Status: implementation in progress on `fix/pearconnect-integration-hardening`. No live TikTok/Pear Desktop verification has been claimed.

## v0.2.0 implementation

Implemented typed configuration and inputs; fixed pre-search quota races; introduced bounded HTTP calls, explicit result codes, JSON errors, native-client loopback/Origin guards, and short-lived idempotency. Added non-mutating validation, full dry-run, safe setup and doctor commands, scoped YouTube skip identities, fixed-column duration parsing, bounded approximate request accounting, and five generated Streamer.bot actions with private local globals. Preserved the original smoke suite. Added Node and Windows C# contract checks, a four-target Node CI matrix, and an unsuppressed dependency audit. Updated package identity, supported Node baseline, template, documentation and migration details.

Local validation: original 12 smoke assertions plus 56 added Node tests passed; JavaScript syntax and generated import source checks passed. Windows C# execution and cross-platform CI are required before merge. Live desktop import/TikTok/Pear Desktop/audio acceptance has not been claimed.
