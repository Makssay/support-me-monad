import { hexToString, type Hex } from 'viem';
import type { Eip1193Provider } from 'ethers';

// Embedded MPC wallets use local viem accounts. Forwarding personal_sign to
// their HTTP transport would incorrectly ask the public RPC to sign for them.
export function dynamicWalletProvider(wallet: {
 address: string;
 getNetwork: () => Promise<string | number | undefined>;
 switchNetwork: (id: number) => Promise<void>;
 signMessage: (message: string) => Promise<string | undefined>;
 getWalletClient: () => Promise<any>;
 getPublicClient: () => Promise<any>;
}): Eip1193Provider {
 return { request: async ({ method, params }) => {
  const args = Array.isArray(params) ? params : [];
  if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet.address];
  if (method === 'eth_chainId') return `0x${Number(await wallet.getNetwork()).toString(16)}`;
  if (method === 'wallet_switchEthereumChain') { await wallet.switchNetwork(Number(args[0]?.chainId)); return null; }
  if (method === 'personal_sign') {
   if (typeof args[1] !== 'string' || args[1].toLowerCase() !== wallet.address.toLowerCase()) throw new Error('Wallet address mismatch');
   const signature = await wallet.signMessage(hexToString(args[0] as Hex));
   if (!signature) throw new Error('Signature rejected');
   return signature;
  }
  if (method === 'eth_sendTransaction') {
   const tx = args[0];
   if (tx?.from?.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('Wallet address mismatch');
   const client = await wallet.getWalletClient();
   const quantities: Record<string, bigint> = {};
   for (const field of ['gas', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas']) if (tx[field] !== undefined) quantities[field] = BigInt(tx[field]);
   return client.sendTransaction({ account: client.account, chain: client.chain, to: tx.to, data: tx.data, value: BigInt(tx.value || 0), ...quantities });
  }
  const client = await wallet.getPublicClient();
  return client.request({ method, params });
 } };
}
