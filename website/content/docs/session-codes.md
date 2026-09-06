---
title: Session-code fallback
description: Create an expiring website song-request code in PearConnect Desktop, pair a private dashboard and keep requests under the desktop engine's rules.
---

# Session-code fallback

Session codes offer a temporary website request form when TikTok commands are not reaching PearConnect. Try the [guided connection test](/docs/validation) first. This feature requires the desktop release that includes **Session-code fallback** in its navigation.

## Create and share a code

1. Connect and authorize Pear Desktop.
2. Open **Session-code fallback** in PearConnect Desktop.
3. Choose a lifetime from **15 to 1440 minutes** (24 hours). The default is four hours.
4. Select **Create fallback code**. Requests start paused.
5. Select **Enable website requests**, then **Copy viewer link**.

Viewers can also visit [the request page](/sessioncode) and enter your eight-character code. They enter a display name and an artist and song, then wait for the result. A request receipt survives a page refresh in the same browser tab without resending the song.

::: warning One TikTok request route
While the session exists, both Simple and Advanced TikTok command intake are suspended. Twitch and YouTube remain independent. End the session to return to chat, then enable requests again in Desktop. Pausing requests never pauses existing music.
:::

## Pair the web dashboard

In Desktop, select **Open & pair web dashboard**. It opens [the dashboard](/web/dashboard) using a private, one-use link that expires after two minutes. The pairing value is removed from the browser URL before the dashboard contacts the service.

The browser receives a secure, HttpOnly, SameSite cookie. The public viewer code cannot manage the session. Pairing a new browser replaces the old pairing. Use **Disconnect paired browser** in Desktop, or **Disconnect this browser** on the dashboard, to revoke it.

You can update the current session’s expiration, enable or pause website intake, view recent website results, or end the session from the paired dashboard. It cannot read your player token, launch programs, change local files, skip songs or relax your rules.

## Change expiration or end a session

**Update expiration** sets a new deadline measured from now. Desktop saves your chosen duration as the default for the next code; the browser changes only the active session.

Expired and ended sessions cannot be revived. Create a new code in Desktop. Closing Desktop ends its session when connected. After a crash or network loss, the service stops accepting work when the desktop heartbeat becomes stale (within 20 seconds); the code still expires at its configured deadline. Reopening Desktop requires a new session.

## Rules and identities

Website requests use the same queue manager for blocked phrases, song duration, cooldown and approximate per-user limits. They cannot request skips or player controls.

Website display names are **unverified**. A restricted request allowlist disables website intake. Typing an allowed TikTok handle does not grant permission.

Website cooldowns and per-user limits use a private, session-specific identifier derived from the network address. Viewers sharing a connection share those limits; a display-name change does not reset them. Website identities cannot be reliably reconciled with TikTok, Twitch or YouTube identities. Changing network or creating a new session can create a new website identity.

Additional attempt limits protect the public form. Request history is not proof of queue ownership, and this feature does not add remove/reorder controls.

## Understand the result

| Result | Meaning |
| --- | --- |
| Received | Stored briefly for Desktop to collect; not yet accepted by the player. |
| Checking | Desktop claimed it and is checking the song. |
| Enqueue confirmed | Desktop verified a new entry for the selected recording in the player queue. Its position is a snapshot, not a promise that playback has started. |
| Queue not verified | An older Desktop version acknowledged the command without checking Up next. Ask the streamer to inspect the queue and update to beta.4 or later. |
| Rejected | A rule or connection check prevented the request. Read the explanation. |
| Outcome uncertain | Processing may have started, but Desktop could not confirm the queue changed. Ask the streamer to check the player before sending another request. |

New songs are appended to the existing queue. The streamer can inspect **Requests & queue** in Desktop or scroll to the end of **Up next** in the player. For an unexpected result, follow [missing queue entries](./troubleshooting#accepted-command-but-no-song-in-the-queue).

The relay never automatically redelivers a claimed request. Before a player write, Desktop checks that the session still allows it. A pause or expiration cannot undo an enqueue that has already begun. Requests that cannot be collected in time expire rather than waiting for a later stream.

## Privacy and availability

The Cloudflare relay receives only submitted display names, song queries and their results, plus a network address used to derive a private session identifier. Raw addresses are not stored in the session database. Request records are removed after 15 minutes; expired session credentials and state are removed within 15 minutes of the deadline. Cloudflare’s underlying service backups may retain historical storage longer.

Pear Desktop credentials stay on the streamer’s computer. Desktop retains its normal local, session-only activity history. The website session is optional: ordinary chat commands remain local and do not use this service.
