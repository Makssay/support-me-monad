import 'dotenv/config';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
// One image at the discovered fixed price ($0.04). Never retry automatically.
const skill = 'C:/Users/User/.agents/skills/openrouter-images/scripts';
const output = `${process.cwd().replaceAll('\\', '/')}/public/support-hands.png`;
if (fs.existsSync(output)) { console.log('Brand asset already exists; no additional spend.'); }
else if (!process.env.OPENROUTER_API_KEY) { console.log('No OpenRouter key configured. Using the vector brand mark.'); }
else {
 const prompt = 'An editorial 3D clay illustration for a creator collaboration network: three playful rounded sculptural hands, one cobalt blue hand doing a peace sign, one butter yellow hand waving and one coral orange hand making a thumbs up. A few small blue and yellow four-point sparkle shapes. Soft tactile matte vinyl, confident sculptural composition, sophisticated modern social app art direction, isolated on a perfectly uniform pastel blue background #e7efff, strong soft shadows. No text, no letters, no logo, no UI, no money symbols. Hands clustered on the right and center, plenty of room around the objects, wide horizontal composition. Crisp studio rendering.';
 const child = spawn(process.execPath, [`${skill}/node_modules/tsx/dist/cli.mjs`, `${skill}/generate.ts`, prompt, '--model', 'bytedance-seed/seedream-4.5', '--resolution', '1K', '--aspect-ratio', '3:2', '--output', output], { cwd: skill, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
 let logs = ''; child.stdout.on('data', b => logs += b); child.stderr.on('data', b => logs += b);
 child.on('close', code => { if (code === 0) { const cost = logs.match(/Cost: \$[0-9.]+/)?.[0]; console.log(`Brand asset saved. Model: Seedream 4.5. ${cost || 'Listed price: $0.04 per image.'}`); } else { const reason = logs.match(/Error (?:401|402|404|429)/)?.[0] || (logs.includes('Unknown file extension') ? 'TypeScript runtime issue' : logs.includes('API key') ? 'API key configuration' : logs.includes('resolution') ? 'Resolution option' : logs.includes('fetch failed') ? 'Network connection' : 'Image endpoint unavailable'); console.log(`Image generation unavailable (${reason}); using vector brand asset. No automatic retries.`); } });
}
