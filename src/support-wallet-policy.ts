export interface WalletIdentity { type: string; chainType?: string; walletClientType?: string; connectorType?: string; address?: string; }
export function embeddedAddress(accounts: WalletIdentity[]): string | undefined {
 return accounts.find(a => a.type === 'wallet' && a.chainType === 'ethereum' && a.walletClientType === 'privy' && a.connectorType === 'embedded')?.address;
}
// Remove legacy external links only after an embedded wallet and another login method exist.
export function legacyWalletsToUnlink(accounts: WalletIdentity[], admitted: boolean): string[] {
 if (!admitted || !embeddedAddress(accounts) || !accounts.some(a => a.type === 'twitter_oauth' || a.type === 'email')) return [];
 return accounts.flatMap(a => a.type === 'wallet' && a.chainType === 'ethereum' && a.connectorType !== 'embedded' && a.walletClientType !== 'privy' && a.address ? [a.address] : []);
}
