import { formatEther } from 'ethers';
import type { SponsoredTransaction } from './mission-transaction';
export interface GasQuote { gasLimit?: bigint; gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; }
interface Dependencies {
 balance: () => Promise<bigint>;
 estimateGas: (transaction: SponsoredTransaction) => Promise<bigint>;
 fees: () => Promise<{ gasPrice: bigint | null; maxFeePerGas: bigint | null; maxPriorityFeePerGas: bigint | null }>;
}
export class TransactionPreflightError extends Error {
 readonly code = 'PREFLIGHT_FAILED';
 constructor(message: string, readonly values?: Record<string, string>) { super(message); }
}
// Monad charges the requested gas limit. Use a modest margin, never a huge fallback.
// Sponsored zero-value actions must remain available to unfunded contributors.
export async function prepareMissionTransaction(tx: SponsoredTransaction, sponsored: boolean, d: Dependencies): Promise<GasQuote> {
 if (sponsored && tx.value === 0n) return {};
 const balance = await d.balance();
 if (balance < tx.value) throw new TransactionPreflightError(sponsored ? 'Not enough MON. Balance: {available} MON. Rewards require {required} MON. Gas is covered by Support Me.' : 'Not enough MON. Balance: {available} MON. Rewards require {required} MON, plus gas. Reduce the budget or add MON.', { available: formatEther(balance), required: formatEther(tx.value) });
 if (sponsored) return {};
 let estimate: bigint, fees: Awaited<ReturnType<Dependencies['fees']>>;
 try { [estimate, fees] = await Promise.all([d.estimateGas(tx), d.fees()]); }
 catch { throw new TransactionPreflightError('Could not estimate this transaction. Nothing was sent. Refresh the mission and try again.'); }
 const gasLimit = (estimate * 110n + 99n) / 100n;
 if (estimate <= 0n || gasLimit > 30_000_000n) throw new TransactionPreflightError('This transaction exceeds the supported gas limit. Nothing was sent.');
 const price = fees.maxFeePerGas ?? fees.gasPrice;
 if (price === null || price < 0n) throw new TransactionPreflightError('Could not quote the network fee. Nothing was sent. Try again.');
 const required = tx.value + gasLimit * price;
 if (balance < required) throw new TransactionPreflightError('Not enough MON. Balance: {available} MON. Required: {required} MON including maximum gas. Reduce the budget or add MON.', { available: formatEther(balance), required: formatEther(required) });
 return fees.maxFeePerGas !== null ? { gasLimit, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0n } : { gasLimit, gasPrice: price };
}
