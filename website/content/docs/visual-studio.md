---
title: Visual studio & overlays
description: Style PearConnect's live artwork and playback clock, preview a live queue overlay for TikTok Studio or OBS, choose desktop backgrounds and icons, and enable optional Last.fm discovery.
---

# Visual studio & overlays

PearConnect Desktop includes **Visual studio**: a live now-playing preview and a set of appearance controls for your app and stream.

## Artwork and playback timing

Connect Pear Desktop and play a song. PearConnect reads its current track every two seconds, including artwork, elapsed time, total duration and pause state. It fetches artwork when its URL changes, keeps one processed image in memory and falls back to an original placeholder if the image cannot load.

The clock follows the player, including seeks and pauses. Missing timing displays as unavailable. Progress only advances briefly between fresh updates; a disconnected or stale player does not keep pretending to play. Playback position is time within the current track, not a lifetime listening counter.

## Design and preview a widget

Open **Visual studio** and choose:

- **Cover**, **Compact**, **Minimal** or **Vertical** layout. Vertical is designed for portrait livestreams.
- Dark, light or transparent surface, a custom accent, and one of three font styles.
- Your own short heading, artwork visibility and elapsed/remaining timing.
- An upcoming queue with one to five songs, or now playing only.
- Ambient bars or no motion. Ambient bars follow play/pause; they are not an audio-frequency visualizer and do not capture your microphone or system audio.

Edits update the preview immediately. Select **Save widget & overlay settings** to apply them to OBS. **Preview with sample track** only affects this app preview; sample data is never sent to the stream overlay. Reduced-motion preferences stop ambient animation.

## Add it to TikTok LIVE Studio or OBS

1. Choose **Stream overlay → Enabled on this computer** and save.
2. Select **Copy overlay browser-source URL**.
3. In TikTok LIVE Studio on this computer, add a **Link** source and paste the URL. Turn **Custom resolution on** and enter the width and height shown above PearConnect’s widget preview. Keep **Turn on sound off** and **Always keep active on**, then apply.
4. In OBS, use a **Browser** source with the same URL and dimensions.
5. Position and scale the source in your scene. Recheck the source dimensions after changing the layout or number of queue rows.
6. Keep PearConnect open. The overlay status reports how many browser sources have a live WebSocket connection.

A source can look tiny in the top corner when the streaming app gives a compact widget a full-screen browser canvas. Set the source’s custom resolution before resizing it in the scene. With three queue rows, use **760 × 578** for Cover or **400 × 498** for Vertical. For now playing only, Cover uses **760 × 320**. PearConnect shows the dimensions for your current selection; longer text is limited to two lines.

The private localhost server normally uses port **8787**. It pushes current playback and queue snapshots over a read-only WebSocket, checks the player every two seconds and reconnects with bounded delays. If the WebSocket is unavailable, the browser source falls back to HTTP reads. Stale or disconnected data is cleared. Stream sound stays in the player, not in this source.

The URL contains a private read-only credential. It cannot change playback, queue requests or read your player token. **Reset private overlay link** disconnects existing sources and revokes the old URL; paste the replacement into your streaming app. Turn the overlay off to stop serving it. The enabled setting and encrypted credential persist across app launches.

### What Up next means

Upcoming songs follow the **player’s queue**, including songs added outside PearConnect. Played entries and the current track are excluded. Duplicate songs retain their actual order. If the player’s current position is missing or ambiguous, the overlay displays a waiting message rather than guessing. It does not label songs with inferred viewer ownership or count approximate request limits as pending songs.

No queue, artwork or playback data is uploaded to the PearConnect website by this overlay. It works on the streaming computer, with either Simple or Advanced command input.

## Social handles ticker

Add the public handles you want to share in **Visual studio → Social ticker**. TikTok, Twitch, Discord, YouTube, Instagram, Kick and a website are included. Leave unused destinations blank. Discord can contain a public community invite, such as discord.gg/your-community. These are display labels, not account credentials or login connections.

Choose **Platform colors**, **Monochrome** or **Outline badges**, a transparent/dark/light surface, a heading, and a rotation interval of **3–30 seconds**. The seven SVG icons are bundled with the app and load without an external icon service. The platform marks identify your destinations; PearConnect is independent of those platforms.

Enable and **Save social ticker**, then **Copy social ticker URL**. Add a separate Link source in TikTok Studio or Browser source in OBS, using **600 × 120** (or **400 × 120** for portrait). Keep source sound off. Enabling the ticker also enables the shared local overlay server. The ticker can display your handles even when no music is playing.

The sample preview stays inside PearConnect. Saved handles are public-facing text, so enter only information you want viewers to see. Disabling the ticker hides it; losing the server connection hides stale output after ten seconds. The ticker does not read chatters, follower lists or Discord members. Its separate source shares the music overlay’s private access key; resetting the key revokes both sources.

## Discord Rich Presence

In **Visual studio → Discord Rich Presence**, choose automatic connection or turn presence off. PearConnect connects to the Discord desktop account already running on that computer, and retries if Discord starts later. The app includes the public application ID **1545979656262389900**. No client secret, user token or bot login is needed for local Rich Presence.

The default presence shares stream setup and request-intake status. **Share current song and artist** is optional and off by default. It never includes viewer names, request text, session codes, private overlay URLs or account credentials.

Use **Mark stream live on Discord** after starting your broadcast, and **End live label on Discord** when finished. This label is for the current app session and does not start or stop TikTok LIVE Studio. An open TikFinity socket alone is not proof of an active broadcast. Presence updates are limited to one every 15 seconds and cleared when you turn the feature off or close PearConnect.

“Discord accepted your presence” verifies the local RPC acknowledgement. Its visibility still depends on Discord’s activity-sharing settings and the application name configured in your Discord Developer Portal. Name that application **PearConnect Desktop** if that is the profile label you want. The app cannot override another user’s Discord privacy settings.

See Discord’s [local RPC documentation](https://docs.discord.com/developers/topics/rpc) and [Rich Presence guide](https://docs.discord.com/developers/discord-social-sdk/development-guides/setting-rich-presence).

## TikTok input and a second account

The overlay reads PearConnect Player. It does not need its own TikTok account or a second chat listener. Keep TikFinity connected to the streamer’s LIVE and use PearConnect’s [Simple connection](./simple). Request and skip permissions remain in **Request rules**. A helper’s TikTok moderator status does not automatically grant PearConnect skipping rights; explicitly allow the appropriate stable username.

TikTok [Login Kit scopes](https://developers.tiktok.com/docs/en/scopes-overview) authorize specific approved resources. We have not verified a public Login Kit scope that grants general LIVE chat monitoring or command execution. This build therefore does not offer a misleading secondary-account login. The [unofficial TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector) receives LIVE events but is not an official OAuth permission grant; it is not bundled as an additional route in this release. Simple continues to use TikFinity’s local event WebSocket, with the same moderation and deduplication checks.

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
4. Try all four layouts and your longest track title in the preview.
5. Add the private source to TikTok Studio or OBS; confirm sample-preview data never appears there.
6. Disconnect the player or close PearConnect; the widget should stop reporting active playback.
7. Disable motion if you prefer a quiet scene or use reduced-motion settings.

8. Confirm upcoming songs match the player after a manual queue edit. If there are no upcoming songs, the overlay should show the empty state.
9. Restart the overlay server and verify the browser source reconnects. Reset the private link and verify the old source stops receiving updates.
10. With Discord open, verify its accepted-presence status, mark/end the live label, and turn presence off to confirm it clears.
