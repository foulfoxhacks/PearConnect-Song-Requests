---
title: PearConnect Player
description: Try the separate PearConnect Player preview with verified queue additions, custom appearance, sandboxed web plugins and improved SponsorBlock controls.
---

# PearConnect Player

**PearConnect Player** is our independently modified edition of the 3.11.0 YouTube Music desktop player. It plays your music. **PearConnect Desktop** connects chat and session-code requests to that player and applies your request rules.

[Download PearConnect Player for Windows x64](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/player-v3.11.0-pearconnect.1/PearConnect-Player-3.11.0-pearconnect.1-win-x64.exe) · [Source, checksums and release notes](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/tag/player-v3.11.0-pearconnect.1)

::: info Separate, unsigned preview
The version is **3.11.0-pearconnect.1**. It retains the 3.11.0 player and bundled ad-blocker sources, with our queue and SponsorBlock changes, and packages Electron 44.2.0. It is not an official upstream release and does not overwrite your existing player's profile. Advertising filters still depend on changes to YouTube.
:::

## Connect it to your stream

1. Close the other YouTube Music or Pear Desktop player to release API port **26538**.
2. Open the downloaded PearConnect Player executable. It includes its runtime.
3. Sign in normally if you want your library. Existing account credentials are not copied.
4. In **PearConnect Desktop → Connections**, authorize the player again. The player API is enabled on localhost and requires approval.
5. Start a song to initialize Up next, then use the [guided connection test](./validation).

Only a verified queue addition is reported as successful. Requests go to the end of Up next. The player checks the exact video ID and waits for its queue entry instead of acknowledging an unverified insertion. An uncertain result is not automatically retried.

## Open Player Studio

Choose **PearConnect → Player Studio**, the **PearConnect Studio** button beside search, or **Ctrl+Shift+P**.

### Appearance and playback preview

Choose a colour palette, typography, queue spacing and a Pear, Orchid or Ember window icon. Import a PNG, JPEG or WebP background up to 8 MB. Appearance changes apply immediately; the portable executable's file icon remains Pear.

Studio shows the current artwork, title, artist, elapsed time, total length and remaining time. Playback stays in the player. These controls are separate from PearConnect Desktop's [stream overlay settings](./visual-studio).

### SponsorBlock

Select the categories to include, a minimum segment length, and automatic or manual skipping. Automatic mode shows **Undo** after a skip. Manual mode offers **Skip** while the segment plays. Undo returns to the previous position and lets the segment play for the remainder of that track.

Mode and category changes refresh the current track. Restart the player after enabling or disabling SponsorBlock. Community data is checked against the current recording; failed lookups and invalid timestamps leave playback unchanged. SponsorBlock and the advertisement blocker are separate plugins.

### Import web plugins

Use **Import .pearplugin** to select a single HTML/CSS/JavaScript package. A native review dialog lists its permissions and fingerprint before installation. Open it deliberately from the plugin library; closing or removing it stops the running widget.

The first API supports **read-only playback information and artwork**. Widgets run in separate sandboxed windows without the player's login session, network access, filesystem access or playback/queue controls. Unknown permissions are rejected. This does not make an arbitrary author's code trustworthy.

Choose **Save starter plugin** for a working now-playing widget. [Read the package format and developer API](https://github.com/foulfoxhacks/PearConnect-Song-Requests/blob/main/player/PLUGINS.md). Compiled upstream plugins, Node packages and ZIP archives cannot be imported through this interface.

## What has been checked

The isolated acceptance test uses a fresh, muted player profile and the real YouTube Music page. It checks visible queue insertion through PearConnect, appearance and image import, plugin permission review and isolation, and SponsorBlock manual/automatic skipping and Undo with recorded segment fixtures. The original no-op in the streamer's signed-in queue was not reproduced in that fresh profile, so testing your own session remains useful. No Spotify, Last.fm or YouTube Data API key is required for this queue path.
