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

## Verify that chat is arriving

Overview separates three signals:

- **Last event:** something arrived from the event feed.
- **Last chat message:** a chat event arrived.
- **Last command:** PearConnect recognized one of your commands.

**Connected · waiting** is different from **Chat arriving**. An open socket does not prove that TikFinity is receiving your stream's chat.

## Test and enable

Use **Validate sample request** in Setup guide to check the sample identity, query and basic permissions. It does not contact the player, search a song, verify duration or consume a request slot.

Use **Test player connection** separately, then select **Enable requests**. A real `!sr Artist Song Title` command can now search and enqueue music according to your rules.

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
