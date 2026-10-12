import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { jsonStore } from './persistence';
import { chainId } from './chain';
import { verifySocial } from './social';
import { socialPostId } from '../shared/model';
import { emptyWalletAuth, WalletAuthPolicy } from './wallet-auth-policy';
const store = jsonStore('.data/wallet-auth.json', emptyWalletAuth());
export const walletAuthEnabled = () => process.env.WALLET_AUTH_ENABLED === '1' && !!socialPostId(process.env.WALLET_AUTH_X_POST || '') && !!process.env.SOCIAL_DATA_API_KEY;
export function walletAuth() {
 const origin = new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:3001');
 if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Wallet sign-in is not configured yet. Use Privy for now.');
 return new WalletAuthPolicy(store.data, origin.origin, chainId, process.env.WALLET_AUTH_X_POST || '', store.save);
}
const router = Router();
router.use('/wallet-auth', rateLimit({ windowMs: 60000, limit: 12, message: { error: 'Wait a minute before trying wallet sign-in again.' } }), (_req, res, next) => {
 res.set('Cache-Control', 'no-store');
 if (!walletAuthEnabled()) { res.status(503).json({ error: 'Wallet sign-in is not configured yet. Use Privy for now.' }); return; }
 next();
});
function fail(res: any, e: unknown) { res.status(400).json({ error: e instanceof Error && !/0x[\da-f]{40}|https?:|signature=/i.test(e.message) && e.message.length < 180 ? e.message : 'Wallet verification failed. Connect again.' }); }
router.post('/wallet-auth/challenge', (req, res) => { try { res.json(walletAuth().challenge(String(req.body.wallet))); } catch (e) { fail(res, e); } });
router.post('/wallet-auth/login', (req, res) => { try { res.json(walletAuth().login(String(req.body.id), String(req.body.signature))); } catch (e) { fail(res, e); } });
router.post('/wallet-auth/link', rateLimit({ windowMs: 60000, limit: 4, message: { error: 'Wait a minute before trying wallet sign-in again.' } }), async (req, res) => {
 try {
  const token = String(req.body.linkToken || ''), url = String(req.body.url || '');
  if (!socialPostId(url)) throw new Error('Use a valid public X reply URL.');
  walletAuth().pending(token);
  const reply = await verifySocial(url, process.env.SOCIAL_DATA_API_KEY, fetch, true);
  res.json(walletAuth().link(token, reply));
 } catch (e) { fail(res, e); }
});
router.post('/wallet-auth/logout', (req, res) => { try { walletAuth().logout((req.headers.authorization || '').replace(/^Bearer /, '')); res.json({ ok: true }); } catch (e) { fail(res, e); } });
export default router;
