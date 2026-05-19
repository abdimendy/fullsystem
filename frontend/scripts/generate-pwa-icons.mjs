/** Generate PNG icons for mobile PWA install (Android + iOS). */
import sharp from 'sharp';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = join(root, 'favicon.svg');

if (!existsSync(svg)) {
  console.warn('[pwa-icons] favicon.svg missing, skip');
  process.exit(0);
}

await sharp(svg).resize(192, 192).png().toFile(join(root, 'pwa-192.png'));
await sharp(svg).resize(512, 512).png().toFile(join(root, 'pwa-512.png'));
await sharp(svg).resize(180, 180).png().toFile(join(root, 'apple-touch-icon.png'));
console.log('[pwa-icons] wrote pwa-192.png, pwa-512.png, apple-touch-icon.png');
