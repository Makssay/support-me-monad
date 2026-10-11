import { jsonStore, checkpoint, cloudStorage } from './persistence';
import { recordPublicIdentity } from './public-profiles';
import { PrivyClient } from '@privy-io/node';
import { Router, type Request, type RequestHandler } from 'express';
import fs from 'node:fs';
import { local } from './chain';
import { AccountError, enroll, ownsWallet, type IdentityUser, type Member } from './account-policy';
import { dynamicKeySet, identifyDynamic } from './dynamic-auth';
const dynamicEnvironment = (process.env.DYNAMIC_ENVIRONMENT_ID || '').trim();
const dynamicKeys = dynamicEnvironment ? dynamicKeySet(dynamicEnvironment) : undefined;
const dynamicAudiences = (process.env.DYNAMIC_ALLOWED_ORIGINS || 'https://support-me-monad.vercel.app,https://support-me-monad.support-me.workers.dev,http://127.0.0.1:3001').split(',').map(s => s.trim()).filter(Boolean);
const appId = process.env.PRIVY_APP_ID || '';
const client = appId && process.env.PRIVY_APP_SECRET ? new PrivyClient({ appId, appSecret: process.env.PRIVY_APP_SECRET, timeout: 10000, maxRetries: 0 }) : undefined;
const file = '.data/auth-accounts.json';
const store=jsonStore<Record<string,Record<string,Member>>>(file,{[appId]:{}});const stored=store.data;
const members = stored[appId] || (stored[appId] = {});
const sessions = new WeakMap<Request, { user: IdentityUser; member: Member }>();
async function identify(req: Request) {
 const provider = req.headers['x-auth-provider'] || 'privy';
 if (provider !== 'privy' && provider !== 'dynamic') throw new AccountError('INVALID_SESSION', 'Invalid sign-in provider.', 401);
 if (provider === 'privy' ? !client : !dynamicKeys) throw new AccountError('AUTH_UNAVAILABLE', 'Sign in is temporarily unavailable. Please retry.', 503);
 const match = /^Bearer (\S{1,8192})$/.exec(req.headers.authorization || '');
 if (!match) throw new AccountError('LOGIN_REQUIRED', 'Sign in to Support Me first.', 401);
 let user: IdentityUser;
 try {
  if (provider === 'dynamic') user = await identifyDynamic(match[1], dynamicEnvironment, dynamicAudiences, dynamicKeys!);
  else {
   const token = await client!.utils().auth().verifyAccessToken(match[1]);
   user = await client!.users()._get(token.user_id);
   if (user.id !== token.user_id) throw new Error();
  }
 } catch { throw new AccountError('INVALID_SESSION', 'Your sign-in expired. Sign in again.', 401); }
 const member = enroll(user, members);
 // No await between uniqueness check and atomic save: concurrent enrollments cannot reserve the same X ID.
 if (JSON.stringify(members[user.id]) !== JSON.stringify(member)) {
  members[user.id] = member; store.save();
 }
 recordPublicIdentity(user, member);
 sessions.set(req, { user, member });
 return { user, member };
}
export const requireMember: RequestHandler = async (req, res, next) => {
 // Only the existing isolated localhost QA mode bypasses Privy.
 if (local) { next(); return; }
 try { await identify(req); next(); }
 catch (e) { const error = e instanceof AccountError ? e : new AccountError('AUTH_UNAVAILABLE', 'Account verification is unavailable. Please retry.', 503); res.status(error.status).json({ error: error.message, code: error.code }); }
};
export function requireMemberWallet(req: Request, wallet: string) {
 if (local) return;
 const session = sessions.get(req);
 if (!session || !ownsWallet(session.user, wallet)) throw new AccountError('WALLET_MISMATCH', 'Use a wallet linked to your Support Me account.');
}
export function memberXId(req: Request) { return sessions.get(req)?.member.xId; }
const router = Router();
router.post('/auth/session', requireMember, (req, res) => {
 if (local) { res.json({ local: true }); return; }
 const { member, user } = sessions.get(req)!;
 res.set('Cache-Control', 'no-store').json({ xId: member.xId, username: member.username, backupEmail: user.linked_accounts.some(a => a.type === 'email' && typeof a.verified_at === 'number') });
});
export default router;
