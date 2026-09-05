import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve('dist');
const origin = 'https://pearconnect.mellozone.site';
const decodeHtml = value => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
  const normalized = entity.toLowerCase();
  return named[normalized] ?? String.fromCodePoint(normalized.startsWith('&#x') ? parseInt(normalized.slice(3), 16) : parseInt(normalized.slice(2), 10));
});
function attribute(tag, name) {
  // Vue may serialize an empty value as a bare attribute (for example, alt).
  const match = tag.match(new RegExp(`\\s${name}(?=\\s|=|/?>)(?:="([^"]*)")?`));
  return match ? decodeHtml(match[1] ?? '') : undefined;
}
function meta(head, key) {
  const matches = [...head.matchAll(/<meta\b[^>]*>/g)].map(match => match[0]).filter(tag => attribute(tag, 'name') === key || attribute(tag, 'property') === key);
  assert.equal(matches.length, 1, `Expected one ${key} meta tag`);
  return attribute(matches[0], 'content');
}
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : join(dir, entry.name)))).flat();
}
const paths = (await files(root)).map(file => relative(root, file).split(sep).join('/'));
const known = new Set(paths);
const pages = new Map(await Promise.all(paths.filter(path => path.endsWith('.html')).map(async path => [path, await readFile(join(root, path), 'utf8')])));
const ids = new Map([...pages].map(([path, html]) => [path, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))]));
const expected = ['index.html', '404.html', 'sessioncode.html', 'web/dashboard.html', 'docs/index.html', ...['install', 'player', 'simple', 'advanced', 'platforms', 'commands', 'rules', 'cli', 'troubleshooting', 'faq', 'security', 'releases', 'validation', 'session-codes'].map(name => `docs/${name}.html`)];
for (const path of expected) assert.ok(known.has(path), `Missing route: ${path}`);
let checked = 0;
for (const [page, html] of pages) {
  assert.match(html, /<title>[^<]+<\/title>/, `${page} needs a title`);
  assert.match(html, /<html lang="en-US"/);
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const robots = meta(head, 'robots');
  if (page === '404.html') {
    assert.equal(robots, 'noindex, follow', 'Error pages must not be indexed');
    assert.ok(!head.includes('rel="canonical"'), '404 must not canonicalize to a real page');
  } else {
    if (page.startsWith('web/')) assert.equal(robots, 'noindex, follow');
    else assert.match(robots, /^index, follow,/);
    const canonical = origin + '/' + page.replace(/index\.html$/, '').replace(/\.html$/, '');
    const canonicals = [...head.matchAll(/<link\b[^>]*>/g)].map(match => match[0]).filter(tag => attribute(tag, 'rel') === 'canonical');
    assert.equal(canonicals.length, 1, `${page} needs exactly one canonical`);
    assert.equal(attribute(canonicals[0], 'href'), canonical);
    const title = decodeHtml(head.match(/<title>(.*?)<\/title>/)[1]);
    const description = meta(head, 'description');
    assert.ok(description?.length > 30, `${page} needs a useful description`);
    for (const key of ['og:title', 'twitter:title']) assert.equal(meta(head, key), title);
    for (const key of ['og:description', 'twitter:description']) assert.equal(meta(head, key), description);
    for (const key of ['author', 'publisher']) assert.equal(meta(head, key), 'FoulFoxHacks');
    assert.ok(meta(head, 'keywords').includes('PearConnect'));
    assert.equal(meta(head, 'og:url'), canonical);
    assert.equal(meta(head, 'twitter:card'), 'summary_large_image');
    for (const key of ['og:image', 'twitter:image']) {
      const url = new URL(meta(head, key));
      assert.equal(url.origin, origin);
      assert.ok(known.has(url.pathname.slice(1)), `${page} social image must exist`);
    }
    assert.ok(meta(head, 'og:image:alt').includes('sample data'));
    assert.equal(meta(head, 'twitter:image:alt'), meta(head, 'og:image:alt'));
    const schemas = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(schemas.length, 1, `${page} must have one parseable schema graph`);
    const schema = JSON.parse(schemas[0][1]);
    assert.equal(schema['@context'], 'https://schema.org');
    const webpage = schema['@graph'].find(node => node['@type'] === 'WebPage');
    assert.equal(webpage.url, canonical);
    assert.equal(webpage.name, title);
    assert.equal(webpage.description, description);
    assert.match(html, /itemscope[^>]*itemtype="https:\/\/schema.org\/WebPage"/, `${page} needs explicit WebPage microdata`);
    assert.ok(html.includes(`itemid="${canonical}#webpage"`));
    if (page.startsWith('docs/')) {
      const crumbs = schema['@graph'].find(node => node['@type'] === 'BreadcrumbList').itemListElement;
      assert.equal(crumbs.at(-1).item, canonical);
      crumbs.forEach((item, index) => assert.equal(item.position, index + 1));
    } else if (page === 'index.html') {
      const app = schema['@graph'].find(node => node['@type'] === 'SoftwareApplication');
      assert.equal(app.softwareVersion, '0.3.0-beta.3');
      assert.ok(html.includes(app.downloadUrl), 'Structured download must match the visible download');
      assert.ok(!app.aggregateRating && !app.review, 'Do not invent review markup');
      assert.match(html, /itemtype="https:\/\/schema.org\/SoftwareApplication"/);
      assert.ok(html.includes(`itemid="${origin}/#software"`), 'Microdata and JSON-LD must identify the same app');
      assert.match(html, /itemprop="softwareVersion">0\.3\.0-beta\.3</);
    }
  }
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    assert.notEqual(attribute(tag, 'alt'), undefined, `${page} image is missing its alt attribute`);
    const srcset = attribute(tag, 'srcset');
    if (srcset) {
      const candidates = srcset.split(',').map(candidate => candidate.trim().split(/\s+/)[0]);
      for (const candidate of candidates) assert.ok(known.has(candidate.replace(/^\//, '')), `Missing responsive image: ${candidate}`);
    }
  }
  for (const [, raw] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(?:data:|mailto:|tel:)/.test(raw)) continue;
    const url = new URL(raw.replaceAll('&amp;', '&'), `${origin}/${page}`);
    if (url.origin !== origin) continue;
    const path = decodeURIComponent(url.pathname).replace(/^\//, '');
    const target = [path || 'index.html', path + '.html', path.replace(/\/$/, '') + '/index.html'].find(candidate => known.has(candidate));
    assert.ok(target, `${page}: broken local link ${raw}`);
    if (url.hash && ids.has(target)) assert.ok(ids.get(target).has(decodeURIComponent(url.hash.slice(1))), `${page}: missing anchor ${raw}`);
    checked++;
  }
}
assert.ok(paths.some(path => /localSearchIndex.*\.js$/.test(path) || /local-search-index.*\.js$/.test(path)), 'Local search index must be generated');
const home = pages.get('index.html');
assert.match(home, /srcset="[^"]+480w, [^"]+960w, [^"]+1600w"/);
assert.ok(!home.includes('as="font"'), 'System fonts must not preload unused webfonts');
assert.match(home, /releases\/download\/v0\.3\.0-beta\.3\/PearConnect-0\.3\.0-beta\.3-win-x64\.zip/);
assert.match(pages.get('docs/simple.html'), /21213/);
assert.match(pages.get('docs/advanced.html'), /PearConnect\.Url/);
assert.ok(!paths.some(path => /(?:^|\/)(?:\.env|settings\.json|node_modules|\.git)(?:$|\/)/.test(path)), 'Only public output belongs in the website');
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
assert.match(robots, /^Sitemap: https:\/\/pearconnect\.mellozone\.site\/sitemap\.xml$/m);
assert.ok(!robots.includes('akasammythepuppy.me') && !robots.includes('\\*'), 'No copied domain or Markdown escaping in robots.txt');
const groups = [];
let group = { agents: [], rules: [] };
for (const line of robots.split(/\r?\n/).map(line => line.replace(/#.*/, '').trim()).filter(Boolean)) {
  const colon = line.indexOf(':');
  const key = line.slice(0, colon).toLowerCase();
  const value = line.slice(colon + 1).trim();
  if (key === 'sitemap') continue;
  if (key === 'user-agent') {
    if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
    group.agents.push(value);
  } else group.rules.push([key, value]);
}
if (group.agents.length) groups.push(group);
for (const group of groups) {
  assert.ok(group.rules.some(([key, value]) => key === 'allow' && value === '/'), `${group.agents} must remain crawlable`);
  assert.ok(!group.rules.some(([key]) => key === 'disallow'), 'Owner requests Allow for every crawler');
  const signals = group.rules.find(([key]) => key === 'content-signal')?.[1];
  assert.equal(signals, 'search=yes,ai-train=no,use=reference', 'Every named group must repeat the usage signal');
}
for (const agent of ['*', 'Googlebot', 'OAI-SearchBot', 'ChatGPT-User', 'Twitterbot', 'Discordbot', 'AdsBot-Google', 'GPTBot', 'ClaudeBot', 'CCBot']) {
  assert.ok(groups.some(group => group.agents.includes(agent)), `Missing crawler policy for ${agent}`);
}
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(locations.length, pages.size - 2, 'Only indexable pages belong in the sitemap');
assert.ok(!locations.some(url => url.includes('/web/')), 'Private dashboard must not enter the sitemap');
assert.ok(locations.every(url => url.startsWith(origin + '/') && !url.includes('404')));
const headers = await readFile(join(root, '_headers'), 'utf8');
assert.match(headers, /X-Robots-Tag: follow, max-image-preview:large/);
assert.match(headers, /\/assets\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
console.log(`Site checks passed: ${pages.size} HTML pages, ${checked} local links/assets, metadata, JSON-LD, image alternatives, crawler policy, sitemap and local search output.`);
