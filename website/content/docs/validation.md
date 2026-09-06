---
title: Guided connection test
description: Verify your Pear Desktop player, a real TikFinity request command and song rules step by step before enabling live song requests.
---

# Guided connection test

Open **PearConnect Desktop → Setup guide → Start guided test**. The test pauses new requests while your existing music keeps playing. Choose Simple or Advanced before starting.

## Before you start

Keep both apps open: **PearConnect Player** plays music, while **PearConnect Desktop** receives requests. Close another player using API port **26538**. Start a song in Player to initialize **Up next** before the eventual enqueue rehearsal.

Check **Request rules → Song request** before copying examples. A saved name of `play` means `!play Artist Title`; the default `!sr` will not match. The guided marker automatically uses your saved name.

TikFinity must show a connection to an actual LIVE. Its local WebSocket can be open while the channel is offline. Installing both apps, receiving a non-chat event, or pressing a follow/gift simulator button does not prove song commands are arriving.

## 1. Verify the player

Open Pear Desktop and enable its API Server plugin. Select **Authorize PearConnect**, approve the request in Pear Desktop, then **Check player connection**. Continue when the player responds. A dry run cannot pass this real-player check.

## 2. Verify a live command

Copy the unique `!sr pearcheck-…` command displayed by the guide and post it in your actual TikTok LIVE chat. Use your configured command if you renamed `sr`.

PearConnect intercepts this test marker before searching or queuing a song. It only marks the checkpoint passed when the exact marker arrives through the selected input route. The marker expires after five minutes. Old markers are never treated as songs.

### Simple connection

Keep TikFinity Desktop on the same computer and connected to your livestream. **Connections → Local event WebSocket** normally uses `ws://127.0.0.1:21213/`. No TikFinity action or OBS overlay is required for Simple mode.

“Connected” means the socket opened. “Live test command received” proves that your request command reached PearConnect.

### Advanced connection

Follow the [Advanced guide](/docs/advanced) to import and configure Streamer.bot first. In TikFinity:

1. Create an action with **Streamer.bot Action**, choosing **PearConnect - Song Request**.
2. Create an event and select who may trigger it. Include the viewer you will use for testing.
3. Choose **Commenting a command** and enter the configured command, such as `!play` if your saved request name is `play`.
4. Select your action under **Trigger all of these actions**, then save.
5. Post the guide’s exact test command in live chat and wait for the checkpoint to pass.

TikFinity’s overlay warning concerns visual actions. PearConnect song requests do not require an OBS overlay. The **Trigger WebHook** option is not interchangeable with the supplied authenticated Streamer.bot action.

The local **Test integration** button proves only that the local endpoint and secret work. The imported **Connection Test** action checks delivery from Streamer.bot. Neither proves that a TikFinity chat-command event is mapped correctly; the live marker does.

## 3. Check a song and your rules

Enter an allowed viewer handle and an artist and song. The guide performs a real, read-only player search and checks permission, blocked phrases and song duration. It does not enqueue a track or consume request slots or cooldowns.

An unknown duration fails while the maximum-duration rule is enabled. Fix a rejection in [Request rules](/docs/rules), then run the sample again. Changing rules invalidates the previous sample result.

## 4. Enable requests deliberately

After all three checks pass, select **Finish test & enable requests**. Ask a viewer to send a normal song request, then look for **Enqueue confirmed** in Activity. A received command is not a successful enqueue, and an enqueue confirmation does not mean the track is already playing.

The guide does not claim to test actual enqueue playback, skipping or delivery of TikTok chat replies. Test those deliberately during your own stream rehearsal.

## Record the result of each check

| Check | Evidence to look for |
| --- | --- |
| Desktop can reach Player | **Passed · Pear Desktop responded**; an idle player may pass this read-only check. |
| TikFinity delivered the command | The exact current marker is received through the selected route. |
| Search and rules | The guided song check reports a match and passes the configured rules without enqueueing. |
| A real request entered the queue | One new entry for the selected recording, an **Enqueue confirmed** result, and an observed queue position. |
| Playback | That entry becomes the current track when the player reaches it. |

When offline, complete the player connection check and review the configured command names. Leave the live-delivery checkpoint pending. Restart the guided test for a fresh marker when LIVE is available; each marker expires after five minutes. Do not treat a local or simulated event as proof of TikTok delivery.

If **Maximum song length** is zero, duration checking is disabled. A successful request then does not validate a duration limit. A blank **Who can skip** field disables skipping, and a blank **Who can request** field allows everyone. Inspect those settings before deciding that a rejection is a fault.

## Commands still aren’t reaching the app?

Use the optional [session-code fallback](/docs/session-codes). It supplies a temporary website request form while you troubleshoot. It pauses TikTok command intake to avoid overlapping request routes.
