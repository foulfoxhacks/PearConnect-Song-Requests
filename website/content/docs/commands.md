---
title: Commands
description: Song requests, now-playing information, next-track information and authorized skipping in PearConnect.
---

# Commands

These are the default command names. Change them under **Request rules → Chat commands**, or in your CLI configuration. Enter names without the leading `!`.

| Command | Example | What it does |
| --- | --- | --- |
| `!sr` | `!sr Björk Jóga` | Searches for a song and applies your request rules before enqueueing. |
| `!np` | `!np` | Reports the track Pear Desktop says is currently playing. |
| `!queue` | `!queue` | Reports next-track information, not a full viewer-owned queue. |
| `!skip` | `!skip` | Advances the player only for an allowed identity. |

## Song requests

Use an artist and song title for a useful search. PearConnect preserves quotes and Unicode in the query. An empty request returns usage guidance.

Requests can be rejected for permissions, cooldown, duration, blocklisted text or the tracked-request limit. A successful enqueue is recorded as **Enqueue confirmed**. It is not labeled **Playing** until the player reports playback.

## Where command results appear

| Input | Result destination |
| --- | --- |
| Simple TikTok connection | PearConnect activity or CLI output; no TikTok chat replies |
| Advanced TikTok connection | Action results, plus the optional configured chatbot relay |
| Twitch | Twitch chat and PearConnect activity |
| YouTube | PearConnect activity / terminal; no YouTube chat replies |

The **Player queue** section in the desktop app is a separate read-only snapshot fetched with **Refresh queue**.

## Skip permissions

Nobody can skip by default. Add allowed identities under **Who can skip**:

```text
tiktok:your_handle,twitch:your_login,youtube:UC_EXACT_CHANNEL_ID
```

Pausing requests stops new song requests. It leaves playback and separately authorized skip controls available.

## Custom command names

Use 1–32 letters, numbers, underscores or hyphens. Names must be unique. For example, set the song request name to `song` to recognize `!song Artist Title`.

Simple, Twitch and YouTube recognize the engine's configured names. In Advanced mode, also update TikFinity's command-event mappings and Streamer.bot's `PearConnect.RequestCommand` where applicable.

## Uncertain outcomes

If a player write fails after it was sent, PearConnect may not know whether it took effect. **Outcome uncertain** means check the player before retrying. No automatic retry is sent for a player mutation.
