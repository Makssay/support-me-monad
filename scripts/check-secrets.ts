import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
config({ override: true });
const keys = ['MAINNET_PRIVATE_KEY','SEED', 'MONAD_PRIVATE_KEY', 'MONAD_RPC_URL', 'OPENROUTER_API_KEY', 'SOCIAL_DATA_API_KEY', 'SOCIALDATA_API_KEY', 'PRIVY_APP_SECRET','DISCORD_CLIENT_SECRET','D1_GATEWAY_SECRET','SCHEDULER_SECRET','SOCIAL_VERIFIER_PRIVATE_KEY','COMMUNITY_ENCRYPTION_KEY'];
const secrets = keys.map(k => process.env[k]).filter((v): v is string => !!v && v.length > 10);
if(fs.existsSync('.data/cloud-config.json')){const cloud=JSON.parse(fs.readFileSync('.data/cloud-config.json','utf8'));for(const key of keys)if(typeof cloud[key]==='string'&&cloud[key].length>10)secrets.push(cloud[key]);}
if(fs.existsSync('.data/social-verifier.json'))secrets.push(JSON.parse(fs.readFileSync('.data/social-verifier.json','utf8')).privateKey);
// Generated testnet wallets stay private too; never print their keys.
for(const name of fs.existsSync('.data')?fs.readdirSync('.data'):[]){if(!/wallet.*\.json$/.test(name))continue;try{const collect=(value:any):void=>{if(value&&typeof value==='object'){if(typeof value.privateKey==='string')secrets.push(value.privateKey);for(const child of Object.values(value))collect(child);}};collect(JSON.parse(fs.readFileSync(path.join('.data',name),'utf8')));}catch{throw new Error('Cannot safely inspect private QA wallet storage.');}}
const skip = new Set(['node_modules', '.git', '.env', '.data', 'out', 'cache','.vercel','.wrangler']);
let count = 0; const hits: string[] = [];
function scan(dir: string) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (skip.has(e.name) || e.name.startsWith('.env')) continue; const p = path.join(dir, e.name); if (e.isDirectory()) scan(p); else if (/\.(?:json|ts|tsx|js|mjs|cjs|md|html|css|txt|log|svg|map)$/.test(p)) { const text = fs.readFileSync(p, 'utf8'); count++; if (secrets.some(s => text.includes(s))) hits.push(p); } } }
scan('.');
try { const ignored = execFileSync('git', ['check-ignore', '.env'], { encoding: 'utf8' }).trim(); if (ignored !== '.env') hits.push('.env is not ignored'); const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }); if (tracked.split(/\r?\n/).some(s => s.startsWith('.env') && s !== '.env.example')) hits.push('A secret env file is tracked'); } catch { hits.push('Git ignore check could not run'); }
if (hits.length) { console.error(JSON.stringify({ ok: false, paths: hits })); process.exitCode = 1; } else console.log(`Secret scan passed: ${count} source/build files checked, .env ignored, no configured secrets found.`);
