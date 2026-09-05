import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const input = new URL('../content/public/desktop-overview.png', import.meta.url);
const directory = new URL('../.vitepress/theme/assets/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const width of [480, 960, 1600]) {
  const output = new URL(`desktop-${width}.webp`, directory);
  await sharp(fileURLToPath(input)).resize({ width, withoutEnlargement: true }).webp({ quality: 85, effort: 6 }).toFile(fileURLToPath(output));
}
console.log('Generated three responsive product previews from the original screenshot.');
await sharp(fileURLToPath(new URL('../../desktop/assets/sample-cover.png', import.meta.url))).resize(480).webp({ quality: 85, effort: 6 }).toFile(fileURLToPath(new URL('sample-cover.webp', directory)));
