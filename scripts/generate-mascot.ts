import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// Prefer the updated local key over a stale key inherited by the terminal.
config({ override: true });
const skill = 'C:/Users/User/.agents/skills/openrouter-images/scripts';
const directory = path.resolve('public/art'); fs.mkdirSync(directory, { recursive: true });
const model = 'bytedance-seed/seedream-4.5';
const style = 'Original hand-drawn comic sticker illustration for a creator contribution community. Thick slightly irregular near-black ink outlines, confident flat lilac and violet fills, subtle cel shading, buttery yellow accents, tiny four-point stars. Friendly short chubby violet alien astronaut mascot with a rounded hood, glossy black face window and two white oval eyes, wearing headphones, oversized sneakers, little heart patch. Charming indie streetwear zine aesthetic, polished 2D illustration, absolutely not 3D or plastic. No text, no lettering, no watermarks, no UI. Uniform warm white background #faf8f5. Clean crisp silhouette, generous margins.';
const assets = [
 ['hero', 'The mascot sits cross-legged working on a violet laptop and raises a hand in a peace sign. A small flag with a simple white diamond, a yellow heart and two ink stars around the character. Full body fills most of the square composition.'],
 ['memes', 'Wide landscape illustration. The same mascot wearing oversized black sunglasses, laughing with two little yellow star sparks and a lilac speech bubble containing a simple smiling face. Background pastel buttery yellow.'],
 ['feedback', 'Wide landscape illustration. The same mascot holding an oversized paper clipboard with three violet lines and a yellow pencil, carefully reviewing an idea. Background pale lavender.'],
 ['testing', 'Wide landscape illustration. The same mascot looking through a large magnifying glass at a friendly little beetle, with a laptop behind them. Background pale sage green.'],
 ['social', 'Wide landscape illustration. The same mascot holding a small yellow megaphone, with illustrated hearts and paper airplanes. Background pale peach.'],
 ['launch', 'Wide landscape illustration. The same mascot riding a small violet and yellow cartoon rocket surrounded by star sparks. Background pale lilac.']
] as const;
async function run(script: string, args: string[]) { return await new Promise<number>((resolve, reject) => {
 const child = spawn(process.execPath, [`${skill}/node_modules/tsx/dist/cli.mjs`, `${skill}/${script}.ts`, ...args], { cwd: skill, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
 let logs = ''; child.stdout.on('data', b => logs += b); child.stderr.on('data', b => logs += b); child.on('error', () => reject(new Error('Image runtime unavailable')));
 child.on('close', code => { if (code !== 0) { const safe = logs.split(process.env.OPENROUTER_API_KEY || 'REDACTED').join('[redacted]').replace(/sk-[\w-]+/g, '[redacted]'); const reason = safe.match(/Error[^\n]*/)?.[0]?.slice(0, 500) || 'Image generation runtime failed'; reject(new Error(reason)); } else { const amount = Number(logs.match(/Cost: \$([0-9.]+)/)?.[1] || 0.04); resolve(amount); } });
 }); }
if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY missing');
const creditsPath = path.join(directory, 'credits.json');
let total = fs.existsSync(creditsPath) ? Number(JSON.parse(fs.readFileSync(creditsPath, 'utf8')).totalCostUsd) : assets.filter(([name]) => fs.existsSync(path.join(directory, `${name}.jpg`))).length * 0.04;
function recordCost() { fs.writeFileSync(creditsPath, JSON.stringify({ model, totalCostUsd: Number(total.toFixed(2)), assets: assets.filter(([name]) => fs.existsSync(path.join(directory, `${name}.jpg`))).map(([name]) => name), generatedFor: 'Support Me original comic mascot' }, null, 2)); }
try { for (const [name, scene] of assets) {
 const output = path.join(directory, `${name}.jpg`); if (fs.existsSync(output)) { console.log(`${name}: existing asset retained`); continue; }
 if (total + 0.04 > 0.30) throw new Error('Asset budget reached');
 const hero = path.join(directory, 'hero.jpg');
 const args = name === 'hero' ? [style + ' ' + scene] : [hero, 'Use exactly the same original mascot character and hand-drawn style from the supplied reference. ' + style + ' ' + scene];
 total += await run(name === 'hero' ? 'generate' : 'edit', [...args, '--model', model, '--resolution', '2K', '--aspect-ratio', name === 'hero' ? '1:1' : '3:2', '--output', output]);
 recordCost();
 console.log(`${name}: saved. Model ${model}. Reported/listed cost $${total.toFixed(2)} total.`);
 } recordCost();
} catch (e: any) { console.error(e.message); process.exitCode = 1; }
