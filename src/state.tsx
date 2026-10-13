import { setWalletOperationPending } from './deployment-recovery';
import { refreshAfterReceipt } from './refresh-after-receipt';
import { coalesceLoad } from './coalesce-load';
import { startSnapshotPolling } from './snapshot-polling';
import { snapshotLoadError } from './snapshot-status';
import { erc20Abi, type RewardAsset } from '../shared/rewards';
import { tokenTransferAbi, TokenTransferError, validateTokenTransfer } from './token-transfer';
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { BrowserProvider, Contract, formatEther, type Eip1193Provider, type TransactionReceipt } from 'ethers';
import { prepareMissionTransaction, TransactionPreflightError } from './transaction-preflight';
import { sendMissionTransaction } from './mission-transaction';
import aiAbi from '../shared/ai-abi.json';
import gateAbi from '../shared/community-abi.json';
import { PUBLIC_RPC, shortAddress, type Snapshot, type AppConfig } from '../shared/model';
interface Wallet extends Eip1193Provider { on?: (event: string, listener: (...args: any[]) => void) => void; removeListener?: (event: string, listener: (...args: any[]) => void) => void; providers?: Wallet[]; isMetaMask?: boolean; isRabby?: boolean; }
declare global { interface Window { ethereum?: Wallet; } }
export interface AuthWallet { address: string; label: string; getProvider: () => Promise<Eip1193Provider>; switchChain: (id: number) => Promise<void>; sendSponsored?: (transaction: { to: string; data: string; value: bigint; chainId: number }) => Promise<string>; }
export interface AuthSession { provider?: 'privy' | 'dynamic' | 'wallet'; selectPrivy?: () => void; selectExternal?: () => void; signInContent?: ReactNode; loginLegacy?: () => void; ready: boolean; authenticated: boolean; wallets: AuthWallet[]; login: () => void; logout: () => Promise<void>; connectWallet: () => void; creatingWallet?: boolean; loginBackup?: () => void; linkX?: () => void; linkEmail?: () => void; retry?: () => void; getAccessToken?: () => Promise<string | null>; member?: { xId: string; username: string; backupEmail: boolean }; accountError?: string; cleanupError?: string; needsX?: boolean; }
interface Notice { kind: 'success' | 'error' | 'pending'; text: string; tx?: string; values?: Record<string, string>; }
interface Context { tokenBalance: (asset: RewardAsset) => Promise<bigint>; sendToken: (asset: RewardAsset, recipient: string, amount: string, sender: string) => Promise<TransactionReceipt | undefined>; state?: Snapshot; config?: AppConfig; loading: boolean; error: string; address: string; balance: string; wrongChain: boolean; walletOpen: boolean; setWalletOpen: (open: boolean) => void; connect: (wallet?: Wallet) => Promise<void>; disconnect: () => void; refresh: () => Promise<void>; transact: (label: string, method: string, args: unknown[], value?: bigint) => Promise<TransactionReceipt | undefined>; sign: (message: string) => Promise<string>; apiFetch: (url: string, init?: RequestInit) => Promise<Response>; notice?: Notice; clearNotice: () => void; busy: boolean; gasSponsored: boolean; auth?: AuthSession; chooseWallet: (address: string) => Promise<void>; lockPayoutWallet: () => () => void; }
const AppContext = createContext<Context>(null!);
export function useApp() { return useContext(AppContext); }
export function AppProvider({ children, auth }: { children: ReactNode; auth?: AuthSession }) {
 const [state, setState] = useState<Snapshot>(); const [config, setConfig] = useState<AppConfig>(); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
 const [address, setAddress] = useState(''); const [balance, setBalance] = useState(''); const [wrongChain, setWrongChain] = useState(false); const [walletOpen, setWalletOpen] = useState(false); const [notice, setNotice] = useState<Notice>(); const [busy, setBusy] = useState(false);
 const selected = useRef<Wallet | undefined>(undefined); const pending = useRef(false); const payoutLocks = useRef(0); const connected = useRef('');
 const [preferred, setPreferred] = useState(() => localStorage.getItem('support.privy-wallet') || '');
 const currentAuth = useRef(auth); currentAuth.current = auth;
 const authWalletKey = auth?.wallets.map(w => w.address.toLowerCase()).join(',');
 const loadRead = useRef<(() => Promise<void>) | undefined>(undefined);
 const lastSnapshot = useRef<Snapshot | undefined>(undefined);
 if (!loadRead.current) loadRead.current = coalesceLoad(async () => {
  try {
   const r = await fetch('/api/state', {signal:AbortSignal.timeout(25000)});
   const data: Snapshot & {error?:string} = await r.json();
   if (!r.ok || !data.config || !Array.isArray(data.missions)) throw new Error(data.error);
   if (!lastSnapshot.current || Date.parse(lastSnapshot.current.updatedAt)<=Date.parse(data.updatedAt)) lastSnapshot.current=data;
   setState(lastSnapshot.current);setConfig(lastSnapshot.current.config);
   setError(snapshotLoadError(lastSnapshot.current));
  } catch { setError(snapshotLoadError(lastSnapshot.current, true)); }
  finally { setLoading(false); }
 });
 function load() { return loadRead.current!(); }
 async function walletBalance(a = connected.current) { const wallet = selected.current; if (!a || !wallet) return; try { const p = new BrowserProvider(wallet); const [net, amount] = await Promise.all([p.getNetwork(), p.getBalance(a)]); if (selected.current !== wallet || connected.current !== a) return; setWrongChain(Number(net.chainId) !== config?.chainId); setBalance(formatEther(amount)); } catch { if (selected.current === wallet && connected.current === a) setBalance(''); } }
 async function refresh() {
   // Cache invalidation is best-effort. A failed hint must not undo a confirmed receipt.
   try { await fetch('/api/refresh', { method: 'POST' }); }
   catch {
     // Retry only the cache hint once, never the wallet transaction. This avoids a stale not-found page.
     await fetch('/api/refresh', { method: 'POST' }).catch(() => undefined);
   }
   await load(); await walletBalance();
 }
 useEffect(() => { void fetch('/api/config').then(r => r.json()).then(setConfig).catch(() => {}); void load(); return startSnapshotPolling(load,()=>!pending.current); }, []);
 useEffect(() => {
   if (auth || !config || selected.current || !window.ethereum || !localStorage.getItem('support.wallet')) return;
   const remembered = localStorage.getItem('support.wallet');
   const wallets = window.ethereum.providers || [window.ethereum];
   const wallet = wallets.find(w => remembered === 'rabby' ? w.isRabby : remembered === 'metamask' ? w.isMetaMask : true) || wallets[0];
   // Restore already-authorized accounts without requesting permissions or signing.
   let cancelled = false;
   void wallet.request({ method: 'eth_accounts' }).then(async (result: unknown) => {
     const a = (result as string[])[0]; if (!a || cancelled) return;
     selected.current = wallet; connected.current = a; setAddress(a);
     const p = new BrowserProvider(wallet); setWrongChain(Number((await p.getNetwork()).chainId) !== config.chainId); setBalance(formatEther(await p.getBalance(a)));
   }).catch(() => {});
   return () => { cancelled = true; };
 }, [config?.chainId]);
 useEffect(() => {
   if (!auth) return;
   if (!auth.ready || !auth.authenticated) { selected.current = undefined; connected.current = ''; setAddress(''); setBalance(''); setWrongChain(false); return; }
   const wallet = auth.wallets[0];
   localStorage.removeItem('support.privy-wallet'); localStorage.removeItem('support.wallet');
   let cancelled = false;
   // Clear the prior account while a new provider is resolving; never sign as a stale account.
   selected.current = undefined; connected.current = ''; setAddress(''); setBalance('');
   if (wallet) void wallet.getProvider().then(async p => {
     if (cancelled) return; selected.current = p; connected.current = wallet.address; setAddress(wallet.address);
     await walletBalance(wallet.address);
   }).catch(() => { if (!cancelled) setNotice({ kind: 'error', text: 'Your wallet could not open. Sign out and try again.' }); });
   return () => { cancelled = true; };
 // SDK modal updates replace wallet wrapper objects. Reconnect only when the
 // actual account changes; tearing down the provider can interrupt confirmation.
 }, [auth?.ready, auth?.authenticated, authWalletKey, auth?.member?.xId, preferred, config?.chainId]);
 async function chooseWallet(a: string) { if (pending.current) return; localStorage.setItem('support.privy-wallet', a); setPreferred(a); }
 useEffect(() => { if (!selected.current) return; const wallet = selected.current; const accounts = (a: string[]) => { if (payoutLocks.current) return; const next = a[0] || ''; setAddress(next); connected.current = next; void walletBalance(next); }; const chain = () => { void walletBalance(); }; wallet.on?.('accountsChanged', accounts); wallet.on?.('chainChanged', chain); void walletBalance(); return () => { wallet.removeListener?.('accountsChanged', accounts); wallet.removeListener?.('chainChanged', chain); }; }, [address, config?.chainId]);
 function lockPayoutWallet() { payoutLocks.current++; let released = false; return () => { if (!released) { released = true; payoutLocks.current--; void walletBalance(); } }; }
 async function network(wallet: Wallet) { if (!config) throw new Error('Network configuration is loading.'); const current = Number(await wallet.request({ method: 'eth_chainId' })); if (current !== config.chainId) { const privyWallet = currentAuth.current?.wallets.find(w => w.address.toLowerCase() === connected.current.toLowerCase()); if (privyWallet) { await privyWallet.switchChain(config.chainId); } else { try { await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${config.chainId.toString(16)}` }] }); } catch (e: any) { if (e.code !== 4902) throw e; await wallet.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${config.chainId.toString(16)}`, chainName: config.chainId===143?'Monad':'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: [config.publicRpc||PUBLIC_RPC], blockExplorerUrls: [config.explorer] }] }); await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${config.chainId.toString(16)}` }] }); } } } setWrongChain(false); }
 async function connect(wallet = window.ethereum) {
   if (auth) {
     if (!auth.ready) return;
     if (!auth.authenticated) { if (auth.provider === 'wallet') setWalletOpen(true); else { setWalletOpen(false); auth.login(); } return; }
     if (selected.current) { try { await network(selected.current); await walletBalance(); } catch { setNotice({ kind: 'error', text: 'Switch to Monad Testnet in your wallet and retry.' }); } }
     return;
   }
   if (!wallet) { setWalletOpen(true); return; }
   try { await network(wallet); const accounts = await wallet.request({ method: 'eth_requestAccounts' }) as string[]; selected.current = wallet; connected.current = accounts[0] || ''; localStorage.setItem('support.wallet', wallet.isRabby ? 'rabby' : wallet.isMetaMask ? 'metamask' : 'browser'); setAddress(connected.current); setWalletOpen(false); const p = new BrowserProvider(wallet); setBalance(formatEther(await p.getBalance(connected.current))); }
   catch { setNotice({ kind: 'error', text: 'Connection was not completed. Open your wallet and try again.' }); }
 }
 function disconnect() { if (pending.current) return; selected.current = undefined; connected.current = ''; localStorage.removeItem('support.wallet'); localStorage.removeItem('support.privy-wallet'); setPreferred(''); setAddress(''); setBalance(''); setWrongChain(false); if (auth) void auth.logout().catch(() => setNotice({ kind: 'error', text: 'Sign out did not complete. Please retry.' })); }
 async function sign(message: string) { const wallet = selected.current; const account = connected.current; if (!wallet || !account) throw new Error('Connect your wallet first.'); await network(wallet); if (wallet !== selected.current || account !== connected.current) throw new Error('Account changed. Retry.'); return (await new BrowserProvider(wallet).getSigner(account)).signMessage(message); }
 async function apiFetch(url: string, init: RequestInit = {}) {
   if (!url.startsWith('/api/') || url.startsWith('//')) throw new Error('Invalid API destination.');
   const headers = new Headers(init.headers);
   if (currentAuth.current) { const token = await currentAuth.current.getAccessToken?.(); if (!token) throw new Error('Sign in again to continue.'); headers.set('Authorization', `Bearer ${token}`); headers.set('X-Auth-Provider', currentAuth.current.provider || 'privy'); }
   return fetch(url, { ...init, headers, redirect: 'error' });
 }
 const gasSponsored = !!((auth?.provider === 'dynamic' ? config?.dynamicGasSponsorship : config?.gasSponsorship) && auth?.wallets.find(w => w.address.toLowerCase() === address.toLowerCase())?.sendSponsored);
 async function tokenBalance(asset: RewardAsset) {
   const wallet = selected.current, account = connected.current;
   if (!wallet || !account || !config || asset.chainId !== config.chainId) throw new TokenTransferError('This token is not available on the selected network.');
   const provider = new BrowserProvider(wallet);
   if (Number((await provider.getNetwork()).chainId) !== asset.chainId) throw new TokenTransferError('Switch to Monad Testnet');
   const token = new Contract(asset.address, tokenTransferAbi, provider);
   const [amount, decimals] = await Promise.all([token.balanceOf(account), token.decimals()]);
   if (Number(decimals) !== asset.decimals) throw new TokenTransferError('Token decimals could not be verified.');
   if (selected.current !== wallet || connected.current !== account) throw new TokenTransferError('Account changed. Retry.');
   return amount as bigint;
 }
 async function sendToken(asset: RewardAsset, recipient: string, amount: string, sender: string) {
   if (sender.toLowerCase() !== connected.current.toLowerCase()) return;
   return transact('Token transfer', 'sendWalletToken', [asset, recipient, amount, sender]);
 }
 async function transact(label: string, method: string, args: unknown[], value?: bigint) {
   if (!connected.current || !selected.current) { setWalletOpen(true); return; }
   if (!config?.contractAddress) { setNotice({ kind: 'error', text: 'Missions are not available until the contract is deployed.' }); return; }
   if (pending.current) return;
   pending.current = true; setBusy(true); setWalletOperationPending(true);
   const wallet = selected.current; const account = connected.current;
   let sentHash = '';
   // Privy can wait for All Done after mining. Elapsed time alone is not a failure signal.
   const authWallet = currentAuth.current?.wallets.find(w => w.address.toLowerCase() === account.toLowerCase());
   const sponsored = !!((currentAuth.current?.provider === 'dynamic' ? config.dynamicGasSponsorship : config.gasSponsorship) && authWallet?.sendSponsored);
   try {
     await network(wallet);
     if (wallet !== selected.current || account !== connected.current) throw new Error('Account changed. Retry.');
     setNotice({ kind: 'pending', text: `Confirm ${label.toLowerCase()} in your wallet.${sponsored ? ' Support Me covers gas.' : ''}` });
     const provider = new BrowserProvider(wallet);
     const transferring = method === 'sendWalletToken';
     let transfer: ReturnType<typeof validateTokenTransfer> | undefined;
     if (transferring) {
       if (String(args[3]).toLowerCase() !== account.toLowerCase()) throw new TokenTransferError('Account changed. Retry.');
       const asset = args[0] as RewardAsset;
       transfer = validateTokenTransfer(asset, config.chainId, account, String(args[1]), String(args[2]), await tokenBalance(asset));
       const ok = await new Contract(transfer.token, tokenTransferAbi, await provider.getSigner(account)).transfer.staticCall(transfer.to, transfer.units);
       if (ok === false) throw new TokenTransferError('The token refused this transfer.');
     }
     const assertCurrent = async () => {
       if (wallet !== selected.current || account !== connected.current || Number(await wallet.request({ method: 'eth_chainId' })) !== config.chainId) throw new TokenTransferError('Account changed. Retry.');
     };
     const controlled=['createGatedContest','createContest','createTokenContest','settleContest','cancelOrRefund','withdrawAITokenCredit','withdrawAICredit'].includes(method);
     if(controlled&&!config.aiController)throw new Error('AI controller unavailable.');
     const communityMethod=['authorizeCommunity','finalizeCommunity','requestHolderSnapshot'].includes(method);
     if(communityMethod&&!config.communityGate)throw new Error('Community deployment is unavailable.');
     const gateMethod=method==='authorizeCommunity'?'authorize':method==='finalizeCommunity'?'finalize':'requestSnapshot';
     const approving=method==='approveRewardToken';
     if(approving&&!([config.contractAddress,config.aiController].some(s=>s?.toLowerCase()===String(args[1]).toLowerCase())))throw new Error('Invalid token approval spender.');
     const receipt = await sendMissionTransaction({ contractAddress: transfer?transfer.token:communityMethod?config.communityGate!:approving?String(args[0]):controlled?config.aiController!:config.contractAddress, abi:transfer?tokenTransferAbi:communityMethod?gateAbi:approving?erc20Abi:controlled?aiAbi:undefined, chainId: config.chainId, method:transfer?'transfer':communityMethod?gateMethod:approving?'approve':method==='withdrawAITokenCredit'?'withdrawTokenCredit':method==='withdrawAICredit'?'withdrawCredit':method, args:transfer?[transfer.to,transfer.units]:approving?args.slice(1):args, value,
       sendSponsored: sponsored ? async tx => { await assertCurrent(); return authWallet!.sendSponsored!(tx); } : undefined,
       preflight: (tx, sponsored) => prepareMissionTransaction(tx, sponsored, {
         balance: () => provider.getBalance(account),
         estimateGas: ({ to, data, value }) => provider.estimateGas({ from: account, to, data, value }),
         fees: () => provider.getFeeData()
       }),
       getSigner: async () => { await assertCurrent(); return provider.getSigner(account); },
       waitForReceipt: hash => provider.waitForTransaction(hash, 1, 90000),
       onSent: hash => { sentHash = hash; setNotice({ kind: 'pending', text: `${label} is confirming on Monad.`, tx: hash }); }
     });
      setNotice({ kind: 'success', text: `${label} confirmed.${sponsored ? ' Gas covered by Support Me.' : ''}`, tx: receipt.hash }); await refreshAfterReceipt(refresh); return receipt;
   } catch (e: any) {
     if (e instanceof TokenTransferError) { setNotice({ kind: 'error', text: e.message }); return; }
     if (e instanceof TransactionPreflightError) { setNotice({ kind: 'error', text: e.message, values: e.values }); return; }
     const text = sentHash && e.receipt?.status === 0 ? 'The transaction reverted. No contract changes were saved; the network fee was charged.' : sentHash ? 'We could not confirm this transaction succeeded. Check its status before submitting again.'
       : e.code === 'WALLET_REQUEST_PENDING' ? 'A previous wallet request is unresolved. Check My missions and your wallet activity before refreshing; do not pay again blindly.'
       : e.code === 'ACTION_REJECTED' || e.code === 4001 ? 'You cancelled the transaction. Nothing changed.'
       : sponsored ? 'Gas sponsorship could not complete. Nothing was retried with your MON. Check the mission status and try again.'
       : e.code === 'INSUFFICIENT_FUNDS' ? 'You need more testnet MON for this action and gas. Get some from the faucet.'
       : 'Transaction could not be completed. Check your balance, account, and the latest mission status, then retry.';
     setNotice({ kind: 'error', text, tx: sentHash || undefined });
   } finally { pending.current = false; setBusy(false); setWalletOperationPending(false); }
 }
 return <AppContext.Provider value={{ tokenBalance, sendToken, state, config, loading, error, address, balance, wrongChain, walletOpen, setWalletOpen, connect, disconnect, refresh, transact, sign, apiFetch, notice, clearNotice: () => setNotice(undefined), busy, gasSponsored, auth, chooseWallet, lockPayoutWallet }}>{children}</AppContext.Provider>;
}
export { shortAddress };
