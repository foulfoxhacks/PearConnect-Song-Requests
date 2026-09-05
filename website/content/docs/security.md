---
title: Privacy & security
description: How PearConnect handles local credentials, request activity, diagnostics and website preferences.
---

# Privacy & security

## Local engine

PearConnect's request engine runs on your computer. Pear Desktop and the chat platforms still use their own internet services. The optional website session-code feature forwards submitted song requests to the desktop engine; the website cannot access the player's credentials or expose its local API.

The project is independent community software, not an official service endorsed by the supported platforms.

## Credentials

The desktop stores player credentials, webhook secrets, Twitch tokens, an optional Last.fm key and the private OBS link credential encrypted with the operating system's available credential facilities. Saved credentials stay in the privileged application process and are not included in renderer snapshots. The OBS link can be deliberately copied to the clipboard.

If secure storage is unavailable, the desktop does not fall back to plaintext. Moving settings to another machine or OS account may require authorizing again.

The CLI uses a local `.env` file. Protect that file and do not commit or share it. The CLI authorization command prints the player token intentionally so you can save it locally.

## Local endpoints

Player and TikFinity addresses are restricted to loopback. The Advanced webhook uses its own secret, rejects browser origins and restricts local hostnames. Do not expose the request engine's ports through a public tunnel or router forwarding as part of ordinary setup.

The desktop communicates through a fixed set of validated operations; it does not grant its renderer arbitrary filesystem, shell or HTTP access.

## Artwork, overlays and music discovery

The optional OBS widget uses a separate read-only server bound to `127.0.0.1`, normally port 8787. It requires a private link and exposes only sanitized track information, widget styles and the current processed artwork. It rejects mutations, foreign Host/Origin headers and unknown paths. The public website does not receive this data. Resetting the link revokes the old credential.

Artwork is fetched without player credentials from supported HTTPS YouTube image hosts. Redirects, oversized responses and unsupported image types are rejected; one resized image is held in memory. Ambient motion does not capture microphone or system audio.

Last.fm enrichment is off by default. When enabled, track title and artist are sent directly to Last.fm using your own key. Bounded in-memory caching reduces repeated requests. Only text metadata and catalogue links appear in Desktop; Last.fm data is excluded from overlays and diagnostics. [Visual studio documentation](./visual-studio) explains the controls and service terms.

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

The optional [session-code fallback](/docs/session-codes) stores submitted names, song queries and results in a Cloudflare Durable Object for up to 15 minutes. Network addresses are used transiently to derive a private, session-specific identity and enforce attempt limits; raw addresses are not stored in its database. Expired session state is removed within 15 minutes, with underlying Cloudflare backups potentially retaining historical storage longer.

The request page uses session storage for your latest receipt, including its displayed result, to avoid resending on refresh. The paired dashboard uses a secure, HttpOnly, SameSite cookie, separate from the public viewer code. Only the authenticated desktop can mint a one-use dashboard pairing link. Closing or ending the session revokes intake; Desktop can also disconnect the paired browser.

Cloudflare serves the website and GitHub serves downloads and source. Requests to those services are subject to their own policies. Following an external integration link takes you to that provider's site.

## Reporting a problem

Use the project's [GitHub issues](https://github.com/foulfoxhacks/PearConnect-Song-Requests/issues) for reproducible problems, with sanitized details. Do not include credentials, private configuration or information that would expose another user's account.
