# Beta.4: search duration and visible queue audit

## Findings

1. The live overview response for `Diamante - Hear Me Now` and `Bad Wolves - Hear Me Now feat. DIAMANTE` selected `PLXzNgd-Wgw` but provided play counts instead of duration. The Songs filter returned the same video at 220 seconds. The parser previously only accepted full-column timestamps and also combined the media-type label with the artist.
2. Pear Desktop returns HTTP 204 after dispatching an enqueue command internally. PearConnect treated that response as confirmation without reading the queue.
3. The desktop queue required a manual refresh and scanned nested renderers, including potential alternate entries. Website rejections used the ambiguous heading “Your request was checked.”

## Changes

Search fallback uses at most two filter parameters supplied by the current response, targeting Songs/Videos. It enriches only the originally selected video ID, never a similarly named recording. Missing length still fails the enabled limit. Search requests are serialized because the upstream player uses a shared search response channel.

The shared engine serializes queue snapshot/write/verification sequences, checks intake/session/rules immediately before writing, and confirms only an increased count of the same video ID. It retries reads for a bounded interval, never the write. An acknowledged but unconfirmed write retains the request window/cooldown and returns an uncertain outcome. External edits can still make verification inconclusive; this is not queue ownership tracking.

The desktop uses the same ordered queue parser and refreshes its queue view while visible. It displays snapshot positions and duration. The website separates rejection, queue confirmation and uncertainty, retaining the acknowledgment gate and receipt across reloads.

## Evidence and limits

- Reduced live search fixtures are in `test/fixtures/pear-search-*.json`; they contain no credentials, profile data, menus, image URLs or tracking parameters.
- Both live queries resolved to Bad Wolves, “Hear Me Now (feat. DIAMANTE)”, video `PLXzNgd-Wgw`, duration 220 seconds using the updated client.
- The running player's packaged application identifies itself as `youtube-music` version `3.11.0`.
- One explicitly authorized live write at 2026-09-05 22:53 UTC returned an API acknowledgement, but its reported queue stayed at 68 entries with no occurrence of the selected video. The updated engine returned `queue_unconfirmed`. No duplicate write, skip, clear or reorder was attempted.
- The official current player release was 3.12.0 at audit time. An update is a compatibility step; a successful real enqueue after that update remains untested.
- Local checks include Node regressions, HTTP 204/no-mutation and delayed-mutation tests, original smoke assertions, C# bridge contracts and the isolated Electron harness. Website browser checks exercise receipt persistence and uncertain-outcome retry gating.

## Smoke fixture migration

All 12 original assertions are preserved. Its fake player now records appended IDs and implements `GET /api/v1/queue` so the existing acceptance assertions have real queue evidence. The smoke wrapper fingerprint was updated for those five fixture lines; no assertion was weakened, removed or skipped. Earlier audit documents describe the unchanged fixture at their historical commits.
