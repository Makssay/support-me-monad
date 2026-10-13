import { Contract, Interface, type ContractRunner, type TransactionReceipt, type InterfaceAbi } from 'ethers';
import type { GasQuote } from './transaction-preflight';
import abi from '../shared/abi.json';
import { CHAIN_ID } from '../shared/model';

export interface SponsoredTransaction { to: string; data: string; value: bigint; chainId: number; }
export interface MissionTransactionDependencies {
  contractAddress: string;
  chainId: number;
  method: string;
  abi?: InterfaceAbi;
  args: unknown[];
  value?: bigint;
  nativeTransfer?: boolean;
  sendSponsored?: (transaction: SponsoredTransaction) => Promise<string>;
  preflight?: (transaction: SponsoredTransaction, sponsored: boolean) => Promise<GasQuote>;
  getSigner: () => Promise<ContractRunner>;
  waitForReceipt: (hash: string) => Promise<TransactionReceipt | null>;
  onSent: (hash: string) => void;
}

// Sponsored requests bypass the EOA gas-balance check. Never retry a failed or
// timed-out sponsored request as a user-paid transaction: it may already be mined.
export async function sendMissionTransaction(d: MissionTransactionDependencies) {
  if (d.sendSponsored && d.chainId !== CHAIN_ID) throw new Error('Sponsorship is restricted to Monad Testnet.');
  const transaction = { to: d.contractAddress, data: d.nativeTransfer ? '0x' : new Interface(d.abi||abi).encodeFunctionData(d.method, d.args), value: d.value ?? 0n, chainId: d.chainId };
  const quote = await d.preflight?.(transaction, !!d.sendSponsored) ?? {};
  let receipt: TransactionReceipt | null;
  if (d.sendSponsored) {
    if (d.chainId !== CHAIN_ID) throw new Error('Sponsorship is restricted to Monad Testnet.');
    const data = transaction.data;
    const hash = await d.sendSponsored({ to: d.contractAddress, data, value: d.value ?? 0n, chainId: d.chainId });
    d.onSent(hash);
    receipt = await d.waitForReceipt(hash);
  } else {
    const signer=await d.getSigner();
    if(d.nativeTransfer&&!signer.sendTransaction)throw new Error('Wallet cannot send transactions.');
    const contract = d.nativeTransfer?undefined:new Contract(d.contractAddress, d.abi||abi, signer);
    const tx = d.nativeTransfer ? await signer.sendTransaction!({...transaction,...quote}) : await contract![d.method](...d.args, { ...quote, ...(d.value === undefined ? {} : { value: d.value }) });
    d.onSent(tx.hash);
    receipt = await tx.wait(1, 90000);
  }
  if (!receipt || receipt.status !== 1) throw Object.assign(new Error('Transaction was not confirmed successfully.'), { receipt });
  return receipt;
}
