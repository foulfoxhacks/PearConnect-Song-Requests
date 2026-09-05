---
title: Rules & permissions
description: Configure cooldowns, song duration, blocklists, request permissions and authorized skipping.
---

# Rules & permissions

Open **Request rules** in the desktop app. Changes apply immediately across the shared engine, including every enabled chat input. Existing request counters are retained.

## Request limits

| Setting | Default | Effect |
| --- | --- | --- |
| Cooldown | 60 seconds | Minimum time between accepted requests from one platform/user identity. |
| Maximum song length | 420 seconds | Rejects songs longer than seven minutes. |
| Tracked requests per viewer | 2 | Limits requests within an approximate duration window. |

Set a limit to **0** to disable it.

::: info The tracked-request count is an approximation
PearConnect does not yet reconcile exact viewer ownership with Pear Desktop's queue. The per-user limit uses a duration-based window. It is not a reliable count of a viewer's pending songs.
:::

When the duration limit is enabled, a song with an unavailable or unparseable duration is rejected. Disabling the limit allows those unknown lengths too.

## Blocked phrases

Enter comma-separated phrases under **Blocked phrases**. Matching applies to request text, the resolved song title and artist. Use short, deliberate phrases and test the results for your community.

## Who can request

Leave **Who can request** empty to allow everyone. Otherwise, list the identities you want to allow, separated by commas:

```text
tiktok:your_handle,twitch:your_login,youtube:UC_EXACT_CHANNEL_ID
```

Use TikTok handles and Twitch logins, not display names. YouTube uses an exact channel ID. An allowlist restricts identities; it does not automatically grant subscriber, follower or moderator-role access.

## Who can skip

**Who can skip** uses the same identity format. An empty skip list permits **nobody**. This is deliberately different from the request allowlist's empty behavior.

## Pause and resume

Select **Pause requests** in the top bar to stop new song requests. Music already in Pear Desktop continues. Select **Enable requests** to accept them again.

Switching connection modes or saving/reconnecting connections pauses intake. Enable it again only when your connections are ready.

## CLI setting names

| Desktop field | `.env` key |
| --- | --- |
| Song request command | `CMD_REQUEST` |
| Now playing command | `CMD_NOWPLAYING` |
| Next track command | `CMD_QUEUE` |
| Skip track command | `CMD_SKIP` |
| Cooldown | `COOLDOWN_SECONDS` |
| Maximum song length | `MAX_SONG_SECONDS` |
| Tracked requests per viewer | `MAX_PER_USER` |
| Blocked phrases | `BLOCKLIST` |
| Who can request | `REQUEST_ALLOWLIST` |
| Who can skip | `SKIP_ALLOWLIST` |

For an ordinary `.env` edit, restart the CLI to load it. Desktop rule changes apply through the running engine immediately.
