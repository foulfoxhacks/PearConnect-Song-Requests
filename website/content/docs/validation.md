---
title: Guided connection test
description: Verify your Pear Desktop player, a real TikFinity request command and song rules step by step before enabling live song requests.
---

# Guided connection test

Open **PearConnect Desktop → Setup guide → Start guided test**. The test pauses new requests while your existing music keeps playing. Choose Simple or Advanced before starting.

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
3. Choose **Commenting a command** and enter `!sr`, or your configured command.
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

## Commands still aren’t reaching the app?

Use the optional [session-code fallback](/docs/session-codes). It supplies a temporary website request form while you troubleshoot. It pauses TikTok command intake to avoid overlapping request routes.
