import {requirePaidService} from './paid-services';
import rewardTokenRoutes from './reward-tokens';
import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { verifyMessage } from 'ethers';
import path from 'node:path';
import fs from 'node:fs';
import { config, contract, contractAddress, aiControllerAddress, chainId, provider, snapshot, saveVerification, verificationFor, invalidate, local, creationFees, version } from './chain';
import aiRoutes from './ai-routes';
import communityRoutes from './community';
import { publicConfig } from './chain';
import { verificationMessage, sameAddress, safeJson, contributionDefaults } from '../shared/model';
import socialRoutes, { socialLookup } from './social-routes';
import authRoutes, { requireMember, requireMemberWallet } from './auth';
import { startAutomation } from './automation';
export const app = express();
if(process.env.VERCEL) app.set('trust proxy',1);
app.disable('x-powered-by'); app.use(express.json({ limit: '600kb' }));
app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'strict-origin-when-cross-origin'); res.set('X-Frame-Options', 'DENY'); next(); });
// API keys and RPC URLs never appear in responses, errors or request logs.
app.use('/api', rateLimit({ windowMs: 60000, limit: local ? 2000 : 240, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Try again in a minute.' } }));
app.get('/api/config', (_req, res) => res.json(publicConfig()));
app.use('/api', authRoutes);
app.use('/api', rewardTokenRoutes);
app.get('/api/state', async (_req, res) => { try { res.json(await snapshot()); } catch { res.status(503).json({ error: 'Monad is unavailable. Please retry in a moment.' }); } });
app.post('/api/refresh', (_req, res) => { invalidate(); res.json({ ok: true }); });
const rpcMethods = new Set(['eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_estimateGas', 'eth_getBalance', 'eth_getTransactionCount', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_getBlockByNumber', 'eth_feeHistory']);
app.post('/api/rpc', async (req, res) => {
  const batch = Array.isArray(req.body) ? req.body : [req.body];
  if (batch.length > 12) { res.status(400).json({ error: 'Batch too large' }); return; }
  const results = [];
  for (const item of batch) {
    if (!item || !rpcMethods.has(item.method) || !Array.isArray(item.params)) { results.push({ jsonrpc: '2.0', id: item?.id ?? null, error: { code: -32601, message: 'Method not allowed' } }); continue; }
    if (['eth_call', 'eth_estimateGas'].includes(item.method) && !sameAddress(item.params[0]?.to, contractAddress)&&!sameAddress(item.params[0]?.to,aiControllerAddress)) { results.push({ jsonrpc: '2.0', id: item.id, error: { code: -32602, message: 'Contract not allowed' } }); continue; }
    try { const result = await provider.send(item.method, item.params); results.push({ jsonrpc: '2.0', id: item.id, result }); }
    catch { results.push({ jsonrpc: '2.0', id: item.id, error: { code: -32000, message: 'Request failed. Check transaction and testnet balance.' } }); }
  }
  res.json(Array.isArray(req.body) ? results : results[0]);
});
app.post('/api/contributions/:id/verify', requireMember, rateLimit({ windowMs: 60000, limit: 12, message: { error: 'Wait a minute before another social check.' } }), async (req, res) => {
  try {
    if (!contract) { res.status(503).json({ error: 'Contract is not deployed yet.' }); return; }
    const id = Number(req.params.id); const { timestamp, signature } = req.body;
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 300000 || typeof signature !== 'string') { res.status(400).json({ error: 'Invalid or expired verification request.' }); return; }
    const signer = verifyMessage(verificationMessage(id, contractAddress, chainId, timestamp), signature);
    requireMemberWallet(req, signer);
    const c = await contract.contributions(id); const m = await contract.missions(c.missionId);
    if (!sameAddress(signer, m.creator)) { res.status(403).json({ error: 'Only the mission creator can run verification.' }); return; }
    const existing = verificationFor(id);
    if (existing?.status === 'verified') { res.json(existing); return; }
    const metadata = safeJson(c.metadata, contributionDefaults);
    const manualOnly=version>=5&&creationFees&&Number(await creationFees.tiers(contractAddress,c.missionId))===0;
    if(manualOnly||!metadata.socialUrl){const result={status:'manual' as const,checkedAt:new Date().toISOString(),postUrl:metadata.socialUrl,note:'Review the work and authorship manually. Automatic X verification was not included.'};saveVerification(id,result);invalidate();res.json(result);return;}
    await requirePaidService(Number(c.missionId),1);const result = await socialLookup(metadata.socialUrl); saveVerification(id, result); invalidate(); res.json(result);
  } catch { res.status(400).json({ error: 'Could not verify this request. Reconnect the creator wallet and try again.' }); }
});
app.use('/api', socialRoutes);
app.use('/api', aiRoutes);
app.use('/api',communityRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
if (fs.existsSync('dist/index.html')) {
  app.use(compression());
  app.use(express.static(path.resolve('dist'), { dotfiles: 'deny' }));
  // A relative file with an explicit root also works inside parent folders such as .доп.
  app.get('/{*path}', (req, res) => { if (req.path.split('/').some(p => p.startsWith('.'))) { res.status(404).end(); return; } res.sendFile('index.html', { root: path.resolve('dist') }); });
}
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { void err; res.status(400).json({ error: 'Invalid request.' }); });
const port = Number(process.env.PORT || 3001);
if(!process.env.VERCEL){
 app.listen(port, '127.0.0.1', () => console.log(`Support Me API ready on http://127.0.0.1:${port}. ${contractAddress ? 'Contract connected.' : 'Run contract:deploy to enable missions.'}`));
 startAutomation();
}
