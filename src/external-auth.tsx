import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider } from 'ethers';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, LoaderCircle, Wallet } from 'lucide-react';
import type { AuthSession } from './state';
import { t, useLocale } from './i18n';
import { mergeWalletChoice } from './wallet-choices';
type Injected = NonNullable<Window['ethereum']>;
interface Session { token: string; wallet: string; xId: string; username: string; expires: number; backupEmail: boolean; }
interface Proof { linkToken: string; wallet: string; code: string; anchor: string; expires: number; }
const KEY = 'support.external-session';
async function post(path: string, body: unknown, token?: string) {
 const res = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}`, 'X-Auth-Provider': 'wallet' } : {}) }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(35000) });
 const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Wallet verification failed. Connect again.'); return data;
}
export function useExternalAuth(active: boolean, chainId: number): AuthSession {
 useLocale();
 const [session, setSession] = useState<Session>();
 const [proof, setProof] = useState<Proof>();
 const [provider, setProvider] = useState<Injected>();
 const [choices, setChoices] = useState<{ name: string; provider: Injected }[]>([]);
 const [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
 const [choosingWallet,setChoosingWallet]=useState(false),[selectedWallet,setSelectedWallet]=useState('');
 const walletSelect=useRef<HTMLSelectElement>(null);
 useEffect(()=>{if(choosingWallet)walletSelect.current?.focus();},[choosingWallet]);
 const [url, setUrl] = useState(''), [copied, setCopied] = useState(false);
 const generation = useRef(0), activeRef = useRef(active); activeRef.current = active;
 const clear = useCallback(() => { generation.current++; sessionStorage.removeItem(KEY); setSession(undefined); setProof(undefined); setProvider(undefined); setUrl(''); setBusy(false); }, []);
 useEffect(() => { generation.current++; setBusy(false); }, [active]);
 useEffect(() => {
  if (!active) { setReady(false); return; }
  const add = (p: Injected, name: string) => setChoices(list => mergeWalletChoice(list,p,name));
  for (const p of window.ethereum?.providers || (window.ethereum ? [window.ethereum] : [])) add(p, p.isRabby ? 'Rabby' : p.isMetaMask ? 'MetaMask' : 'Browser wallet');
  const announce = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.provider?.request && typeof d.info?.name === 'string') add(d.provider, d.info.name.slice(0, 60)); };
  window.addEventListener('eip6963:announceProvider', announce); window.dispatchEvent(new Event('eip6963:requestProvider'));
  return () => window.removeEventListener('eip6963:announceProvider', announce);
 }, [active]);
 useEffect(() => {
  if (!active) return;
  let cancelled = false;
  const revision = generation.current;
  void (async () => {
   try {
    const saved: Session = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!saved || saved.expires <= Date.now()) return;
    const candidates = [...choices.map(w => w.provider), ...(window.ethereum?.providers || (window.ethereum ? [window.ethereum] : []))];
    for (const p of candidates) {
     const accounts = await p.request({ method: 'eth_accounts' }) as string[];
     if (accounts[0]?.toLowerCase() !== saved.wallet.toLowerCase()) continue;
     const member = await post('auth/session', {}, saved.token);
     const current = await p.request({ method: 'eth_accounts' }) as string[];
     if (!cancelled && generation.current === revision && current[0]?.toLowerCase() === saved.wallet.toLowerCase()) { setProvider(p); setSession({ ...saved, ...member }); }
     return;
    }
   } catch { if (!cancelled) clear(); }
   finally { if (!cancelled) setReady(true); }
  })();
  return () => { cancelled = true; };
 }, [active, choices, clear]);
 useEffect(() => {
  if (!provider) return;
  const changed = () => { clear(); setError('Wallet changed. Connect and sign in again.'); };
  provider.on?.('accountsChanged', changed); provider.on?.('disconnect', changed);
  return () => { provider.removeListener?.('accountsChanged', changed); provider.removeListener?.('disconnect', changed); };
 }, [provider, clear]);
 const accept = useCallback((data: Session) => { sessionStorage.setItem(KEY, JSON.stringify(data)); setSession(data); setProof(undefined); setError(''); }, []);
 const connect = useCallback(async (p: Injected) => {
  if (busy) return; setBusy(true); setError(''); setProof(undefined);
  const revision = ++generation.current;
  try {
   const accounts = await p.request({ method: 'eth_requestAccounts' }) as string[];
   const wallet = accounts[0]; if (!wallet) throw new Error('Connect your wallet first.');
   const c = await post('wallet-auth/challenge', { wallet });
   const signature = await (await new BrowserProvider(p).getSigner(wallet)).signMessage(c.message);
   const current = await p.request({ method: 'eth_accounts' }) as string[];
   if (current[0]?.toLowerCase() !== wallet.toLowerCase()) throw new Error('Wallet changed. Connect and sign in again.');
   const data = await post('wallet-auth/login', { id: c.id, signature });
   const selected = await p.request({ method: 'eth_accounts' }) as string[];
   if (!activeRef.current || generation.current !== revision) return;
   if (selected[0]?.toLowerCase() !== wallet.toLowerCase()) throw new Error('Wallet changed. Connect and sign in again.');
   setProvider(p);
   if (data.token) accept(data); else { setProof(data); setCopied(false); setUrl(''); }
  } catch (e: any) { if (generation.current === revision) setError(e.code === 4001 || e.code === 'ACTION_REJECTED' ? 'Wallet sign-in cancelled. Try again when ready.' : e.message?.length < 180 ? e.message : 'Wallet verification failed. Connect again.'); }
  finally { if (generation.current === revision) setBusy(false); }
 }, [busy, accept]);
 const verify = useCallback(async () => {
  if (!proof || !provider || busy) return; setBusy(true); setError('');
  const revision = generation.current;
  try {
   const current = await provider.request({ method: 'eth_accounts' }) as string[];
   if (current[0]?.toLowerCase() !== proof.wallet) throw new Error('Wallet changed. Connect and sign in again.');
   const data = await post('wallet-auth/link', { linkToken: proof.linkToken, url: url.trim() });
   const selected = await provider.request({ method: 'eth_accounts' }) as string[];
   if (!activeRef.current || generation.current !== revision) return;
   if (selected[0]?.toLowerCase() !== proof.wallet) throw new Error('Wallet changed. Connect and sign in again.');
   accept(data);
  } catch (e: any) { if (generation.current === revision) setError(e.message); } finally { if (generation.current === revision) setBusy(false); }
 }, [proof, provider, busy, url, accept]);
 const logout = useCallback(async () => { const token = session?.token; clear(); if (token) await post('wallet-auth/logout', {}, token); }, [session?.token, clear]);
 const selected=choices.find(w=>w.name===selectedWallet)||choices[0];
 const beginConnect=()=>{if(choices.length>1&&!choosingWallet){setChoosingWallet(true);return;}if(selected)void connect(selected.provider);else setError('Open Support Me in Rabby or MetaMask, or install a browser wallet.');};
 const signInContent = <div className="external-signin">
  {!proof ? <>
   <div className="signin-intro external-signin-intro"><div className="signin-copy"><p className="signin-eyebrow">{t('YOUR WALLET. YOUR WAY.')}</p><h2 id="wallet-title">{t('Your wallet.')} <span>{t('Your way in.')}</span></h2><p>{t('Connect your wallet and link X with one reply. Next time, just sign in with your wallet.')}</p></div><img className="signin-mascot" src="/art/wallet-login-mascot.webp" width="768" height="1152" alt=""/></div>
   <div className="external-wallet-benefits"><img src="/art/wallet-login-icon.webp" width="44" height="44" alt=""/><p>{t('One wallet for rewards, NFTs and tokens.')}<span>{t('Network fees are paid by you in MON.')}</span></p></div>
   {error&&<p className="callout" role="alert">{t(error)}</p>}
   {choosingWallet&&<div className="external-wallet-picker"><label htmlFor="external-wallet-choice">{t('Choose your wallet')}</label><div><select ref={walletSelect} id="external-wallet-choice" disabled={busy} value={selected?.name||''} onChange={e=>setSelectedWallet(e.target.value)}>{choices.map(w=><option key={w.name} value={w.name}>{w.name}</option>)}</select><ChevronDown size={18} aria-hidden="true"/></div></div>}
   <button className="button primary wide" disabled={busy||!ready} aria-expanded={choices.length>1?choosingWallet:undefined} aria-controls={choices.length>1?'external-wallet-choice':undefined} onClick={beginConnect}>{busy?<LoaderCircle size={20} className="wallet-signin-spinner" aria-hidden="true"/>:<Wallet size={20} aria-hidden="true"/>}{t(busy?'Confirm in your wallet':'Connect wallet')}<ArrowRight size={19} aria-hidden="true"/></button>
   <p className="external-signin-hint" role="status">{t(busy?'Approve the connection and sign the message in your wallet.':'Sign a message to continue. Your funds stay where they are.')}</p>
  </> : <>
   <div className="external-link-heading"><p className="signin-eyebrow">{t('ONE REPLY. ALL SET.')}</p><h2 id="wallet-title">{t('Make it')} <span>{t('yours.')}</span></h2><p>{t('Link your X account once. Future sign-ins only need your wallet.')}</p></div>
   {error&&<p className="callout" role="alert">{t(error)}</p>}
   <ol className="wallet-link-steps"><li><strong>{t('Copy your personal code')}</strong><button className="wallet-proof-code" aria-label={t('Copy your personal code')} onClick={() => { void navigator.clipboard.writeText(proof.code).then(() => setCopied(true)).catch(() => setError('Select and copy the code manually.')); }}><code>{proof.code}</code>{copied ? <Check size={18} aria-hidden="true"/> : <Copy size={18} aria-hidden="true"/>}</button><span className="sr-only" role="status">{copied?t('Copied!'):''}</span></li><li><strong>{t('Reply to the verification post')}</strong><p>{t('Publish this code from the X account you want to link. This is needed only once.')}</p><a className="external-verification-link" href={proof.anchor} target="_blank" rel="noreferrer">{t('Open verification post')}<ArrowUpRight size={16} aria-hidden="true"/></a></li><li><label htmlFor="wallet-reply-url">{t('Paste the link to your reply')}</label><input id="wallet-reply-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://x.com/…/status/…" disabled={busy}/></li></ol>
   <button className="button primary wide" disabled={busy || !url.trim()} onClick={() => void verify()}>{busy?<LoaderCircle size={20} className="wallet-signin-spinner" aria-hidden="true"/>:<Check size={20} aria-hidden="true"/>}{t(busy ? 'Checking…' : 'Verify and sign in')}<ArrowRight size={19} aria-hidden="true"/></button><button className="text-button" disabled={busy} onClick={() => { setProof(undefined); setError(''); }}>{t('Connect another wallet')}</button>
  </>}
 </div>;
 return useMemo(() => ({ provider: 'wallet', ready, authenticated: !!session, wallets: session && provider ? [{ address: session.wallet, label: 'External wallet', getProvider: async () => provider, switchChain: async (id: number) => {
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${id.toString(16)}` }] }); }
  catch (e: any) { if (e.code !== 4902) throw e; const config = await fetch('/api/config').then(r => r.json()); if (id !== chainId || config.chainId !== id) throw new Error('Network configuration changed. Reload and retry.'); await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${id.toString(16)}`, chainName: id === 143 ? 'Monad' : 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: [config.publicRpc], blockExplorerUrls: [config.explorer] }] }); await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${id.toString(16)}` }] }); }
 } }] : [], member: session, signInContent, login: () => {}, connectWallet: () => {}, logout, getAccessToken: async () => session?.token || null }), [ready, session, provider, signInContent, logout, chainId]);
}
