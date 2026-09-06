# PearConnect web plugins

Studio imports **`.pearplugin` files**, a single UTF-8 JSON document containing HTML, CSS, JavaScript and a manifest. These are web widgets, separate from the upstream player's compiled native integrations. Dropping a DLL, Node package, ZIP or upstream source folder into Studio is not supported.

Use **Player Studio → Web plugins → Save starter plugin** for a working example. Edit its fields in a text editor, then import it. Installation shows the name, version, description, permissions and SHA-256 fingerprint. Cancel leaves the library unchanged. Replacing an installed ID requires another review and closes its old window. No imported plugin starts automatically.

```json
{
  "format": 1,
  "id": "my-widget",
  "name": "My widget",
  "version": "1.0.0",
  "description": "A custom now-playing widget.",
  "permissions": ["playback.read"],
  "html": "<h1 id=track>Waiting for music</h1>",
  "css": "body { background: #101714; color: #c5e58c; font: 24px system-ui; }",
  "javascript": "async function update() { const p = await pearconnect.getPlayback(); document.getElementById('track').textContent = p.title; } update(); setInterval(update, 1000);"
}
```

## Permissions and API

`permissions: []` creates a standalone widget with no player data. `playback.read` grants only `window.pearconnect.getPlayback()`:

```js
const { title, artist, videoId, elapsed, duration, paused, artwork } =
  await window.pearconnect.getPlayback();
```

Time values are seconds. `artwork` is a normalized image data URL or an empty string. Missing song information is represented by the waiting state. Treat titles and artist names as plain text, and use `textContent`, not HTML interpolation. Poll once per second; the host rejects calls faster than four per second. `window.pearconnect.version` is `1`.

No queue writes, play/pause, seeking, account credentials, filesystem, shell, arbitrary IPC or network capabilities are available to imported widgets. Unknown and duplicate permissions are rejected. Permission checks run in the main process for every API call. Closing a widget stops it; removing it closes its window and removes it from the library.

Each launch uses an independent, nonpersistent browser session with sandboxing and context isolation enabled and Node integration disabled. It never shares the player's cookies. A restrictive Content Security Policy, navigation restrictions, permission denials and network request blocking apply. Popups, frames, downloads, workers and remote resources are disabled. This is a capability boundary, not a certification of the plugin author's intent or an exhaustive security assessment.

## Content and assets

- Put markup in `html`, styling in `css`, and code in `javascript`. Inline scripts and inline event handlers in HTML are blocked.
- Embed small PNG/JPEG/WebP artwork as data URLs in HTML or CSS. Network URLs and local filesystem paths do not load.
- There are no additional file routes or module/package dependencies. Bundle needed browser code into the JavaScript field.
- The file is limited to 2 MB; HTML and JavaScript are each limited to 500,000 characters and CSS to 100,000. There is a maximum of 20 installed widgets.
- IDs must be 3–48 characters, start with a lowercase letter and contain only lowercase letters, numbers and hyphens.
- Imported background images belong to the first-party appearance settings; plugins do not receive those files or paths.

The current window can be captured with a streaming application's window-capture source. It is not a public overlay URL. PearConnect Desktop's existing stream overlays remain separately configurable.
