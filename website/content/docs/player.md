---
title: Connect your player
description: Enable Pear Desktop's API Server and authorize PearConnect without copying a token into the desktop interface.
---

# Connect your player

Pear Desktop owns your playback and music queue. PearConnect uses the player's local API to search and add songs.

## Enable the API Server

Open Pear Desktop and enable its **API Server** plugin. Keep the server on localhost. PearConnect's default player address is:

```text
http://127.0.0.1:26538
```

If your player uses another local port, open **Connections → Pear Desktop**, update **Player API address**, and select **Save & reconnect**.

## Authorize PearConnect

1. Keep Pear Desktop open.
2. In PearConnect, select **Authorize PearConnect** from the setup guide or Connections.
3. Approve the request in Pear Desktop.
4. Wait for PearConnect to show **Connected**.

The desktop app saves the returned credential using the operating system's encryption facilities. You don't need to copy a bearer token from a terminal.

## Test the connection

Use **Test player connection** on Overview or **Test player** in Connections. This checks player reachability without changing playback.

An idle player can be connected without reporting a track. **Connected** means the player is reachable. From beta.4, **Enqueue confirmed** means a before/after queue check observed a new occurrence of the selected video ID. Neither alone proves audible playback. See [accepted command, missing queue entry](./troubleshooting#accepted-command-but-no-song-in-the-queue) if an API call returns successfully but the song does not appear.

## Connection states

| State | What to do |
| --- | --- |
| Authorization needed | Enable the API Server and authorize PearConnect. |
| Awaiting approval | Check Pear Desktop for the authorization prompt. |
| Authorization expired | Authorize again. |
| Disconnected | Open the player and verify its API address and port. |
| Connected | Run your safe test, then enable requests when ready. |
| Dry run | Player calls are disabled for this session. |

Changing the player address clears its saved credential. Authorize the new address before enabling requests.

## Two different connections

The default player API port is **26538**. PearConnect's Advanced webhook defaults to **7280**. TikFinity's Simple event WebSocket defaults to **21213**. These are separate services and aren't interchangeable.

For source-based authorization, see [CLI & headless](./cli). If authorization keeps failing, follow [Troubleshooting](./troubleshooting#player-will-not-connect).
