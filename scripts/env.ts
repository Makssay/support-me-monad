import 'dotenv/config';
import { JsonRpcProvider, Wallet } from 'ethers';
import { CHAIN_ID, PUBLIC_RPC } from '../shared/model';
export const rpcUrl = process.env.MONAD_RPC_URL || PUBLIC_RPC;
export function provider() { return new JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 }); }
export async function checkedProvider() { const p = provider(); const net = await p.getNetwork(); const local = process.env.LOCAL_E2E === '1' && new URL(rpcUrl).hostname === '127.0.0.1'; if (Number(net.chainId) !== CHAIN_ID && !(local && Number(net.chainId) === 31337)) throw new Error('Wrong chain. Monad Testnet required.'); return p; }
export function deployer(p: JsonRpcProvider) { if (!process.env.MONAD_PRIVATE_KEY) throw new Error('MONAD_PRIVATE_KEY is missing.'); return new Wallet(process.env.MONAD_PRIVATE_KEY, p); }
export function safeFailure(step: string) { console.error(`${step} failed. Check configuration, connection and testnet balance. Provider details are suppressed to protect secrets.`); process.exitCode = 1; }
