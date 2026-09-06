# Validation — 3.11.0-pearconnect.1

Validated on Windows x64, September 5, 2026 (latest packaged run: `2026-09-06T00:51:01Z`), with Electron 44.2.0.

| Check | Result |
| --- | --- |
| Queue and Studio/SponsorBlock regression suite | 18 passing |
| Upstream TypeScript project with modifications | Pass |
| Main, preload and renderer compilation | Pass |
| Windows x64 portable packaging | Pass; unsigned |
| Clean source preparation | All 436 prepared files match the build source |
| Real YouTube Music + authenticated API + PearConnect engine | Exact requested recording appended; queue count 1 → 2; original selected track preserved |
| Metadata preview | Validates exact ID without a queue mutation |
| Unauthenticated API / malformed video ID | HTTP 401 / HTTP 400 |
| Packaged ASAR and bundled dependencies | Same acceptance checks pass with Electron 44.2.0 |
| Plugin import review | Native permission/fingerprint review; cancellation leaves library unchanged |
| Imported widget access probes | Node/process/IPC/Studio globals absent; local file, loopback network and Studio fetches blocked; popups and inline scripts blocked |
| Permission enforcement and revocation | No-permission widget cannot read playback; close/remove terminates the widget |
| Customization | Palette applies to live player; background import/removal works; settings survive Studio reload |
| SponsorBlock | Manual Skip, automatic skip and Undo pass against the real player with deterministic segment fixtures |
| Layout | Desktop and narrow desktop views inspected; no horizontal overflow at 760-pixel window width |

The acceptance script creates a new muted test profile and uses port 27639. The queue test requests the 220-second recording `PLXzNgd-Wgw`; the selected seed is a different recording. SponsorBlock fixtures seek only inside this isolated profile. No credentials or private player profile are copied.

The earlier signed-in-session queue no-op was not reproduced in a clean profile, including with the original upstream handler. The modifications remove stale queue-context forwarding and silent-success responses; they do not establish the exact cause of that previous session's failure.

Packaged acceptance imports the shipped ASAR under the same Electron version; it is not a fresh-machine installer or authenticated Google-login test. No claim is made that every upstream integration works, every imported plugin is trustworthy, or YouTube advertising filters will remain effective. The executable is a separate prerelease, not an automatic replacement of either installed application.
