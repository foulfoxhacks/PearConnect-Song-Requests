// Deterministic artwork designed for PearConnect. Run after npm ci in website/.
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../website/package.json', import.meta.url))('sharp');
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('desktop/assets', { recursive: true });
for (const [name, color, dark] of [['pear', '#c7e794', '#173c2f'], ['orchid', '#c6b4ff', '#302746'], ['ember', '#ffca93', '#4c2d24']]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="#111b1a"/></linearGradient></defs><rect x="8" y="8" width="240" height="240" rx="50" fill="url(#g)"/><path d="M127 83c-10-10-26-6-31 14-7 27-34 42-34 72 0 29 27 45 65 45s66-16 66-45c0-30-28-45-35-72-4-19-20-25-31-14Z" fill="${color}"/><path d="M128 77c-2-25 16-38 44-35-3 22-18 36-44 35Z" fill="${color}"/><path d="M128 89V65" stroke="${dark}" stroke-width="7" stroke-linecap="round"/><path d="M86 165c0-14 7-25 14-33" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="7" stroke-linecap="round"/></svg>`;
  await writeFile(`desktop/assets/${name}.svg`, svg);
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(`desktop/assets/${name}.png`);
  if (name === 'pear') {
    const sizes = [16, 32, 48, 64, 128, 256], images = await Promise.all(sizes.map(size => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()));
    const header = Buffer.alloc(6 + 16 * sizes.length); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    for (let i = 0; i < sizes.length; i++) { const at = 6 + 16 * i; header[at] = header[at + 1] = sizes[i] === 256 ? 0 : sizes[i]; header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6); header.writeUInt32LE(images[i].length, at + 8); header.writeUInt32LE(offset, at + 12); offset += images[i].length; }
    await writeFile('desktop/assets/pear.ico', Buffer.concat([header, ...images]));
  }
}
console.log('Generated Pear, Orchid and Ember icons plus the Windows multi-resolution application icon.');
const cover = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="night" x2="0.7" y2="1"><stop stop-color="#142e31"/><stop offset="1" stop-color="#1b1634"/></linearGradient><linearGradient id="road" x2="0" y2="1"><stop stop-color="#c6e7a1"/><stop offset="1" stop-color="#71b6b2"/></linearGradient></defs><rect width="600" height="600" fill="url(#night)"/><circle cx="475" cy="155" r="83" fill="#e5cf9c"/><g fill="none" stroke="url(#road)" stroke-width="3" opacity=".8"><path d="M-100 640C720 360-130 210 600 110"/><path d="M-70 680C750 400-100 250 630 150"/><path d="M-40 720C780 440-70 290 660 190"/><path d="M-130 600C690 320-160 170 570 70"/><path d="M-160 560C660 280-190 130 540 30"/><path d="M-190 520C630 240-220 90 510-10"/><path d="M-220 480C600 200-250 50 480-50"/></g><text x="45" y="70" fill="#cfdfd5" font-family="sans-serif" font-size="16" letter-spacing="4">PEARCONNECT SESSIONS</text><text x="40" y="535" fill="#f0f0d8" font-family="sans-serif" font-size="68" font-weight="600" letter-spacing="-3">NIGHT DRIVE</text><text x="45" y="565" fill="#d0cce1" font-family="sans-serif" font-size="13" letter-spacing="3">ORIGINAL DESIGN · SAMPLE ARTWORK</text></svg>`;
await writeFile('desktop/assets/sample-cover.svg', cover);
await sharp(Buffer.from(cover)).png().toFile('desktop/assets/sample-cover.png');
