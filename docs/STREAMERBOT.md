# TikFinity + Streamer.bot setup

The intended route is **TikTok LIVE -> TikFinity -> Streamer.bot -> PearConnect -> Pear Desktop**. Streamer.bot owns the POST request. Do not hunt for JSON-body settings in TikFinity.

This is **Advanced mode**. Select Advanced in the desktop, or set `CONNECTION_MODE=advanced` in the CLI’s `.env`. New setup files start paused: enable requests deliberately after testing (`REQUESTS_ENABLED=true` or CLI `--accept-requests`). Existing v0.2 configurations without these fields remain Advanced and enabled. Simple mode uses TikFinity’s event socket instead and rejects Advanced command input to prevent duplicate queues.

Desktop users can export the action package and reveal/copy the webhook secret from Connections. In CLI installations, read the secret from `.env`. The full copied `/tikfinity` endpoint is for request clients; the Streamer.bot `PearConnect.Url` global below takes only the origin, with no path.

## 1. Import the actions

Back up your Streamer.bot configuration first. Open **Import**, then drag `integrations/streamerbot/PearConnect.sb` into the import field, or paste the entire encoded file content. Inspect the preview: it should contain exactly these five actions in group **PearConnect**:

| Action | Endpoint | TikFinity mapping |
| --- | --- | --- |
| PearConnect - Song Request | `/tikfinity` | `!sr` custom command |
| PearConnect - Now Playing | `/tikfinity/np` | `!np` |
| PearConnect - Queue | `/tikfinity/queue` | `!queue` |
| PearConnect - Skip | `/tikfinity/skip` | `!skip`, restricted by bridge allowlist |
| PearConnect - Connection Test | `/tikfinity/test` | Manual/private testing only |

No commands, servers, triggers, secrets, or autorun behavior are included. Stable action IDs support updating this package, but an import can replace your edited action with the same identity. Review overwrite choices instead of blindly accepting them. Do not replace Streamer.bot's `data/actions.json`.

The generated package targets the observed version-11 export schema from Streamer.bot 0.2.6. Encoding, embedded source, IDs, and references are checked automatically; acceptance by your actual desktop version remains a manual verification step. Confirm each C# action compiles before live use.

### Manual fallback

Create the five actions yourself. For each, add **Core -> C# -> Execute C# Code**, paste `integrations/streamerbot/PearConnect.cs`, and change its `Route` constant to the matching endpoint above. Use **Find Refs**, then **Compile** and save. Required references include `mscorlib`, `System`, `System.Core`, `System.Net.Http`, and Streamer.bot's bundled `Newtonsoft.Json`. Resolve missing references through the editor rather than downloading random DLLs.

Both setup routes use the same reviewed source; the JSON is serialized by C#, not assembled with placeholder string concatenation.

## 2. Set local persisted globals

In Streamer.bot's persisted global variables, create the following settings. They are read by the actions at execution time. Use String values except ChatReplies, which is Boolean.

| Name | Value |
| --- | --- |
| `PearConnect.Url` | `http://127.0.0.1:7280` or your configured bridge port |
| `PearConnect.Secret` | Exact secret from desktop Connections or private CLI `TIKFINITY_SECRET` |
| `PearConnect.RequestCommand` | `sr`, without `!`, or your custom request command |
| `PearConnect.ChatReplies` | `false` initially; `true` enables optional replies |

Missing URL and request-command settings use the displayed defaults. A missing secret is empty; it only works when the bridge also has no secret. The URL must use literal `127.0.0.1`, HTTP, and no path/query/credentials. This avoids accidentally sending the private header to another host. Do not put the Pear Desktop bearer token here: that belongs only in the CLI’s `.env` or encrypted desktop storage.

The two local secrets are different: `YTMD_TOKEN` authenticates PearConnect to Pear Desktop; `TIKFINITY_SECRET` authenticates Streamer.bot to PearConnect. Neither is your Streamer.bot WebSocket password.

## 3. Connect TikFinity to Streamer.bot

Enable Streamer.bot's **WebSocket Server** under **Servers/Clients**, keeping it local. In **TikFinity -> Setup -> Streamer.bot Connection**, enter the matching address, port, endpoint, and any required connection credentials. Click **Test Connection** and confirm success before continuing.

In **Actions & Events**, create a TikFinity action of type **Streamer.bot Action**, choose **PearConnect - Song Request**, and save it. Assign it to the `!sr` custom command event. Repeat for the other desired commands. Avoid overlapping duplicate mappings.

Use the actual command saved in PearConnect. For `!play`, set Desktop's **Song request** to `play`, the persisted global `PearConnect.RequestCommand` to `play`, and TikFinity's event to **Commenting a command → !play**. Select the saved action under **Trigger all of these actions**, not the random-action field or **Chat (any comment)**. The [public setup guide](https://pearconnect.mellozone.site/docs/advanced#connect-and-map-tikfinity) describes every field and the optional read/skip mappings.

Simple mode needs none of these Actions & Events mappings: it reads the local TikFinity chat feed directly. A live marker from the [guided connection test](https://pearconnect.mellozone.site/docs/validation) verifies delivery through your selected route. Local connection tests and follow/gift simulations cannot pass as a live chat test.

TikFinity supplies `username`, `userId`, and `commandParams`. Its documentation describes `commandParams` as the comment or the custom-command parameters, so the bridge handles both:

```text
!sr Artist Song Title  -> Artist Song Title
Artist Song Title      -> Artist Song Title
```

Only the exact configured command prefix followed by whitespace is removed. Names merely beginning with the same letters are not truncated. The handle is used instead of a nickname, and the numeric ID is serialized as a string.

## 4. Test without playback

Start `npm run start:dry-run` in the PearConnect folder. Keep this process running and execute a real TikFinity test command. Dry-run song, read, and authorized-skip actions must report `dry_run`, not `added` or `skipped`.

For a manual **Connection Test**, supply these Streamer.bot action arguments using Set Argument or a test trigger:

```text
username = your_handle
userId = your_numeric_id_as_text
commandParams = !sr Artist Song Title
```

A missing username deliberately fails; the package does not silently substitute a generic viewer. The connection test validates the payload and secret but does not search, queue, skip, or consume a cooldown slot. This test intentionally never broadcasts a TikTok reply.

Check the resulting action arguments:

| Argument | Meaning |
| --- | --- |
| `pearconnectOk` | Boolean business outcome, not merely HTTP success |
| `pearconnectCode` | `added`, `cooldown`, `dry_run`, `validated`, etc. |
| `pearconnectMessage` | User-facing result when one was returned |
| `pearconnectHttpStatus` | HTTP status, or `0` if no response was received |

Then stop dry-run, start `npm start`, run `npm run doctor`, and follow the live checklist. In live mode, Song Request really queues music and authorized Skip really advances the player.

## 5. Optional TikTok replies

Enable **Allow Streamer.bot to push messages to TikFinity** in TikFinity's chatbot settings and set `PearConnect.ChatReplies` to Boolean `true`.

The action sends the documented `sendChatbotMessage` WebSocket envelope containing only `args.message`. It does not broadcast the complete argument dictionary or secrets. A rejected request such as a cooldown can produce a useful chat reply; an upstream/authentication failure is left in action results/logs rather than sent automatically to chat. A failed chatbot broadcast does not turn a successful enqueue into a failed music request.

## Timeouts and retry safety

The C# HTTP timeout is 150 seconds, allowing the maximum configured two-stage search/enqueue timeouts. There are no automatic retries or redirects. Each execution creates an idempotency key, and repeat transport submissions with that same key are deduplicated briefly by the bridge. Manually executing an action again creates a new request; inspect the player queue after a timeout instead of assuming nothing happened.

## Build and compatibility evidence

`npm run build:streamerbot` regenerates the package from `PearConnect.cs`; `npm run check:streamerbot` rejects stale output. The Windows C# harness compiles the source for .NET Framework 4.8 and sends real local HTTP requests, but substitutes the CPH host methods. It does not execute the real desktop import dialog or connect a live TikTok account.

Export-envelope and sub-action field structure was checked against [this creator's exported 0.2.6 action](https://github.com/tommerty/streamerbot-files/blob/730e389eaa97ec17736a38f34764c8179555db22/doras-api-metadata-example/doras-api-meta-example.streamerbot). Only the format was used; the action logic and embedded code here are PearConnect's own. Reference filenames may need **Find Refs** in a differently configured desktop installation.

Official references: [TikFinity integration and variables](https://tikfinity.zerody.one/streamerbot-integration), [Streamer.bot HTTP POST example](https://docs.streamer.bot/examples/http-post), [C# editor and references](https://docs.streamer.bot/api/csharp/guide/intro), [Import and export](https://docs.streamer.bot/guide/core/import-export).
