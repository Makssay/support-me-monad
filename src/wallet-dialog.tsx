import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Check, ChevronRight, Copy, ExternalLink, FlaskConical, Gift, LockKeyhole, LogOut, ShieldCheck, Signal, Target, Wallet, X } from 'lucide-react';
import { AccountBackup, AccountSignIn } from './account-controls';
import { WalletTokens } from './wallet-tokens';
import { useApp } from './state';
import { t, useLocale, number as localizedNumber } from './i18n';
import { profilePath, sameAddress, shortAddress } from '../shared/model';
import { useSurfaceMotion } from './motion';
import { TransitionLink as Link } from './view-transitions';

export default function WalletDialog() {
 useLocale();
 const backdropMotion = useSurfaceMotion(.18, .16, 'none');
 const dialogMotion = useSurfaceMotion(.22, .16, 'scale(0.98)');
 const { walletOpen, setWalletOpen, connect, address, balance, disconnect, config, wrongChain, auth, busy, gasSponsored, state } = useApp();
 const dialog = useRef<HTMLElement>(null);
 const [copied, setCopied] = useState(false);
 const [copyError, setCopyError] = useState(false);
 const [avatarFailed, setAvatarFailed] = useState(false);
 const profile = state?.profiles.find(p => sameAddress(p.address, address));
 const username = auth?.member?.username || profile?.username;
 const wallets = window.ethereum?.providers || (window.ethereum ? [window.ethereum] : []);
 useEffect(() => { setCopied(false); setCopyError(false); setAvatarFailed(false); }, [address, walletOpen]);
 useEffect(() => {
  if (!walletOpen) return;
  const previous = document.activeElement as HTMLElement | null;
  const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const keydown = (e: KeyboardEvent) => {
   if (e.key === 'Escape') { e.preventDefault(); setWalletOpen(false); }
   if (e.key !== 'Tab') return;
   const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
   const first = focusable[0], last = focusable.at(-1);
   if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
   else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  document.addEventListener('keydown', keydown);
  return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
 }, [walletOpen, setWalletOpen]);
 async function copyAddress() {
  try { await navigator.clipboard.writeText(address); setCopied(true); setCopyError(false); }
  catch { setCopyError(true); }
 }
 const close = () => setWalletOpen(false);
 const displayBalance = balance ? Number(balance) > 0 && Number(balance) < .0001 ? `< ${localizedNumber('0.0001')}` : localizedNumber(balance.replace(/(\.\d{4})\d+$/, '$1')) : '…';
 return createPortal(<div className="wallet-presence" data-open={walletOpen} inert={!walletOpen}><AnimatePresence>{walletOpen && <motion.div {...backdropMotion} className="modal-backdrop account-backdrop" onClick={close}>
  <motion.section {...dialogMotion} ref={dialog} className={`wallet-dialog account-dialog ${address ? 'account-connected' : 'account-login'}`} role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={e => e.stopPropagation()}>
   <div className="account-dialog-header"><span className="wordmark"><img src="/mark.svg" alt=""/>support me<span className="logo-dot">.</span></span><button className="icon-button" aria-label={t('Close wallet dialog')} onClick={close}><X size={25}/></button></div>
   {address ? <>
    <div className="account-identity"><span className="account-avatar">{profile?.avatarUrl && !avatarFailed ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)}/> : <img src="/mark.svg" alt=""/>}<i/></span><div><h2 id="wallet-title">{username ? `@${username}` : profile?.name || t('Your wallet')}</h2><Link className="account-profile-link" to={profilePath(address,state?.profiles)} onClick={close}>{t('Support Me profile')}<ArrowUpRight size={15}/></Link><button className="account-address" onClick={() => void copyAddress()} aria-label={t(copied ? 'Address copied' : 'Copy wallet address')} title={address}><Wallet size={17}/><span>{shortAddress(address)}</span>{copied ? <Check size={17}/> : <Copy size={17}/>}</button></div></div>
    <span className="sr-only" role="status">{copied ? t('Address copied') : copyError ? t('Could not copy. Select your address below.') : ''}</span>{copyError && <p className="account-copy-fallback">{address}</p>}
    <div className="account-balance-panel"><span className="monad-balance-symbol"><img src="/art/monad-coin.webp" width="96" height="96" alt=""/></span><div><p>{t('Wallet balance')}</p><div className="account-balance-value" title={balance ? `${balance} MON` : undefined}>{displayBalance}<span>{t(config?.chainId === 143 ? 'MON' : 'testnet MON')}</span></div></div><svg className="balance-decoration" viewBox="0 0 180 110" aria-hidden="true"><path d="M0 110Q25 40 48 69T90 52T128 30T180 45V110Z" fill="currentColor"/></svg></div>
    <div className="account-metrics" aria-label={t('Your activity')}><div><Signal/><span>{t('Signal Score')}<strong>{localizedNumber(profile?.score ?? 0)}</strong></span></div><div><Gift/><span>{t('Rewards received')}<strong>{localizedNumber(profile?.accepted ?? 0)}</strong></span></div><div><Target/><span>{t('Missions created')}<strong>{localizedNumber(state?.missions.filter(m => sameAddress(m.creator,address)).length ?? 0)}</strong></span></div></div>
    <WalletTokens/>
    {auth && <AccountBackup/>}{auth?.provider === 'wallet' && <p className="account-gas-note"><Wallet size={15}/>{t('Rewards and NFT/token checks use this wallet. You pay network fees in MON.')}</p>}{gasSponsored && <p className="account-gas-note"><ShieldCheck size={15}/>{t('Support Me covers gas on Monad Testnet. Mission rewards are funded separately.')}</p>}
    {wrongChain && <button className="button primary wide" disabled={busy} onClick={() => void connect()}>{t('Switch to Monad Testnet')}</button>}
   </> : <>
    {auth?.selectExternal && <div className="auth-method-tabs" role="tablist" aria-label={t('Sign-in method')}><button role="tab" aria-selected={auth.provider !== 'wallet'} onClick={auth.selectPrivy}>Privy</button><button role="tab" aria-selected={auth.provider === 'wallet'} onClick={auth.selectExternal}>{t('Privy not working?')}</button></div>}
    {auth?.provider !== 'wallet' ? <div className="signin-intro"><div className="signin-copy"><p className="signin-eyebrow">{t('SUPPORT MAKES MORE POSSIBLE')}</p><h2 id="wallet-title">{t('A little support')}<br/>{t('starts')} <span>{t('here.')}</span></h2><p>{auth ? t('Your X profile is your identity. We create a wallet automatically so you can contribute, complete missions, and earn rewards together.') : t('Connect your wallet to contribute and earn on Monad Testnet.')}</p></div><img className="signin-mascot" src="/art/login-mascot.webp" width="768" height="1152" alt=""/></div> : null}
    {auth ? <AccountSignIn/> : <div className="signin-actions">{wallets.map((w,i) => <button key={i} className="wallet-option" onClick={() => void connect(w)}><Wallet size={22}/>{w.isRabby ? 'Rabby' : w.isMetaMask ? 'MetaMask' : t('Browser wallet')}<ChevronRight size={18}/></button>)}{!wallets.length && <p className="callout">{t('Install a browser wallet to get started.')} <a href="https://metamask.io/download" target="_blank" rel="noreferrer">{t('Get MetaMask')}<ExternalLink size={13}/></a></p>}</div>}
    {auth && !auth.authenticated && <p className="signin-security"><LockKeyhole size={17}/>{t(auth.provider === 'wallet' ? 'Never share your seed phrase. Only sign in your wallet.' : 'No seed phrase · Your wallet is created automatically')}</p>}
   </>}
   <div className="account-dialog-footer"><div><a className="faucet-link" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer"><FlaskConical size={20}/>{t('Get testnet MON')}<ArrowUpRight size={14}/></a><small>{t('Testnet only. MON here has no monetary value.')}</small>{config?.local && <small>{t('Local QA network')}</small>}</div>{address && <button className="account-signout" disabled={busy} onClick={() => { disconnect(); close(); }}>{auth ? t('Sign out') : t('Disconnect')}<LogOut size={20}/></button>}</div>
  </motion.section>
 </motion.div>}</AnimatePresence></div>, document.body);
}
