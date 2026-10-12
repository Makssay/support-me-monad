export interface WalletLoginChallenge { id: string; wallet: string; origin: string; chainId: number; issued: number; expires: number; }
export function walletLoginMessage(c: WalletLoginChallenge) {
 return `${c.origin} wants you to sign in to Support Me.\nWallet: ${c.wallet}\nChain ID: ${c.chainId}\nNonce: ${c.id}\nIssued at: ${new Date(c.issued).toISOString()}\nExpiration: ${new Date(c.expires).toISOString()}\n\nThis signature signs you in. It does not transfer assets or approve spending.`;
}
