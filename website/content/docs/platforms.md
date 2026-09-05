---
title: Twitch & YouTube
description: Configure the optional Twitch and YouTube chat inputs independently of the TikTok connection mode.
---

# Twitch & YouTube

Twitch and YouTube can be configured independently of the Simple/Advanced TikTok connection. They use the same request rules and engine capacity.

## Twitch

In **Connections → Other chat platforms**, enter:

- **Twitch channel** to listen to.
- **Twitch bot username** for the reply account.
- **Twitch OAuth token** belonging to that account.

All three are required when Twitch is enabled. Select **Save & reconnect**, then deliberately enable requests. PearConnect can send command results to Twitch chat through this adapter.

Leaving the token blank preserves the saved credential. Clearing the channel disables Twitch. Desktop credentials are encrypted using the OS facilities.

CLI keys:

```dotenv
TWITCH_CHANNEL=
TWITCH_USERNAME=
TWITCH_OAUTH=
```

## YouTube Live

Enter **YouTube channel ID** under Other chat platforms and save. Use the exact channel ID, not a display name. Clear it to disable the adapter.

```dotenv
YOUTUBE_CHANNEL_ID=
```

YouTube input uses an unofficial, read-only chat adapter. Command results remain in PearConnect's activity or terminal; it does not send YouTube chat replies. Compatibility with the live platform can change.

## Permissions

Use `twitch:login` and `youtube:exact_channel_ID` in your [request and skip allowlists](./rules). Do not substitute a YouTube display name for a channel ID.

## Dry-run behavior

Dry-run disables Twitch and YouTube connections. It does not test their live delivery. Simple TikFinity input remains readable in dry-run.
