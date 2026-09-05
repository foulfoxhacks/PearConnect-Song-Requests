---
title: CLI & headless
description: Run the shared PearConnect engine without Electron, validate settings and export sanitized diagnostics.
---

# CLI & headless

The CLI runs the same engine without loading a desktop interface. Use Node.js **22 or 24** and npm. Desktop build tooling needs Node 22.12 or newer.

## Install from source

```sh
git clone https://github.com/foulfoxhacks/PearConnect-Song-Requests.git
cd PearConnect-Song-Requests
npm ci --omit=dev --ignore-scripts
npm run setup
```

Setup creates `.env` from `.env.txt` and generates a private webhook secret. It does not overwrite an existing `.env`.

New configurations use Simple and start paused. Existing files without a mode remain Advanced for compatibility.

## Authorize the player

Enable Pear Desktop's API Server plugin and keep it open:

```sh
npm run auth
```

Approve PearConnect in the player, then save the printed credential as `YTMD_TOKEN` in your private `.env`.

::: warning Sensitive output
The CLI authorization command intentionally prints the token. Do not share its output or commit your configured `.env`. The desktop authorization flow saves its credential without exposing it to the window.
:::

## Validate before starting

```sh
npm start -- --dry-run --validate-config
```

This validates configuration without opening connections. Dry-run allows you to check settings before player authorization.

## Try Simple without changing playback

```sh
npm start -- --mode simple --dry-run --accept-requests
```

Simple still reads TikFinity events in dry-run. No player calls, request accounting, Twitch connections or YouTube connections occur. A dry-run result does not prove search, song duration or queue behavior.

## Start accepting requests

```sh
npm start -- --mode simple --accept-requests
```

Or keep your configured Advanced workflow:

```sh
npm start -- --mode advanced --accept-requests
```

Keep Pear Desktop and the required chat applications running. Use `Ctrl+C` to stop PearConnect cleanly.

## Status and diagnostics

Run these from a second terminal with the matching `.env`:

```sh
npm start -- --status
npm run doctor
npm start -- --diagnostics diagnostic-report.json
```

Status and diagnostics use the running engine's authenticated localhost HTTP listener. `TIKFINITY_PORT` must be nonzero and its secret must match. Diagnostics refuses to overwrite an existing output file.

## Useful flags

| Flag | Purpose |
| --- | --- |
| `--mode simple` / `--mode advanced` | Select the TikTok request-input route. |
| `--paused` | Start without accepting song requests. |
| `--accept-requests` | Deliberately enable request intake. |
| `--dry-run` | Exercise routing without player calls or quota changes. |
| `--allow-disconnected` | Keep the engine running while the player needs repair. |
| `--json` | Emit structured logs. Status output is JSON already. |
| `--help` | Print the available options. |

Without `--allow-disconnected`, normal CLI startup fails if the player cannot be reached.

## One engine at a time

Close the desktop engine before starting the CLI, or close the CLI before opening the desktop. They share an instance lock even when webhook ports differ. Attaching a desktop window to an existing CLI engine is not currently implemented.
