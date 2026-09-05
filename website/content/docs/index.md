---
title: Welcome to PearConnect
description: Get started with PearConnect, the local song-request bridge for Pear Desktop, TikFinity and your livestream.
---

# Welcome to PearConnect

<p class="doc-lead">Your community picks the songs. You set the rules.</p>

PearConnect brings live chat song requests to **Pear Desktop**. Run it in a desktop window or from a terminal, connect your stream, and decide who can request or skip.

<div class="doc-intro-links"><a href="/docs/install"><strong>Get started →</strong><span>Download the Windows app and set up your first request.</span></a><a href="/docs/advanced"><strong>Keep your automation →</strong><span>Connect an existing Streamer.bot workflow.</span></a></div>

::: info Desktop preview
The current desktop release is **0.3.0-beta.1**. Automated checks and Windows packaging pass; live-platform and fresh-machine acceptance are still in progress. See the [release notes](./releases).
:::

## Pick your connection

| Feature | Simple | Advanced |
| --- | --- | --- |
| TikTok input | TikFinity's local event WebSocket | Streamer.bot sends authenticated requests |
| Best fit | Getting started with fewer setup steps | Existing actions and custom automation |
| Streamer.bot needed | No | Yes, for this route |
| Interface | Desktop or CLI | Desktop or CLI |

Both use the same moderation rules, permissions and request accounting. Existing configurations remain Advanced unless you deliberately switch.

## What you need

- **Pear Desktop**, with its API Server plugin enabled.
- **TikFinity Desktop** on the same computer for TikTok input, connected to your livestream.
- **Streamer.bot** only when using the Advanced route.

The Windows portable download includes its runtime. You don't need Git, npm or a separate Node.js installation for the desktop build.

## Your first stream

1. [Download and install](./install) PearConnect.
2. [Authorize Pear Desktop](./player).
3. Connect [Simple](./simple) or [Advanced](./advanced) input.
4. Set your [request rules](./rules), validate a sample and test the player.
5. Select **Enable requests** when you're ready.

Pausing requests leaves existing music playing. Pear Desktop owns playback; PearConnect tracks requests and their results.

## Find an answer

- [Commands](./commands): requesting, now playing, next track and skipping.
- [Troubleshooting](./troubleshooting): authorization, missing events and uncertain results.
- [CLI & headless](./cli): running without a desktop window.
- [FAQ](./faq): requirements, capabilities and current limitations.

PearConnect is independent community software, not an official integration endorsed by TikTok, TikFinity or Pear Desktop.
