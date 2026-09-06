---
title: Advanced · Streamer.bot
description: Connect TikFinity actions through Streamer.bot to PearConnect's authenticated local endpoints.
---

# Advanced · Streamer.bot

Advanced keeps your existing actions and automation in the loop. Streamer.bot sends the HTTP request; TikFinity triggers its action.

```text
TikTok LIVE → TikFinity → Streamer.bot → PearConnect → Pear Desktop
```

## Select Advanced

In PearConnect **Connections**, choose **Advanced · Streamer.bot & Automation**. For the CLI, set `CONNECTION_MODE=advanced` in `.env`.

The default local webhook origin is `http://127.0.0.1:7280`. Use the port configured in your installation.

## Import the action package

Select **Export actions** in Connections, or download [PearConnect.sb from the repository](https://github.com/foulfoxhacks/PearConnect-Song-Requests/raw/main/integrations/streamerbot/PearConnect.sb).

Back up Streamer.bot first. Open **Import**, drag in the file or paste its complete encoded contents, and review the import preview. It should contain exactly five actions in the **PearConnect** group:

| Action | Endpoint | Map to |
| --- | --- | --- |
| PearConnect - Song Request | `/tikfinity` | `!sr` |
| PearConnect - Now Playing | `/tikfinity/np` | `!np` |
| PearConnect - Queue | `/tikfinity/queue` | `!queue` |
| PearConnect - Skip | `/tikfinity/skip` | `!skip` |
| PearConnect - Connection Test | `/tikfinity/test` | Manual/private testing |

The package adds no triggers, commands, servers, secrets or autorun behavior. Stable action IDs can replace previously imported actions, so review any overwrite choices. The export targets Streamer.bot 0.2.6's schema; compile and verify each action in your installed version before live use.

## Set persisted global variables

Create these **persisted globals** in Streamer.bot. Use String values except `PearConnect.ChatReplies`, which is Boolean.

| Name | Value |
| --- | --- |
| `PearConnect.Url` | `http://127.0.0.1:7280` |
| `PearConnect.Secret` | The secret from PearConnect Connections |
| `PearConnect.RequestCommand` | `sr`, without `!`, or your chosen command name |
| `PearConnect.ChatReplies` | `false` initially |

::: warning Origin, endpoint and secrets
`PearConnect.Url` takes the **origin only**, without `/tikfinity`. **Copy endpoint** includes that path for clients that need a complete request URL. The webhook secret is not your Pear Desktop token or Streamer.bot WebSocket password. Keep each credential in its own setting.
:::

Reveal the secret deliberately in PearConnect. After **Rotate secret**, update Streamer.bot's saved value before resuming requests.

## Connect and map TikFinity

1. Enable Streamer.bot's local **WebSocket Server** under **Servers/Clients**.
2. In TikFinity's **Setup → Streamer.bot Connection**, enter the matching connection details and test them.
3. In **Actions & Events → Create new Action**, name it **PearConnect song request**. Under **What should happen?**, select **Streamer.bot Action** and choose **PearConnect - Song Request**. Save the action.
4. Select **Create new Event**. Choose **Everyone**, or the audience you deliberately want to allow. Choose **Commenting a command**, enter your actual request command, then select **PearConnect song request** under **Trigger all of these actions**. Save and confirm that the event is active.

Use **Commenting a command**, not **Chat (any comment)**. Put the action in **Trigger all of these actions**, not the random-action field. A broad chat event can turn unrelated messages into music searches; a random mapping can make requests appear intermittent.

### Match custom command names in three places

If you prefer `!play` to the default `!sr`, use this configuration:

| Location | Value |
| --- | --- |
| PearConnect Desktop → Request rules → Song request | `play` |
| Streamer.bot persisted global `PearConnect.RequestCommand` | `play` |
| TikFinity → Event → Commenting a command | `!play` |

The other optional mappings are:

| TikFinity command | Streamer.bot action | Audience |
| --- | --- | --- |
| `!np` | PearConnect - Now Playing | Your intended viewers |
| `!queue` | PearConnect - Queue | Your intended viewers |
| `!skip` | PearConnect - Skip | Only your intended controllers, also listed in PearConnect's skip allowlist |

Create one TikFinity action and one active command event for each mapping. Keep the **Connection Test** action private and manual. Selecting **Any Moderator** in TikFinity does not populate PearConnect's allowlist; with an empty skip allowlist, nobody can skip.

Leave visual effects, points, gift-combo repetition and extra actions unselected for a basic song-request action. Optional TikFinity cooldowns are separate from PearConnect's rules: leaving them at zero lets PearConnect explain its own rejections instead of TikFinity silently withholding events. Do not alter existing alert/TTS actions as part of this setup.

An offline **Overlay Screen** warning relates to TikFinity visual effects. This Streamer.bot request route does not require an OBS overlay. **Trigger WebHook** is not a substitute for the supplied action: the action supplies the authenticated JSON POST, identity handling and result codes.

Avoid overlapping mappings. PearConnect accepts only one TikTok input route by default. If Simple is selected, these Advanced request endpoints are inactive.

## Test before accepting requests

Use **Test integration** in PearConnect to check the local endpoint and authentication. Then run the imported **Connection Test** action to verify the automation route. Supply these test arguments:

```text
username = your_handle
userId = your_numeric_id_as_text
commandParams = !sr Artist Song Title
```

A missing username fails validation; it is not replaced with a generic viewer. The test does not search, queue, skip, use a cooldown slot or broadcast a chat reply.

Read `pearconnectOk`, `pearconnectCode`, `pearconnectMessage` and `pearconnectHttpStatus` in the action result. HTTP success alone does not mean the song was accepted.

## Optional TikTok replies

Enable **Allow Streamer.bot to push messages to TikFinity** in TikFinity's chatbot settings, then set `PearConnect.ChatReplies` to Boolean `true`.

This is a separate reply route. PearConnect cannot verify actual TikTok delivery. The action sends only the reply message, not a complete argument dictionary.

## Troubleshooting and manual setup

If the import does not compile, use **Find Refs** in Streamer.bot's C# editor. The [full integration guide](https://github.com/foulfoxhacks/PearConnect-Song-Requests/blob/main/docs/STREAMERBOT.md) includes required references and the manual five-action fallback.

After a timeout, inspect the player queue before retrying. Running an action again creates a new request; repeated unrelated executions are not automatically recognized as the same TikTok message.
