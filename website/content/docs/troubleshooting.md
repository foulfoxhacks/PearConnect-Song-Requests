---
title: Troubleshooting
description: Fix player authorization, missing TikFinity events, rejected requests and local integration errors.
---

# Troubleshooting

Start on **Overview**. Check the player, chat input and request intake separately. A connection problem and a paused intake are different conditions.

## Player will not connect

1. Open Pear Desktop and enable its API Server plugin.
2. Check **Player API address** in Connections. The default is `http://127.0.0.1:26538`.
3. Select **Authorize PearConnect** and approve the request in the player.
4. Select **Test player connection**.

If authorization expired, authorize again. Changing the player address clears the old credential. An idle player's empty current-track response can still be a successful connection.

If secure credential storage is unavailable, the desktop app stays open with a repair message. It does not save tokens as plaintext. Restore the OS credential facilities or use the separately configured CLI workflow.

## TikFinity is connected, but requests do not arrive

- Confirm TikFinity **Desktop** is running on the same computer and connected to the livestream.
- Confirm Simple is selected if you expect direct event input.
- Check the WebSocket address; the default is `ws://127.0.0.1:21213/`.
- Compare **Last event**, **Last chat message** and **Last command**.
- Check the command name under Request rules and confirm intake is enabled.

An event timestamp with no chat timestamp can mean only non-chat events have arrived. An open socket alone is not proof of a functioning command route.

## Requests are paused

Desktop launches, mode switches and reconnections pause requests deliberately. After testing the connections, select **Enable requests** in the top bar.

For the CLI, use `--accept-requests` or set `REQUESTS_ENABLED=true` after testing. New Simple setup files start paused.

## A request was rejected

| Result | Check |
| --- | --- |
| Cooldown | Wait for the viewer's cooldown to expire. |
| Duration unavailable | The enabled duration limit requires a known song length. |
| Song too long | Check Maximum song length. |
| Blocked | Review blocked phrases against the query, title and artist. |
| Forbidden | Check the appropriate request or skip allowlist and identity format. |
| Request limit | The viewer has reached the configured approximate tracking window. |

The activity message gives more context. A rejection is not necessarily a connection failure.

## Outcome uncertain

**Check Pear Desktop before retrying.** A request may have reached the player even if its response timed out or the connection failed.

PearConnect does not automatically retry player writes. Re-submitting a command or re-running a Streamer.bot action can create a new request.

## Accepted command, but no song in the queue

From beta.4, **Enqueue confirmed** requires a new occurrence of the selected video ID in a before/after queue check. The result includes its observed position. New requests go to the end of the existing queue; scroll down in the player's **Up next** list or open **PearConnect → Requests & queue**, which refreshes while visible. Positions are snapshots and can change with playback or manual edits.

**Outcome uncertain** can also mean the API accepted a command without changing the queue. This was reproduced with YouTube Music Desktop 3.11.0. A player connection indicator or HTTP 204 is not proof of an addition. Update to the [current official player release](https://github.com/pear-devs/pear-desktop/releases/latest), authorize it, then verify one request. A newer player is a compatibility step, not a guaranteed fix. Check the existing queue before submitting again.

## Search finds the song but cannot verify its length

Update PearConnect to beta.4 or later. The player's overview search can show play counts without song lengths; PearConnect now asks the Songs/Videos filters for the same video ID and parses their inline duration. Different recordings cannot supply each other's length. No Spotify, Last.fm or YouTube Data API key is needed for this lookup.

If neither response supplies a duration, the request remains rejected when a duration limit is enabled. A guided test can validate a more specific artist/song query without changing playback. Disabling the duration rule is not necessary to fix the supported response format.

## Advanced integration fails

- Use Advanced mode in PearConnect.
- Set Streamer.bot's `PearConnect.Url` to `http://127.0.0.1:7280`, without `/tikfinity`, or use your configured port.
- Match `PearConnect.Secret` to PearConnect's webhook secret.
- Compile the imported C# actions and verify TikFinity's Streamer.bot connection.
- Run PearConnect's **Test integration**, then the imported **Connection Test** action.

The five actions have distinct endpoints. Read `pearconnectOk` and `pearconnectCode`, not only the HTTP status. See [Advanced setup](./advanced).

## Another engine is already running

Close the other PearConnect desktop or CLI engine, then select **Connect**. Changing the HTTP port does not bypass the shared instance lock.

Opening a second desktop normally focuses the existing window. The app cannot yet attach its window to a running CLI engine.

## No TikTok chat replies

Simple receives events only. Its replies appear in PearConnect. Advanced needs the [separate chatbot relay](./advanced#optional-tiktok-replies). A successful song request does not prove a reply was delivered.

## Ask for help

Open **Activity & diagnostics → Preview report**, review it, then select **Export previewed report**. The export omits credentials, identities, song/request text, configuration URLs, local paths and raw logs.

[Open a GitHub issue](https://github.com/foulfoxhacks/PearConnect-Song-Requests/issues/new) with the app version, connection mode, observed result and relevant sanitized diagnostics. Don't paste tokens, an entire `.env`, or a private Streamer.bot argument dictionary.
