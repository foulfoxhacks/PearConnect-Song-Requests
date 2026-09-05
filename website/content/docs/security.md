---
title: Privacy & security
description: How PearConnect handles local credentials, request activity, diagnostics and website preferences.
---

# Privacy & security

## Local engine

PearConnect's request engine runs on your computer. Pear Desktop and the chat platforms still use their own internet services. The website hosts downloads and documentation; it does not control your local player.

The project is independent community software, not an official service endorsed by the supported platforms.

## Credentials

The desktop stores player credentials, webhook secrets and Twitch tokens encrypted with the operating system's available credential facilities. Credentials stay in the privileged application process and are not sent to the interface renderer.

If secure storage is unavailable, the desktop does not fall back to plaintext. Moving settings to another machine or OS account may require authorizing again.

The CLI uses a local `.env` file. Protect that file and do not commit or share it. The CLI authorization command prints the player token intentionally so you can save it locally.

## Local endpoints

Player and TikFinity addresses are restricted to loopback. The Advanced webhook uses its own secret, rejects browser origins and restricts local hostnames. Do not expose the request engine's ports through a public tunnel or router forwarding as part of ordinary setup.

The desktop communicates through a fixed set of validated operations; it does not grant its renderer arbitrary filesystem, shell or HTTP access.

## Request activity

The app keeps up to 200 command results in memory for the current session. These may show viewer handles, song queries and result messages locally. Unrelated chat messages are not archived by the activity feed.

History is not persisted between sessions. This limitation is separate from saved configuration and credentials.

## Diagnostic reports

Preview the report before exporting. The exported file matches the preview and omits:

- Credentials and tokens.
- Viewer identities and request text.
- Song metadata, configuration URLs and local paths.
- Raw technical logs and arbitrary private argument dictionaries.

The on-screen activity feed can contain more detail than the exported report. Review screenshots separately before sharing them.

## This website

Documentation search runs locally in your browser. The site uses browser storage for the documentation theme preference and does not add advertising analytics or a sign-in requirement.

Cloudflare serves the website and GitHub serves downloads and source. Requests to those services are subject to their own policies. Following an external integration link takes you to that provider's site.

## Reporting a problem

Use the project's [GitHub issues](https://github.com/foulfoxhacks/PearConnect-Song-Requests/issues) for reproducible problems, with sanitized details. Do not include credentials, private configuration or information that would expose another user's account.
