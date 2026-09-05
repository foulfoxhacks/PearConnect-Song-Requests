---
title: Visual studio & overlays
description: Style PearConnect's live artwork and playback clock, preview a customizable OBS widget, choose desktop backgrounds and icons, and enable optional Last.fm discovery.
---

# Visual studio & overlays

PearConnect Desktop includes **Visual studio**: a live now-playing preview and a set of appearance controls for your app and stream.

## Artwork and playback timing

Connect Pear Desktop and play a song. PearConnect reads its current track every two seconds, including artwork, elapsed time, total duration and pause state. It fetches artwork when its URL changes, keeps one processed image in memory and falls back to an original placeholder if the image cannot load.

The clock follows the player, including seeks and pauses. Missing timing displays as unavailable. Progress only advances briefly between fresh updates; a disconnected or stale player does not keep pretending to play. Playback position is time within the current track, not a lifetime listening counter.

## Design and preview a widget

Open **Visual studio** and choose:

- **Cover**, **Compact** or **Minimal** layout.
- Dark, light or transparent surface, a custom accent, and one of three font styles.
- Your own short heading, artwork visibility and elapsed/remaining timing.
- Ambient bars or no motion. Ambient bars follow play/pause; they are not an audio-frequency visualizer and do not capture your microphone or system audio.

Edits update the preview immediately. Select **Save widget & overlay settings** to apply them to OBS. **Preview with sample track** only affects this app preview; sample data is never sent to the stream overlay. Reduced-motion preferences stop ambient animation.

## Add it to OBS

1. Choose **OBS widget → Enabled on this computer** and save.
2. Select **Copy OBS browser-source URL**.
3. In OBS on the same computer, add a **Browser** source and paste the URL.
4. Start with **760 × 260**. Adjust the dimensions for long titles or your scene, then scale the source in OBS.
5. Keep PearConnect open. Play a track, pause and seek in Pear Desktop, and confirm the widget follows it.

The widget uses a separate read-only localhost server, normally port **8787**. If that port is occupied, change it in Visual studio. The existing automation webhook retains its protections.

The URL contains a private read-only credential. It cannot change playback, queue requests or access your player token. **Reset private overlay link** revokes the old URL; update OBS with the new one. The enabled setting and encrypted credential persist across app launches. Turn the widget off to stop serving it.

This is a Browser source on your streaming computer, not a public hosted overlay. No artwork or playback data is uploaded to the PearConnect website by this feature.

## Desktop backgrounds, fonts and icons

Choose Aurora, Ink, Dusk or Grid backgrounds, Studio sans, Humanist or Monospace text, and standard or comfortable sizing. Save to apply immediately without reconnecting or changing your request rules.

Pear, Orchid and Ember are original icon presets. The window and in-app mark follow your selection. The Windows executable has a packaged Pear icon; pinned shortcuts may retain Windows' cached executable icon.

## Optional Last.fm discovery

Create your own key through [Last.fm API account setup](https://www.last.fm/api/account/create), enter it in Visual studio, enable enrichment and save. The key is encrypted with the operating system and never included in the overlay, renderer snapshots or diagnostic reports. Leave the field blank when saving to keep an existing key; **Remove key** deletes it.

When enabled, the app sends the current artist and title to Last.fm. It displays genre tags, aggregate Last.fm listener/scrobble counts and a link to the matched catalogue page. **Discover similar tracks** reads suggestions; it does not add them to your queue or change playback. Matches may be missing or imperfect, and those counts describe Last.fm's audience, not your stream.

This integration does not scrobble, access a listener account, retrieve lyrics, or connect Spotify. Last.fm metadata stays in the desktop UI and is excluded from the OBS output. Artwork comes from Pear Desktop, because Last.fm's API terms exclude artwork from the granted license. Review [Last.fm's API terms](https://www.last.fm/api/tos) for your intended use; commercial use requires their agreement.

## Quick visual acceptance check

1. Confirm the title, artwork and clock match Pear Desktop.
2. Pause and seek in the player; verify the clock follows.
3. Change songs and confirm the old cover is replaced.
4. Try all three layouts and your longest track title in the preview.
5. Add the private source to OBS; confirm sample-preview data never appears there.
6. Disconnect the player or close PearConnect; the widget should stop reporting active playback.
7. Disable motion if you prefer a quiet scene or use reduced-motion settings.
