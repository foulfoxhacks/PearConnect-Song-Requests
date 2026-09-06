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

`npm run dev` and `npm run build` generate 480-, 960- and 1600-pixel WebP previews from `content/public/desktop-overview.png` using Sharp. Generated previews are ignored by Git and imported by Vite so their production filenames include a content hash. Keep the original PNG for social previews. The page uses native system fonts and downloads no webfonts.

## Verify and publish

```sh
npm run build
npm run check
npm audit --audit-level=moderate
npm run deploy
```

Deploy requires a Cloudflare account authorized for this project through Wrangler. The checked `wrangler.jsonc` identifies the project and static output; it contains no credential. Pages does not accept `account_id` in this file. If you have access to multiple accounts, set `CLOUDFLARE_ACCOUNT_ID` in your shell before deploying (the project owner's account ID is `61ac4bebbe92f78de54198ee6c9a3b3c`). The current setup uses direct uploads. GitHub CI validates/builds the website but does not deploy it automatically or need a Cloudflare credential.

`check` verifies generated routes, local links, anchors, assets and the local search index. Pages serves actual HTML for each documentation route and the generated 404 page. The `_headers` file sets response headers; inline script/style allowances support VitePress's theme bootstrap and rendered styling.

After building, `npm run preview` serves `http://127.0.0.1:5173/` with Wrangler's local Pages runtime, including the production `_headers` rules. Use this command for local SEO/header audits. Vite's development server does not emulate Cloudflare response headers. Stop an existing process on that port before starting another preview.

## Search metadata and crawler policy

`.vitepress/seo.mjs` generates per-page canonical URLs, robots directives, Open Graph and Twitter cards, and JSON-LD for the website, publisher, application and documentation breadcrumbs. These appear in the published HTML and the page data used by client navigation. `theme/Layout.vue` also emits explicit WebPage microdata, and the homepage download section emits SoftwareApplication microdata with the same entity IDs as the JSON-LD. The default 404 uses `noindex, follow` and is excluded from the sitemap. Update the software version and download URL in both representations when publishing a new application release.

All public responses include `X-Robots-Tag` with follow and preview directives. Indexable pages declare `index` in their robots meta tag; the global header intentionally omits `index` so it does not contradict a missing page's `noindex` meta tag. Explicit `/404` and `/404.html` responses also receive a `noindex` header. Hashed `/assets/` files receive a one-year immutable cache policy; HTML retains Cloudflare's revalidation behavior.

Author and publisher are FoulFoxHacks. The keyword tag is descriptive metadata only; [Google does not use it for indexing or ranking](https://developers.google.com/search/docs/crawling-indexing/special-tags). Decorative logos have empty alt text and are hidden from assistive technology because nearby text already names the brand. The product screenshot has descriptive alt text. Links use visible descriptive text; redundant title attributes are not required.

`content/public/robots.txt` contains the owner's crawler policy. All named crawlers, including dedicated training agents, intentionally retain `Allow: /`. Every group repeats `search=yes,ai-train=no,use=reference`; `ai-input` remains unspecified. `use=reference` is retained as a publisher-defined extension, not a promise of crawler support. [Cloudflare's documented Content Signals vocabulary](https://blog.cloudflare.com/content-signals-policy/) defines `search`, `ai-input` and `ai-train`. These signals express usage preferences; they do not technically prevent scraping. The sitemap points to this site's production domain.

Audit `https://pearconnect.mellozone.site/` or the built preview for production metadata. A development page contains Vite's development client, and a browser extension may report injected resources. The site uses native system fonts and has no Google Fonts dependency.

## Dependencies

VitePress is pinned to `2.0.0-alpha.20`, the current upstream preview using patched Vite 8. The older stable VitePress 1.6.4 pulled Vite 5 and unresolved advisories during setup. This site publishes static output; no Vite development server is deployed. Update the pinned version deliberately and rerun build, link checks and audit.

## Downloads

The Windows link points to the versioned GitHub prerelease `v0.3.0-beta.5`, not a temporary Actions artifact or the repository's unrelated legacy `release` tag. Update the homepage, install guide and release notes together when publishing the next version. Keep build/source evidence and preview limitations accurate.

The homepage's widget-style selector uses original sample artwork from `desktop/assets/sample-cover.png`, converted to WebP at build time. `npm run test:visuals` exercises that selector and the actual private localhost OBS source in isolated Chromium. Set `PEARCONNECT_CHROME` to an installed Chrome executable or install Playwright Chromium. The UI test covers 320–1440px pages, three widget layouts, artwork, pause/seek timing, safe rendering, disconnects and reduced motion. No real player is controlled.

## Reference direction

The documentation navigation was informed by docs.sery.bot; the download-first product presentation was informed by vrdesktop.net. Content, product imagery, layout and PearConnect branding are original to this project. No third-party screenshots, logos or claims are shipped.
