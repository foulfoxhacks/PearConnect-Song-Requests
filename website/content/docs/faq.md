---
title: Frequently asked questions
description: Answers about requirements, chat replies, request tracking, desktop and CLI operation.
---

# Frequently asked questions

## Is PearConnect free?

PearConnect is open-source software under the [MIT license](https://github.com/foulfoxhacks/PearConnect-Song-Requests/blob/main/LICENSE). It has no PearConnect subscription. Other applications and platforms have their own terms and requirements.

## Do I need Streamer.bot?

Only for the Advanced Streamer.bot route. Simple reads chat events directly from TikFinity Desktop. Both modes still need Pear Desktop for music and TikFinity Desktop for TikTok input.

## Is this a direct TikTok connection?

No. Simple is a direct **TikFinity** connection. TikFinity connects to your livestream and exposes its local event feed to PearConnect.

## Do I need Node.js?

The Windows portable desktop download includes its runtime. Source and CLI users install Node.js separately. Follow [Download & install](./install) or [CLI & headless](./cli).

## Can I use Advanced with the desktop app?

Yes. Simple and Advanced both work with the graphical app or CLI. The mode selects your TikTok input route, not the interface you must use.

## Can I run the desktop and CLI together?

You can use read-only CLI status tools against the running engine when its authenticated HTTP listener is enabled. You cannot start two engines. A shared instance lock prevents separate listeners and counters from processing the same stream.

## Does pausing requests pause music?

No. It stops new song requests. Existing playback stays in Pear Desktop; separately authorized skip commands remain available.

## Where do Simple-mode replies go?

To PearConnect's activity feed or CLI output. Simple does not send messages to TikTok chat. Advanced has an optional, separately configured TikFinity chatbot relay.

## Can viewers cancel or move their songs?

Not in this preview. Exact queue ownership and reconciliation are not implemented. The player queue is read-only, and the per-user request limit uses a duration-based approximation.

## Is request history saved after closing the app?

No. History is session-only and bounded to 200 command results. Persistent history is planned work, not a current feature.

## Will an upgrade switch my automation to Simple?

Existing configurations without a mode remain Advanced. The desktop imports your `.env` only when you select it. An upgrade does not silently replace your working automation.

## Can I use Simple and Advanced for the same TikTok stream?

Only one TikTok input route accepts commands by default. This prevents common duplicate queues. The webhook's idempotency keys do not automatically identify copies of the same chat message arriving through unrelated integrations.

## Is the preview ready for every livestream setup?

Automated local tests and Windows packaging have passed. Real-platform event capture, fresh-machine onboarding and sustained streaming workloads remain acceptance work. Review [release notes](./releases) and test your setup before relying on it during a stream.
