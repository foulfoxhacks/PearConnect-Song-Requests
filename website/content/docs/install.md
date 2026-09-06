---
title: Download & install
description: Install the portable PearConnect Windows preview and prepare your first song request.
---

# Download & install

## Windows desktop preview

[Download PearConnect v0.3.0-beta.5 for Windows x64](https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/v0.3.0-beta.5/PearConnect-0.3.0-beta.5-win-x64.zip)

1. Download the ZIP and extract **the complete folder** to a location you can keep.
2. Open **PearConnect.exe** from the extracted folder.
3. Select **Setup guide** in the sidebar.

Keep the runtime files beside the executable. The desktop download includes Node.js and Electron; no separate Git, npm or Node.js installation is required.

::: warning Preview status
This portable build is unsigned. Windows may warn about an unknown publisher. Download only from this project's GitHub release, verify the supplied SHA-256 checksum if needed, and assess the build before running it. Live-platform and fresh-machine testing remain outstanding; this is not a stable-release claim.
:::

## Before you connect

Have [Pear Desktop](https://github.com/pear-devs/pear-desktop) open with its **API Server** plugin enabled. For TikTok input, keep [TikFinity Desktop](https://tikfinity.zerody.one/) running on the same computer and connected to your livestream.

PearConnect is the request bridge. It does not include Pear Desktop, replace TikFinity or connect to TikTok directly.

## Finish setup

1. [Authorize your player](./player).
2. Choose [Simple](./simple) or [Advanced](./advanced).
3. Set [rules and permissions](./rules).
4. Use **Validate sample request** in the setup guide, then **Test player connection** on Overview.
5. Select **Enable requests** in the top bar.

Every desktop launch starts paused. You can pause requests from any page without pausing music.

## Updating an existing desktop installation

Close PearConnect, extract the new version into a separate folder and open its executable. Settings are stored in your Windows app-data directory, not next to the executable. Keep your previous application folder until you've checked the update.

Credentials are protected for your OS account. Copying settings to another account or computer may require authorizing again.

## Moving from the CLI

Close the running CLI engine. In the desktop app, open **Connections → Import an existing .env configuration** and choose your configured file. The original file is preserved.

An existing file without `CONNECTION_MODE` imports as Advanced. Imported connections start paused. PearConnect does not silently replace working automation with Simple mode.

## Other operating systems and headless use

The packaged desktop preview is Windows x64 only. The [CLI guide](./cli) covers running the Node.js engine from source without Electron. Check your chosen chat adapter's platform requirements, especially TikFinity Desktop for Simple TikTok input.
