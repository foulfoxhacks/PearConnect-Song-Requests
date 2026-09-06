---
title: Simple · TikFinity
description: Receive TikFinity chat events directly in PearConnect without setting up Streamer.bot actions.
---

# Simple · TikFinity

Simple is the recommended starting point for new users. PearConnect reads TikFinity's local event feed and recognizes your configured commands.

```text
TikTok LIVE → TikFinity Desktop → PearConnect → Pear Desktop
```

## Connect TikFinity

1. Keep TikFinity Desktop running on the **same computer** as PearConnect.
2. Connect TikFinity to your livestream.
3. In PearConnect **Connections**, select **Simple · TikFinity Connection**.
4. Check **Local event WebSocket** and use **Save & reconnect** if you changed it.

The default address is:

```text
ws://127.0.0.1:21213/
```

The address can be changed to another loopback endpoint. PearConnect does not accept a remote event server through this setting.

## Do I need TikFinity Actions & Events?

**No. Simple mode reads chat directly.** You do not need a Song Request action, a **Commenting a command** event, a **Trigger WebHook** action, Streamer.bot, or a TikFinity overlay for this route. Existing follow, gift and TTS actions can remain configured for their own jobs.

In **PearConnect Desktop → Request rules → Chat commands**, check the actual **Song request** name. The default is `sr`, but if you saved `play`, viewers must send:

```text
!play Bad Wolves Hear Me Now feat. DIAMANTE
```

Enter `play` without `!` in the setting. `!sr` is not an automatic alias. Keep `np`, `queue` and `skip`, or give each a distinct name. TikFinity's separate song-request feature is not required; avoid configuring another music handler for the same command.

For custom actions and events, use the [Advanced route](./advanced#connect-and-map-tikfinity) instead. Do not create an Advanced request mapping as a repair for a disconnected Simple feed.

## Verify that chat is arriving

Overview separates three signals:

- **Last event:** something arrived from the event feed.
- **Last chat message:** a chat event arrived.
- **Last command:** PearConnect recognized one of your commands.

**Connected · waiting** is different from **Chat arriving**. An open socket does not prove that TikFinity is receiving your stream's chat.

## Test and enable

Open **Setup guide → Start guided test** and follow the [four checkpoints](./validation). The guide pauses requests, checks the player, supplies an expiring test command using your saved command name, then checks a real song against your rules without adding it.

After the guided checks pass, enable requests and send **one** real song request. Look for **Enqueue confirmed**, then inspect the end of **Player → Up next** and **Desktop → Requests & queue**. Queue confirmation is separate from the track beginning playback.

The older **Validate sample request** control lives under **Setup reference & manual controls**. It checks the sample identity, query and basic permissions only; it does not search a song or verify duration. It cannot substitute for the guided song check.

## Where results appear

::: info TikTok chat replies are not configured
Reading TikFinity's event feed does not establish a chat-reply channel. Simple-mode results, including `!np` and `!queue`, appear in PearConnect's activity feed or CLI output. They are not sent back to TikTok chat.
:::

## Reconnection and duplicate events

PearConnect reconnects automatically. Message IDs suppress repeat deliveries for five minutes within a bounded in-memory cache that survives reconnects. It does not survive an engine restart or mode switch. Events without a usable message ID cannot be deduplicated reliably.

Player writes are not automatically retried. If a request shows **Outcome uncertain**, inspect Pear Desktop before submitting it again.

## Switching from Advanced

Switching pauses requests and stops the previous TikTok input before the new input accepts commands. Outstanding work is allowed to finish safely. Enable requests deliberately after the switch.

The local HTTP listener may remain available for status and validation, but its Advanced command routes are inactive while Simple is selected.
