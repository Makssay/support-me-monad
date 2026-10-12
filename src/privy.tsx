import { t, useLocale } from './i18n';
import { useMemo, useEffect, useState, useRef, useCallback, memo, type FormEvent } from 'react';
import BackupSignInDialog from './backup-signin-dialog';
import { PrivyProvider, usePrivy, useWallets, useSendTransaction, useLoginWithEmail, useCreateWallet, useUnlinkWallet, useModalStatus } from '@privy-io/react-auth';
import { defineChain } from 'viem';
import { CHAIN_ID, EXPLORER, PUBLIC_RPC } from '../shared/model';
import { type AuthSession, type AuthWallet } from './state';
import { embeddedAddress, legacyWalletsToUnlink } from './support-wallet-policy';
import { WalletRequest } from './wallet-request';
import { accountSession } from './account-session';
import { waitForWalletModal } from './wallet-modal';
const monad = defineChain({ id: CHAIN_ID, name: 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [PUBLIC_RPC] } }, blockExplorers: { default: { name: 'Monadscan', url: EXPLORER } }, testnet: true });
function WalletBridge({ onSession }: { onSession: (auth: AuthSession) => void }) { useLocale(); 
 const { ready, authenticated, user, login, logout, linkTwitter, linkEmail, getAccessToken } = usePrivy();
 const { wallets, ready: walletsReady } = useWallets();
 const { isOpen } = useModalStatus();
 const modal = useRef({open:isOpen,closedAt:0});
 if (modal.current.open !== isOpen) modal.current = {open:isOpen,closedAt:isOpen ? 0 : Date.now()};
 const walletRequest = useRef(new WalletRequest());
 const { sendTransaction } = useSendTransaction({
  onSuccess: ({hash}) => walletRequest.current.success(hash),
  onError: code => walletRequest.current.failure(Object.assign(new Error('Wallet confirmation did not complete.'), {code: /cancel|exit|reject/i.test(String(code)) ? 'ACTION_REJECTED' : 'WALLET_REQUEST_FAILED'}))
 }); const { createWallet } = useCreateWallet();
 const emailLogin = useLoginWithEmail();
 const [membership, setMembership] = useState<{ id: string; member: NonNullable<AuthSession['member']> }>();
 const [error, setError] = useState(''); const [needsX, setNeedsX] = useState(false);
 const [attempt, setAttempt] = useState(0); const creating = useRef('');
 const [creatingWallet, setCreatingWallet] = useState(false);
 const walletCreation = useRef<Promise<string> | undefined>(undefined);
 const { unlink } = useUnlinkWallet();
 const unlinks = useRef(new Set<string>());
 const [cleanupError, setCleanupError] = useState('');
 const [backup, setBackup] = useState(false); const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [sending, setSending] = useState(false); const [emailError, setEmailError] = useState('');
 const retry = useCallback(() => { creating.current = ''; setCleanupError(''); setAttempt(n => n + 1); }, []);
 const loginX = useCallback(() => login({ loginMethods: ['twitter'] }), [login]);
 const loginBackup = useCallback(() => { setSent(false); setEmail(''); setCode(''); setEmailError(''); setBackup(true); }, []);
 // A linked-identity change triggers server verification; client profiles never grant membership.
 const identity = JSON.stringify(user?.linkedAccounts.map(a => a.type === 'twitter_oauth' ? [a.type, a.subject] : a.type === 'email' ? [a.type, a.address] : a.type === 'wallet' ? [a.type, a.address] : [a.type]));
 const member = authenticated && membership && membership.id === user?.id ? membership.member : undefined;
 const supportAddress = embeddedAddress(user?.linkedAccounts || []);
 const createSupportWallet = useCallback(async () => {
  if (!member || !authenticated || !user) throw new Error('Your account must be verified first.');
  if (walletCreation.current) return walletCreation.current;
  const existing = embeddedAddress(user.linkedAccounts);
  if (existing) return existing;
  setCreatingWallet(true);
  const task = createWallet().then(w => w.address);
  walletCreation.current = task;
  try { return await task; } finally { walletCreation.current = undefined; setCreatingWallet(false); }
 }, [member, authenticated, user, createWallet]);
 useEffect(() => {
  let cancelled = false; setMembership(undefined); setError(''); setNeedsX(false);
  if (!ready || !authenticated || !user) return;
  const id = user.id;
  void (async () => {
   try {
    const token = await getAccessToken(); if (!token) throw new Error();
    const res = await accountSession(() => fetch('/api/auth/session', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, redirect: 'error' }), () => !cancelled);
    const data = await res.json(); if (cancelled) return;
    if (!res.ok) { setNeedsX(data.code === 'X_REQUIRED'); setError(data.error || 'Your account could not be verified.'); return; }
    setMembership({ id, member: data }); setBackup(false);
   } catch { if (!cancelled) setError('Account verification is unavailable. Please retry.'); }
  })();
  return () => { cancelled = true; };
 }, [ready, authenticated, user?.id, identity, attempt, getAccessToken]);
 useEffect(() => {
  if (!member || !walletsReady || !user || supportAddress || creating.current === user.id) return;
  creating.current = user.id;
  void createSupportWallet().catch(() => setError('Your wallet could not be created. Retry to continue.'));
 }, [member, walletsReady, user, supportAddress, createSupportWallet, attempt]);
 const legacyWallets = JSON.stringify(legacyWalletsToUnlink(user?.linkedAccounts || [], !!member));
 useEffect(() => {
  if (!member || !user || !supportAddress) return;
  const id = user.id;
  let cancelled = false;
  void (async () => {
   for (const address of JSON.parse(legacyWallets) as string[]) {
    if (cancelled) return;
    const key = `${id}:${address.toLowerCase()}`;
    if (unlinks.current.has(key)) continue;
    unlinks.current.add(key);
    try { await unlink({ address }); }
    catch { unlinks.current.delete(key); if (!cancelled) setCleanupError('Your old wallet link could not be removed. Retry account verification. Support Me uses only your embedded wallet.'); return; }
   }
  })();
  return () => { cancelled = true; };
 }, [member, user?.id, supportAddress, legacyWallets, unlink, attempt]);
 const allowedWallets = useMemo<AuthWallet[]>(() => member ? wallets.filter(w => w.walletClientType === 'privy' && w.address.toLowerCase() === supportAddress?.toLowerCase()).map(w => ({ address: w.address, label: 'Support Me wallet', getProvider: () => w.getEthereumProvider(), switchChain: (id: number) => w.switchChain(id),
  sendSponsored: w.walletClientType === 'privy' ? async (transaction: { to: string; data: string; value: bigint; chainId: number }) => {
   if (transaction.chainId !== CHAIN_ID) throw new Error('Only Monad Testnet sponsorship is supported.');
   return walletRequest.current.run(async () => {
    await waitForWalletModal(() => modal.current);
    return sendTransaction(transaction, { address: w.address, sponsor: true, uiOptions: {showWalletUIs:true,isCancellable:true} });
   });
  } : undefined
 })) : [], [!!member, wallets, supportAddress, sendTransaction]);
 const auth = useMemo<AuthSession>(() => ({ ready: ready && walletsReady, authenticated, login: loginX, loginBackup, logout, connectWallet: retry, creatingWallet, linkX: linkTwitter, linkEmail, retry, getAccessToken, member, needsX, accountError: error, cleanupError, wallets: allowedWallets }), [ready, walletsReady, authenticated, loginX, loginBackup, logout, creatingWallet, linkTwitter, linkEmail, retry, getAccessToken, member, needsX, error, cleanupError, allowedWallets]);
 useEffect(() => onSession(auth), [auth, onSession]);
 async function submitEmail(e: FormEvent) {
  e.preventDefault(); if (sending) return; setSending(true); setEmailError('');
  try { if (!sent) { await emailLogin.sendCode({ email: email.trim(), disableSignup: true }); setSent(true); } else { await emailLogin.loginWithCode({ code }); setBackup(false); } }
  catch { setEmailError(sent ? 'The code could not be accepted. Check it or request a new code.' : 'Could not send a code. Use the backup email you already linked, or sign in with X.'); }
  finally { setSending(false); }
 }
 return backup ? <BackupSignInDialog email={email} code={code} sent={sent} sending={sending} error={emailError} onEmail={setEmail} onCode={setCode} onClose={()=>setBackup(false)} onReset={()=>{setSent(false);setCode('');setEmailError('');}} onSubmit={submitEmail}/> : null;
}
export default memo(function PrivyAuth({ appId, chainId, onSession }: { appId: string; chainId:number; onSession: (auth: AuthSession) => void }) { useLocale();
 const activeChain=chainId===143?defineChain({id:143,name:'Monad',nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:{default:{http:['https://rpc.monad.xyz']}},blockExplorers:{default:{name:'Monadscan',url:'https://monadscan.com'}}}):monad;
 return <PrivyProvider appId={appId} config={{ loginMethods: ['twitter'], defaultChain: activeChain, supportedChains: [activeChain], appearance: { theme: 'dark', accentColor: '#836EF9', logo: '/mark.svg', landingHeader: t('A little support starts here.'), loginMessage: t('Join with X. Add a backup email once you’re in.'), walletChainType: 'ethereum-only' }, embeddedWallets: { ethereum: { createOnLogin: 'off' } } }}><WalletBridge onSession={onSession}/></PrivyProvider>;
});


