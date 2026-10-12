import { createSiweMessage } from 'viem/siwe';
export interface WalletLoginChallenge { id: string; wallet: string; origin: string; chainId: number; issued: number; expires: number; }
export function walletLoginMessage(c: WalletLoginChallenge) {
 const origin = new URL(c.origin);
 return createSiweMessage({ address: c.wallet as `0x${string}`, domain: origin.host, scheme: origin.protocol.slice(0, -1), uri: origin.origin, version: '1', chainId: c.chainId, nonce: c.id, issuedAt: new Date(c.issued), expirationTime: new Date(c.expires), statement: 'Sign in to Support Me. This does not transfer assets or approve spending.' });
}
