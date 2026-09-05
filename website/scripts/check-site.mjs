import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve('dist');
const origin = 'https://pearconnect.mellozone.site';
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : join(dir, entry.name)))).flat();
}
const paths = (await files(root)).map(file => relative(root, file).split(sep).join('/'));
const known = new Set(paths);
const pages = new Map(await Promise.all(paths.filter(path => path.endsWith('.html')).map(async path => [path, await readFile(join(root, path), 'utf8')])));
const ids = new Map([...pages].map(([path, html]) => [path, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))]));
const expected = ['index.html', '404.html', 'docs/index.html', ...['install', 'player', 'simple', 'advanced', 'platforms', 'commands', 'rules', 'cli', 'troubleshooting', 'faq', 'security', 'releases'].map(name => `docs/${name}.html`)];
for (const path of expected) assert.ok(known.has(path), `Missing route: ${path}`);
let checked = 0;
for (const [page, html] of pages) {
  assert.match(html, /<title>[^<]+<\/title>/, `${page} needs a title`);
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
assert.match(home, /releases\/download\/v0\.3\.0-beta\.1\/PearConnect-0\.3\.0-beta\.1-win-x64\.zip/);
assert.match(pages.get('docs/simple.html'), /21213/);
assert.match(pages.get('docs/advanced.html'), /PearConnect\.Url/);
assert.ok(!paths.some(path => /(?:^|\/)(?:\.env|settings\.json|node_modules|\.git)(?:$|\/)/.test(path)), 'Only public output belongs in the website');
console.log(`Site checks passed: ${pages.size} HTML pages, ${checked} local links/assets, all documentation routes, anchors and local search output.`);
