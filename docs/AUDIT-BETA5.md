# PearConnect 0.3.0-beta.5 validation

This update adds output-only WebSocket overlays, an upcoming-player-queue view, a portrait layout, a configured-social-handles ticker and local Discord Rich Presence. The shared request engine and its moderation remain the command authority.

## Implementation review

- Queue snapshots exclude played/current entries and preserve duplicates. Unknown or ambiguous current positions produce a waiting state. Requester ownership is not guessed.
- Queue reads are coalesced independently of playback polling. Late responses from a changed track/engine are discarded; stale results expire.
- Overlay access stays local and credential protected. Browser origins and hostnames are checked, connections/payloads/send buffers are bounded, clients cannot submit commands, and credential rotation disconnects current sockets.
- The social source shares the local server and access key, with a separate URL and a payload limited to social settings. Only configured handles are rendered. SVGs are bundled; there is no arbitrary icon upload, account login, chat scrape or remote icon service.
- Discord uses public application ID `1545979656262389900` over local IPC. There is no embedded client secret, OAuth token exchange, bot login or message access. Song sharing is off by default. Manual live labels are session-only. Updates wait for acknowledgements, are rate limited, reconnect, and clear on disable/exit.
- Connection imports preserve the visual workspace and Discord sharing preferences. Renderer operations are still named, validated and restricted to the isolated main frame.

## Evidence

- Node regression suite and the original 12 smoke assertions pass.
- Real local HTTP/WebSocket tests cover queue order, duplicate ambiguity, wrong origins, write attempts, rotation, sanitized state and slow queue responses.
- An isolated Electron acceptance run covers encrypted settings, IPC isolation, form persistence, preview-only edits, sharing preferences and GUI/CLI instance exclusion.
- Isolated Chrome verifies four widget layouts at their suggested dimensions, WebSocket reconnect, queue updates, artwork, pause/seek timing, text injection, reduced motion, three social icon styles, rotation, portrait fit and disable.
- The installed Discord desktop client returned a successful SET_ACTIVITY acknowledgement using the bundled application ID; the test cleared its temporary presence afterward.
- A read-only live-player test displayed **Happy — Letdown.** through the new overlay WebSocket, with one browser source connected. The player reported no upcoming songs. No player write was sent.
- Runtime dependency audit reported zero vulnerabilities. Website validation covers generated metadata, release version, crawler policy, sitemap, local search and internal links/assets.

## Release limits

The Windows build remains an unsigned preview. Automated fixtures do not prove a new live TikTok request traversed chat to audible playback, and the last user-posted command was not fully verified before computer control was stopped. Rehearse one real request using the installed build before relying on it during a broadcast.

TikTok secondary-account OAuth and another unofficial chat listener are not included. They are unnecessary for the local overlay; Simple uses the existing TikFinity feed. The supplied Discord Social SDK archive contains native libraries and headers but no C# project/source; it was inspected, not executed or bundled. Existing local RPC supplies the requested presence feature without a new runtime.

See the [stream setup instructions](https://pearconnect.mellozone.site/docs/visual-studio) and [guided validation](https://pearconnect.mellozone.site/docs/validation).
