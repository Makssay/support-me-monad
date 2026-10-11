import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AccountError, type IdentityUser } from './account-policy';

const api = 'https://app.dynamicauth.com/api/v0';
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function dynamicIssuer(environment: string) { return `app.dynamic.xyz/${environment}`; }
export function dynamicKeySet(environment: string) {
 if (!uuid.test(environment)) throw new Error('Invalid Dynamic environment ID');
 return createRemoteJWKSet(new URL(`${api}/sdk/${environment}/.well-known/jwks.json`), { timeoutDuration: 10000 });
}
export async function verifyDynamicToken(token: string, environment: string, audience: string[], key: JWTVerifyGetKey | CryptoKey | Uint8Array) {
 const { payload } = await jwtVerify(token, key as JWTVerifyGetKey, {
  issuer: dynamicIssuer(environment), audience, algorithms: ['RS256', 'ES256'], requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5
 });
 if (payload.environment_id !== environment || typeof payload.sub !== 'string' || !uuid.test(payload.sub)) throw new Error('Invalid Dynamic environment or subject');
 const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
 if (!scopes.includes('user:basic') || scopes.some(s => ['requiresAdditionalAuth', 'userDataForm', 'device:register'].includes(s))) throw new Error('Dynamic sign-in is incomplete');
 return payload;
}
// Only accept data fetched from Dynamic's authenticated user endpoint, never a client profile.
export function dynamicIdentity(profile: any, environment: string, subject: string): IdentityUser {
 if (profile?.id !== subject || profile.projectEnvironmentId !== environment || !Array.isArray(profile.verifiedCredentials)) throw new Error('Dynamic profile mismatch');
 const linked_accounts: IdentityUser['linked_accounts'] = [];
 for (const c of profile.verifiedCredentials) {
  if (c.format === 'oauth' && c.oauth_provider === 'twitter' && /^\d+$/.test(c.oauth_account_id || '')) {
   linked_accounts.push({ type: 'twitter_oauth', subject: c.oauth_account_id, username: c.oauth_username, name: c.oauth_display_name, profile_picture_url: c.oauth_account_photos?.[0], verified_at: 1 });
  } else if (c.format === 'email' && typeof c.email === 'string') {
   linked_accounts.push({ type: 'email', address: c.email, verified_at: 1 });
  } else if (c.format === 'blockchain' && (c.chain === 'EVM' || c.chain === 'eip155') && c.wallet_provider === 'embeddedWallet' && typeof c.embedded_wallet_id === 'string' && /^0x[\da-f]{40}$/i.test(c.address || '')) {
   linked_accounts.push({ type: 'wallet', address: c.address, chain_type: 'ethereum', wallet_client_type: 'dynamic', connector_type: 'embedded', verified_at: 1 });
  }
 }
 return { id: `dynamic:${environment}:${subject}`, linked_accounts };
}
export async function identifyDynamic(token: string, environment: string, audience: string[], key: JWTVerifyGetKey) {
 const claims = await verifyDynamicToken(token, environment, audience, key);
 const response = await fetch(`${api}/sdk/${environment}/users`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
 if (!response.ok) throw new AccountError('INVALID_SESSION', 'Your sign-in expired. Sign in again.', 401);
 return dynamicIdentity(await response.json(), environment, claims.sub!);
}
