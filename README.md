# PearConnect Song Requests

Local-first, multi-platform song requests for **Pear Desktop**.

PearConnect listens for song-request commands from Twitch, YouTube Live, and TikTok LIVE, applies one shared set of queue rules, searches YouTube Music, and adds the selected track to the queue in your local Pear Desktop app.

> **TikTok note:** the recommended TikTok path is **TikFinity -> Streamer.bot -> PearConnect**. TikFinity supplies the TikTok event and user variables, Streamer.bot handles the HTTP POST, and PearConnect handles the music logic. TikFinity does **not** need to expose POST, Content-Type, or request-body fields in its normal action UI for this setup.

## What PearConnect does

- `!sr <song>` searches YouTube Music and adds the first matching playable result to the Pear Desktop queue.
- `!np` reports the currently playing track.
- `!queue` reports the next track in the queue.
- `!skip` skips the current track for users in the configured allowlist.
- Applies per-user cooldowns across each platform.
- Applies a maximum song length.
- Applies a per-user queue limit.
- Applies a configurable blocklist against both the request text and the resolved title/artist.
- Supports Twitch chat directly.
- Supports YouTube Live chat directly.
- Supports TikTok LIVE through TikFinity, with Streamer.bot as the recommended bridge.
- Exposes a small localhost webhook API for Streamer.bot or other local automation tools.
- Runs locally. No hosted PearConnect backend is required.

## Architecture

```text
Twitch chat --------------------------\
                                      \
YouTube Live chat ---------------------> PearConnect ----> Pear Desktop API Server ----> YouTube Music queue
                                      /
TikTok LIVE -> TikFinity -> Streamer.bot
```

PearConnect is the shared queue and policy layer. Streamer.bot is an assist for the TikTok path, not a requirement for Twitch or YouTube.

### TikTok path in detail

```text
Viewer
  |
  |  !sr Sleep Token Take Me Back To Eden
  v
TikTok LIVE
  |
  v
TikFinity
  |  username + commandParams
  v
Streamer.bot Action
  |  POST application/json
  v
http://127.0.0.1:7280/tikfinity
  |
  v
PearConnect
  |
  |  search + queue rules
  v
Pear Desktop API Server
  |
  v
YouTube Music queue
```

PearConnect returns a JSON response to Streamer.bot. Streamer.bot can optionally pass that message back to TikFinity so the TikFinity chatbot can reply in TikTok chat.

## Platform behavior

| Platform | Input path | Requests | Replies |
| --- | --- | --- | --- |
| Twitch | Direct through `tmi.js` | Yes | Sent back to Twitch chat |
| TikTok LIVE | TikFinity -> Streamer.bot -> PearConnect | Yes | Optional through TikFinity chatbot |
| YouTube Live | Direct through `youtube-chat` | Yes | Logged to the PearConnect terminal only |
| Other local tools | HTTP webhook | Yes | JSON response |

You can enable only the platforms you use.

## Requirements

### Core

- **Node.js 18 or newer**
- **Pear Desktop** with the **API Server** plugin enabled
- A local `.env` file based on the included `.env.txt`

### Per platform

- **Twitch:** channel name, bot username, and OAuth token
- **TikTok LIVE:** TikFinity Desktop plus Streamer.bot for the recommended integration
- **YouTube Live:** YouTube channel ID

Useful upstream projects:

- [Pear Desktop](https://github.com/pear-devs/pear-desktop)
- [TikFinity](https://tikfinity.zerody.one/)
- [TikFinity Streamer.bot integration guide](https://tikfinity.zerody.one/streamerbot-integration)
- [Streamer.bot](https://streamer.bot/)
- [Streamer.bot advanced HTTP requests](https://docs.streamer.bot/examples/http-post)

## Quick start

### 1. Clone PearConnect

```bash
git clone https://github.com/foulfoxhacks/PearConnect-Song-Requests.git
cd PearConnect-Song-Requests
npm install
```

### 2. Create `.env`

The repository ships with `.env.txt` as the configuration template.

**Windows PowerShell**

```powershell
Copy-Item .env.txt .env
```

**Windows Command Prompt**

```bat
copy .env.txt .env
```

**macOS / Linux**

```bash
cp .env.txt .env
```

Never commit your completed `.env` file.

### 3. Enable the Pear Desktop API Server

In Pear Desktop, enable the **API Server** plugin.

The default PearConnect configuration expects:

```text
http://127.0.0.1:26538
```

Keep the API server on localhost unless you intentionally need remote access and understand the security implications.

For the normal authenticated setup, use Pear Desktop's **Authorize at first request** authorization strategy.

### 4. Request a Pear Desktop token

With Pear Desktop running:

```bash
npm run auth
```

Pear Desktop should display an authorization prompt. Approve it.

PearConnect prints a line similar to:

```text
YTMD_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Copy the entire token into `.env`:

```dotenv
YTMD_TOKEN=your_token_here
```

If you change `YTMD_CLIENT_ID`, Pear Desktop treats it as a different client and you may need to authorize again.

### 5. Start PearConnect

```bash
npm start
```

A healthy startup looks roughly like this:

```text
[ytmd] connected.
[twitch] disabled (TWITCH_CHANNEL is empty)
[youtube] disabled (YOUTUBE_CHANNEL_ID is empty)
[tikfinity] webhook listening on http://127.0.0.1:7280
ytmd-stream-integration is running. Press Ctrl+C to quit.
```

The internal package/log name is still `ytmd-stream-integration`; the public project is **PearConnect Song Requests**.

---

# TikTok LIVE setup: TikFinity + Streamer.bot

This is the recommended TikTok setup.

## Why Streamer.bot is in the middle

PearConnect expects a proper HTTP POST with JSON. Streamer.bot's built-in **Fetch URL** sub-action is GET-only, so the reliable approach is an **Execute C# Code** sub-action using `HttpClient`.

TikFinity already has a Streamer.bot integration. It can trigger a Streamer.bot Action and provide TikTok variables such as:

- `%username%` - TikTok @handle
- `%nickname%` - TikTok display name
- `%userId%` - TikTok numeric user ID
- `%commandParams%` - the text supplied to a custom command

For a viewer message such as:

```text
!sr Sleep Token Granite
```

`%commandParams%` should contain the song query passed by TikFinity to Streamer.bot.

## 1. Connect TikFinity to Streamer.bot

In **Streamer.bot**:

1. Open **Servers/Clients**.
2. Enable the **WebSocket Server**.
3. Leave the server local unless you intentionally need remote access.

In **TikFinity**:

1. Open **Setup**.
2. Find **Streamer.bot Connection**.
3. Enter the same address, port, and endpoint shown by the Streamer.bot WebSocket server.
4. Click **Test Connection**.
5. Do not continue until the test succeeds.

TikFinity documents this connection here: [Streamer.bot Integration](https://tikfinity.zerody.one/streamerbot-integration).

## 2. Create the Streamer.bot song-request Action

Create an Action named:

```text
PearConnect - Song Request
```

Add:

```text
Core -> C# -> Execute C# Code
```

Paste the following code and compile it:

```csharp
using System;
using System.Net.Http;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(15)
    };

    // Change this only if you changed TIKFINITY_PORT in PearConnect.
    private const string PearConnectUrl = "http://127.0.0.1:7280/tikfinity";

    // Optional. If TIKFINITY_SECRET is blank in PearConnect, leave this blank too.
    private const string WebhookSecret = "";

    public bool Execute()
    {
        CPH.TryGetArg("username", out string username);
        CPH.TryGetArg("commandParams", out string commandParams);

        if (string.IsNullOrWhiteSpace(username))
            username = "viewer";

        if (commandParams == null)
            commandParams = "";

        try
        {
            string json = JsonConvert.SerializeObject(new
            {
                user = username,
                query = commandParams
            });

            using (var request = new HttpRequestMessage(HttpMethod.Post, PearConnectUrl))
            {
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");

                if (!string.IsNullOrWhiteSpace(WebhookSecret))
                    request.Headers.Add("X-Webhook-Secret", WebhookSecret);

                using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    string responseBody = response.Content
                        .ReadAsStringAsync()
                        .GetAwaiter()
                        .GetResult();

                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogError(
                            $"[PearConnect] HTTP {(int)response.StatusCode}: {responseBody}"
                        );
                        return false;
                    }

                    CPH.LogInfo(
                        $"[PearConnect] HTTP {(int)response.StatusCode}: {responseBody}"
                    );

                    // PearConnect replies with:
                    // { "ok": true, "message": "@viewer added: ..." }
                    // If TikFinity chatbot replies are enabled, pass that message back.
                    if (!string.IsNullOrWhiteSpace(responseBody))
                    {
                        JObject parsed = JObject.Parse(responseBody);
                        string message = parsed.Value<string>("message");

                        if (!string.IsNullOrWhiteSpace(message))
                        {
                            CPH.SetArgument("message", message);

                            CPH.WebsocketBroadcastJson(
                                JsonConvert.SerializeObject(new
                                {
                                    action = "sendChatbotMessage",
                                    args = new { message = message }
                                })
                            );
                        }
                    }
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError($"[PearConnect] {ex.GetType().Name}: {ex.Message}");
            return false;
        }
    }
}
```

### If you use `TIKFINITY_SECRET`

Set a value in PearConnect's `.env`:

```dotenv
TIKFINITY_SECRET=replace_this_with_a_private_random_value
```

Then put the exact same value into `WebhookSecret` in the Streamer.bot C# code.

If one side is blank and the other is not, or the values differ, PearConnect returns HTTP `403`.

## 3. Allow Streamer.bot to send TikTok chat replies

This step is optional but recommended.

In TikFinity's chatbot settings, enable:

```text
Allow Streamer.bot to push messages to TikFinity
```

With that enabled, PearConnect can return messages such as:

```text
@viewer added: Granite - Sleep Token (3:46)
```

Streamer.bot receives the JSON response and sends the message back through TikFinity.

If you do not want automated TikTok replies, remove or comment out the `CPH.WebsocketBroadcastJson(...)` block in the C# action.

## 4. Connect the TikFinity command to the Streamer.bot Action

In TikFinity:

1. Go to **Actions & Events**.
2. Create a new Action.
3. Choose **Streamer.bot Action**.
4. Select `PearConnect - Song Request`.
5. Save it.
6. Create or edit the custom command event for `!sr`.
7. Assign the Streamer.bot Action to that command.

Test with:

```text
!sr never gonna give you up
```

The request should travel:

```text
TikTok -> TikFinity -> Streamer.bot -> PearConnect -> Pear Desktop
```

## 5. Add `!np`, `!queue`, and `!skip` for TikTok

PearConnect exposes separate endpoints:

| Purpose | Endpoint |
| --- | --- |
| Song request | `http://127.0.0.1:7280/tikfinity` |
| Now playing | `http://127.0.0.1:7280/tikfinity/np` |
| Queue peek | `http://127.0.0.1:7280/tikfinity/queue` |
| Skip | `http://127.0.0.1:7280/tikfinity/skip` |

The easiest setup is to duplicate the Streamer.bot Action above and change only `PearConnectUrl`.

Suggested Action names:

```text
PearConnect - Song Request
PearConnect - Now Playing
PearConnect - Queue
PearConnect - Skip
```

Then map the matching TikFinity custom commands to those Actions.

For `/np`, `/queue`, and `/skip`, PearConnect only needs the TikTok username. The `query` field can remain blank.

`!skip` is still protected by `SKIP_ALLOWLIST` in `.env`.

---

# Direct TikFinity/webhook mode

Streamer.bot is recommended for TikFinity because it cleanly handles the POST request and can relay PearConnect's reply back to TikTok.

The webhook itself is not Streamer.bot-specific. Any local tool capable of sending JSON can call it directly.

## Song request

```http
POST http://127.0.0.1:7280/tikfinity
Content-Type: application/json
```

```json
{
  "user": "viewer_name",
  "query": "Sleep Token Granite"
}
```

## Now playing

```http
POST http://127.0.0.1:7280/tikfinity/np
Content-Type: application/json
```

```json
{
  "user": "viewer_name"
}
```

## Queue

```http
POST http://127.0.0.1:7280/tikfinity/queue
Content-Type: application/json
```

```json
{
  "user": "viewer_name"
}
```

## Skip

```http
POST http://127.0.0.1:7280/tikfinity/skip
Content-Type: application/json
```

```json
{
  "user": "allowed_mod_name"
}
```

## Health check

```http
GET http://127.0.0.1:7280/healthz
```

Expected response:

```json
{
  "ok": true
}
```

## Webhook response

PearConnect responds with JSON:

```json
{
  "ok": true,
  "message": "@viewer added: Song Title - Artist (3:42)"
}
```

`message` may be `null` if the command produced no user-facing reply.

If `TIKFINITY_SECRET` is set, every webhook request must include:

```http
X-Webhook-Secret: your_secret
```

---

# Twitch setup

Set the following values in `.env`:

```dotenv
TWITCH_CHANNEL=yourchannel
TWITCH_USERNAME=yourbotusername
TWITCH_OAUTH=oauth:xxxxxxxxxxxxxxxx
```

Leave `TWITCH_CHANNEL` blank to disable Twitch.

PearConnect listens to Twitch chat directly. Streamer.bot and TikFinity are not involved in the Twitch path.

Supported Twitch commands use the names configured through:

```dotenv
CMD_REQUEST=sr
CMD_NOWPLAYING=np
CMD_QUEUE=queue
CMD_SKIP=skip
```

For example:

```text
!sr Linkin Park Numb
!np
!queue
!skip
```

The Twitch bot account sends PearConnect's reply back to chat.

> Treat `TWITCH_OAUTH` like a password. Do not paste it into screenshots, logs, issues, or commits.

---

# YouTube Live setup

Set your YouTube channel ID:

```dotenv
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxx
```

Leave it blank to disable YouTube Live support.

PearConnect listens for commands using the `youtube-chat` package.

Important limitation: this integration is **read-only**. PearConnect can see supported YouTube Live chat commands, but its replies are written to the terminal rather than posted back into YouTube chat.

Example terminal output:

```text
[youtube reply -> ViewerName] @ViewerName added: Song - Artist (3:25)
```

If you need visible YouTube chat responses, connect a separate chatbot or build an authenticated YouTube Data API posting integration.

---

# Commands

| Default command | Purpose | Access |
| --- | --- | --- |
| `!sr <song>` | Search YouTube Music and add the first usable match | Everyone |
| `!np` | Show the current track | Everyone |
| `!queue` | Show the next track | Everyone |
| `!skip` | Skip the current track | `SKIP_ALLOWLIST` only |

The command names in `.env` are used by the direct Twitch and YouTube parsers.

TikFinity custom-command names are configured in TikFinity itself. If you rename `CMD_REQUEST`, that does not automatically rename your TikFinity command event.

---

# Configuration reference

## Pear Desktop

| Variable | Default | Description |
| --- | --- | --- |
| `YTMD_HOST` | `http://127.0.0.1:26538` | Pear Desktop API Server base URL |
| `YTMD_CLIENT_ID` | `ytmd-stream-bot` | Client ID used when requesting an auth token |
| `YTMD_TOKEN` | empty | Bearer token returned by `npm run auth` |

`YTMD_TOKEN` is required by the current PearConnect startup path.

## Queue rules

| Variable | Default | Description |
| --- | ---: | --- |
| `COOLDOWN_SECONDS` | `60` | Per-user cooldown between successful requests |
| `MAX_SONG_SECONDS` | `420` | Maximum track length, `0` disables the limit |
| `MAX_PER_USER` | `2` | Maximum active queued requests tracked per user, `0` disables the limit |
| `BLOCKLIST` | empty | Comma-separated substrings blocked in query/title/artist |

The queue policy is shared across platforms, but users are keyed by platform plus username. A Twitch `sammy` and TikTok `sammy` are treated as separate users.

## Twitch

| Variable | Default | Description |
| --- | --- | --- |
| `TWITCH_CHANNEL` | empty | Channel to join; blank disables Twitch |
| `TWITCH_USERNAME` | empty | Twitch bot account |
| `TWITCH_OAUTH` | empty | OAuth token for the bot account |

## YouTube

| Variable | Default | Description |
| --- | --- | --- |
| `YOUTUBE_CHANNEL_ID` | empty | Channel ID; blank disables YouTube Live |

## TikFinity / Streamer.bot webhook

| Variable | Default | Description |
| --- | --- | --- |
| `TIKFINITY_PORT` | `7280` | Local PearConnect webhook port; `0` disables it |
| `TIKFINITY_SECRET` | empty | Optional shared secret required in `X-Webhook-Secret` |

If you use TikFinity through Streamer.bot, `TIKFINITY_PORT` must stay enabled.

## Command names

| Variable | Default |
| --- | --- |
| `CMD_REQUEST` | `sr` |
| `CMD_NOWPLAYING` | `np` |
| `CMD_QUEUE` | `queue` |
| `CMD_SKIP` | `skip` |
| `SKIP_ALLOWLIST` | empty |

`SKIP_ALLOWLIST` is a comma-separated list of usernames. Usernames are matched case-insensitively.

---

# Queue behavior

When a viewer requests a song, PearConnect:

1. Normalizes the viewer identity into a platform-specific user key.
2. Verifies the request is not empty.
3. Checks that user's cooldown.
4. Checks the per-user queue limit.
5. Checks the request text against the blocklist.
6. Searches YouTube Music through Pear Desktop.
7. Selects the first playable result it can extract.
8. Checks the resolved title and artist against the blocklist.
9. Checks the song length.
10. Adds the track to the Pear Desktop queue.
11. Returns a viewer-facing success or error message.

### Per-user queue-limit caveat

`MAX_PER_USER` is intentionally lightweight. PearConnect increments a user's active count when a song is added and decreases it after approximately that song's duration.

That means the count is **best effort**, not a perfect mirror of Pear Desktop's queue. Manual skips, application restarts, queue edits, or other playback changes can temporarily make the count differ from reality.

---

# Testing

Run the included smoke tests with:

```bash
npm test
```

The smoke test starts a fake local Pear Desktop API and checks core behavior including:

- search-result extraction
- successful queue insertion
- cooldown enforcement
- per-user separation
- blocklist rejection
- empty-request handling
- now-playing output
- skip allowlist rejection

The smoke test does not launch TikFinity, Streamer.bot, Twitch, YouTube, or Pear Desktop itself.

---

# Troubleshooting

## `YTMD_TOKEN is not set`

Run:

```bash
npm run auth
```

Approve the request in Pear Desktop, then copy the resulting token into `.env`.

## `YTMD connection check failed`

Check all of the following:

- Pear Desktop is running.
- The API Server plugin is enabled.
- `YTMD_HOST` matches the API Server host and port.
- The authorization strategy allows your token.
- `YTMD_TOKEN` is current.

If authorization was just approved but you still receive `401 Unauthorized`, restart Pear Desktop or toggle the API Server plugin, then try again.

## Streamer.bot gets `Connection refused` / `ECONNREFUSED`

Check that PearConnect is running and the terminal contains:

```text
[tikfinity] webhook listening on http://127.0.0.1:7280
```

Also confirm the port in the Streamer.bot C# code matches `TIKFINITY_PORT`.

## Streamer.bot receives HTTP `403`

`TIKFINITY_SECRET` and `WebhookSecret` do not match.

Either:

- use the same non-empty value on both sides, or
- leave both blank for localhost-only use.

## TikFinity does not trigger the Streamer.bot Action

1. Confirm Streamer.bot's WebSocket server is enabled.
2. In TikFinity, use **Setup -> Streamer.bot Connection -> Test Connection**.
3. Confirm the TikFinity Action is of type **Streamer.bot Action**.
4. Confirm the correct Event/custom command is assigned to that Action.
5. Open **Action Queues -> Action History** in Streamer.bot and inspect the action arguments.

You should see TikFinity-provided variables such as `username` and `commandParams` when the command fires.

## `commandParams` is blank

Make sure the TikFinity trigger is a custom command and the viewer entered text after the command:

```text
!sr artist song title
```

A bare `!sr` intentionally produces PearConnect's usage response.

## PearConnect works, but TikTok chat receives no reply

The request path and the reply path are separate.

In TikFinity, enable:

```text
Allow Streamer.bot to push messages to TikFinity
```

Also confirm you kept the `CPH.WebsocketBroadcastJson(...)` portion of the Streamer.bot code.

## Twitch connects but does not answer

- Confirm `TWITCH_USERNAME` matches the account that owns `TWITCH_OAUTH`.
- Confirm the token is still valid.
- Confirm the bot joined the intended `TWITCH_CHANNEL`.
- Confirm your command name matches the `CMD_*` values.

## YouTube accepts requests but viewers do not see replies

Expected behavior. The current YouTube adapter is read-only and writes responses to the PearConnect terminal.

## Song returns `no results`

Try a more specific query:

```text
!sr artist name song title
```

PearConnect currently uses the first playable result found in Pear Desktop's YouTube Music search response.

## `!skip` says the user cannot skip

Add the username to `.env`:

```dotenv
SKIP_ALLOWLIST=user1,user2,user3
```

Restart PearConnect after changing `.env`.

## Port `7280` is already in use

Change:

```dotenv
TIKFINITY_PORT=7281
```

Then update every Streamer.bot PearConnect URL to use the same port.

---

# Security

PearConnect is designed to stay local.

- The webhook server binds to `127.0.0.1`.
- Keep the Pear Desktop API Server local unless remote access is intentional.
- Never commit `.env`.
- Treat `YTMD_TOKEN` as a credential.
- Treat `TWITCH_OAUTH` as a password.
- Treat `TIKFINITY_SECRET` as a secret if you enable it.
- Do not paste secrets into GitHub issues or public logs.
- If you change the webhook to listen beyond localhost, add authentication and firewall rules before using it.

---

# Known limitations

- YouTube Live replies are terminal-only.
- TikTok chat replies require TikFinity's Streamer.bot chatbot-message option.
- PearConnect selects the first usable YouTube Music search result rather than showing an approval picker.
- `MAX_PER_USER` tracking is best effort and is not persisted across process restarts.
- Request history and statistics are not persisted.
- The YouTube Music search response is an internal renderer structure and may require maintenance if Pear Desktop/YouTube changes that shape.
- PearConnect currently runs as a single local Node.js process.

---

# Project layout

```text
PearConnect-Song-Requests/
├─ .env.txt
├─ package.json
├─ test-smoke.mjs
└─ src/
   ├─ index.js
   ├─ auth.js
   ├─ ytmd.js
   ├─ queue-manager.js
   └─ platforms/
      ├─ twitch.js
      ├─ youtube.js
      └─ tikfinity.js
```

### Important files

- `src/index.js` - loads configuration and starts enabled platform adapters
- `src/auth.js` - requests a Pear Desktop API token
- `src/ytmd.js` - Pear Desktop API client and YouTube Music search-result extraction
- `src/queue-manager.js` - shared request policy and queue logic
- `src/platforms/twitch.js` - Twitch chat adapter
- `src/platforms/youtube.js` - YouTube Live chat adapter
- `src/platforms/tikfinity.js` - localhost HTTP bridge used by Streamer.bot/TikFinity
- `test-smoke.mjs` - local smoke tests using a fake Pear Desktop API

---

# Development

Install dependencies:

```bash
npm install
```

Run:

```bash
npm start
```

Run tests:

```bash
npm test
```

Request a new Pear Desktop token:

```bash
npm run auth
```

Pull requests and focused bug reports are welcome.

Good future additions include:

- approval queue UI
- persistent request history
- persistent per-user statistics
- better queue-state reconciliation
- duplicate-song controls
- vote-to-skip
- first-class Streamer.bot import package
- richer TikTok response handling
- official authenticated YouTube reply support

---

# License

MIT. See [LICENSE](LICENSE).

Built by [Aleksandr "Sammy" Freyermuth](https://github.com/foulfoxhacks).

# Acknowledgements

PearConnect builds on the work of:

- [Pear Desktop](https://github.com/pear-devs/pear-desktop) for the local YouTube Music desktop app and API Server plugin
- [Streamer.bot](https://streamer.bot/) for local stream automation and the TikTok HTTP bridge
- [TikFinity](https://tikfinity.zerody.one/) for TikTok LIVE events and its Streamer.bot integration
- [tmi.js](https://github.com/tmijs/tmi.js) for Twitch IRC/chat access
- [youtube-chat](https://github.com/LinaTsukusu/youtube-chat) for YouTube Live chat ingestion

PearConnect is an independent community project and is not affiliated with TikTok, YouTube, Google, Twitch, TikFinity, Streamer.bot, or Pear Desktop.
