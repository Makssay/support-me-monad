import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const qaEnv = { ...process.env, AUTOMATION_QA: process.argv.includes('--automation')?'1':'', LOCAL_E2E: '1', TOKEN_FIXTURES:'1', COMMUNITY_FIXTURES:'1', SOCIAL_FIXTURES: '1', AI_FIXTURES:'1', MONAD_RPC_URL: 'http://127.0.0.1:8546', QA_RPC_URL: 'http://127.0.0.1:8546', MONAD_PRIVATE_KEY: '', OPENROUTER_API_KEY: '', SOCIAL_DATA_API_KEY: '', CONTRACT_ADDRESS: '', DEPLOYMENT_BLOCK: '', PORT: '3003', API_PORT: '3003', E2E_BASE_URL: 'http://127.0.0.1:5174' };
// Isolated QA must not inherit the production scheduler/storage switches.
Object.assign(qaEnv, { AUTOMATION_DISABLED: '0', STORAGE_MODE: 'local' });
const children: ChildProcess[] = [];
const anvilPath = path.join(os.homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'anvil.exe' : 'anvil');
function start(exe: string, args: string[], quiet = false) { const c = spawn(exe, args, { env: qaEnv, stdio: quiet ? 'ignore' : 'inherit', windowsHide: true }); children.push(c); return c; }
function run(args: string[]) { return new Promise<void>((resolve, reject) => { const c = start(process.execPath, args); c.on('error', reject); c.on('exit', code => code === 0 ? resolve() : reject(new Error('QA command failed'))); }); }
async function ready(url: string, rpc = false) { for (let i = 0; i < 60; i++) { try { const r = await fetch(url, rpc ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) } : {}); if (r.ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('QA service not ready'); }
function stop() { for (const c of children.reverse()) { if (!c.pid || c.exitCode !== null) continue; try { if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); else c.kill('SIGTERM'); } catch {} } }
process.on('SIGINT', () => { stop(); process.exit(1); });
try {
 console.log('Starting isolated Anvil QA network and two public development accounts.');
 start(fs.existsSync(anvilPath) ? anvilPath : 'anvil', ['--port', '8546', '--chain-id', '31337', '--silent'], true); await ready(qaEnv.QA_RPC_URL, true);
 await run(['node_modules/tsx/dist/cli.mjs', 'scripts/local-setup.ts']);
 start(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts']); await ready('http://127.0.0.1:3003/api/config');
 start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort']); await ready(qaEnv.E2E_BASE_URL);
 await run(['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2).filter(a=>a!=='--automation')]);
} catch { console.error('Browser QA failed. Review the test report above.'); process.exitCode = 1; } finally { stop(); }

