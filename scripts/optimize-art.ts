import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const directory = path.resolve('public/art');
fs.mkdirSync('test-results', { recursive: true });
for (const name of ['hero', 'memes', 'feedback', 'testing', 'social', 'launch']) {
 const source = path.join(directory, `${name}.jpg`);
 if (!fs.existsSync(source)) throw new Error(`Missing illustration: ${name}`);
 await sharp(source).resize({ width: name === 'hero' ? 960 : 640, withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(directory, `${name}.webp`));
 console.log(`${name}.webp: ${Math.round(fs.statSync(path.join(directory, `${name}.webp`)).size / 1024)} KB`);
}
const tiles = await Promise.all(['hero', 'memes', 'feedback', 'testing', 'social', 'launch'].map(name => sharp(path.join(directory, `${name}.webp`)).resize(420, 300, { fit: 'contain', background: '#faf8f5' }).png().toBuffer()));
await sharp({ create: { width: 1260, height: 600, channels: 3, background: '#faf8f5' } }).composite(tiles.map((input, i) => ({ input, left: i % 3 * 420, top: Math.floor(i / 3) * 300 }))).png().toFile(path.resolve('test-results/brand-assets.png'));
