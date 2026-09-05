# PearConnect website

The public homepage and VitePress documentation share one static build. `/` is the download and product page; `/docs/` is the documentation. The site is hosted directly in the owner's Cloudflare account, using the `pearconnect` Pages project and `pearconnect.mellozone.site` custom domain.

## Work locally

Use Node.js 22.12+ or 24 and npm:

```sh
cd website
npm ci
npm run dev
```

Edit guides in `content/docs/`, the homepage in `.vitepress/theme/HomePage.vue`, and shared styles in `.vitepress/theme/style.css`. The homepage's screenshot is an actual PearConnect window using synthetic test fixtures. The logo reuses the application's original PearConnect mark.

## Verify and publish

```sh
npm run build
npm run check
npm audit --audit-level=moderate
npm run deploy
```

Deploy requires a Cloudflare account authorized for this project through Wrangler. The checked `wrangler.jsonc` identifies the account and static output; it contains no credential. The current setup uses direct uploads. GitHub CI validates/builds the website but does not deploy it automatically or need a Cloudflare credential.

`check` verifies generated routes, local links, anchors, assets and the local search index. Pages serves actual HTML for each documentation route and the generated 404 page. The `_headers` file sets response headers; inline script/style allowances support VitePress's theme bootstrap and rendered styling.

## Dependencies

VitePress is pinned to `2.0.0-alpha.20`, the current upstream preview using patched Vite 8. The older stable VitePress 1.6.4 pulled Vite 5 and unresolved advisories during setup. This site publishes static output; no Vite development server is deployed. Update the pinned version deliberately and rerun build, link checks and audit.

## Downloads

The Windows link points to the versioned GitHub prerelease `v0.3.0-beta.1`, not a temporary Actions artifact or the repository's unrelated legacy `release` tag. Update the homepage, install guide and release notes together when publishing the next version. Keep build/source evidence and preview limitations accurate.

## Reference direction

The documentation navigation was informed by docs.sery.bot; the download-first product presentation was informed by vrdesktop.net. Content, product imagery, layout and PearConnect branding are original to this project. No third-party screenshots, logos or claims are shipped.
