import { useEffect, useRef, useState } from 'react';
import { formatUnits } from 'ethers';
import { ArrowUpRight, Coins, RefreshCw } from 'lucide-react';
import { useApp } from './state';
import { t, useLocale, number } from './i18n';
import type { RewardAsset } from '../shared/rewards';
import { validateTokenTransfer } from './token-transfer';

export function WalletTokens() {
 useLocale();
 const { address, config, state, tokenBalance, sendToken, busy, notice, clearNotice } = useApp();
 const reader = useRef(tokenBalance); reader.current = tokenBalance;
 const known = new Map<string, RewardAsset>();
 for (const asset of [...(state?.missions.map(m => m.rewardAsset) ?? []), ...(state?.profiles.find(p => p.address.toLowerCase() === address.toLowerCase())?.tokenRewards?.map(r => r.asset) ?? [])]) {
  if (asset && asset.source !== 'native' && asset.chainId === config?.chainId) known.set(asset.address.toLowerCase(), asset);
 }
 const assets = [...known.values()];
 const key = assets.map(a => `${a.address}:${a.decimals}`).sort().join(',');
 const [balances, setBalances] = useState<Record<string, bigint>>({});
 const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [revision, setRevision] = useState(0);
 const [open, setOpen] = useState(false), [selected, setSelected] = useState(''), [recipient, setRecipient] = useState(''), [amount, setAmount] = useState('');
 const [review, setReview] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
 useEffect(() => { setOpen(false); setReview(false); setRecipient(''); setAmount(''); setSelected(''); setError(''); setResult(''); }, [address, config?.chainId]);
 useEffect(() => {
  let active = true;
  setLoading(true); setFailed(false); setBalances({});
  void Promise.allSettled(assets.map(async asset => [asset.address.toLowerCase(), await reader.current(asset)] as const)).then(results => {
   if (!active) return;
   const next: Record<string, bigint> = {};
   for (const r of results) if (r.status === 'fulfilled') next[r.value[0]] = r.value[1];
   setBalances(next); setFailed(results.some(r => r.status === 'rejected')); setLoading(false);
  });
  return () => { active = false; };
 }, [address, config?.chainId, key, revision]);
 const available = assets.filter(a => (balances[a.address.toLowerCase()] ?? 0n) > 0n);
 const asset = available.find(a => a.address.toLowerCase() === selected);
 const balance = asset ? balances[selected] : 0n;
 function reset() { setOpen(false); setReview(false); setError(''); setResult(''); setAmount(''); setRecipient(''); }
 function check() {
  try {
   if (!asset || balance === undefined) throw Error('Choose a token.');
   validateTokenTransfer(asset, config!.chainId, address, recipient, amount, balance);
   setError(''); setReview(true); clearNotice();
  } catch (e) { setError((e as Error).message); }
 }
 async function submit() {
  if (!asset || busy) return;
  const sender = address;
  const receipt = await sendToken(asset, recipient.trim(), amount.trim(), sender);
  if (receipt) { setResult(receipt.hash); setReview(false); setRevision(v => v + 1); }
 }
 return <section className="wallet-tokens" aria-label={t('Your tokens')}>
  <div className="wallet-token-heading"><h3><Coins size={18}/>{t('Your tokens')}</h3><button className="icon-button" disabled={busy || loading} aria-label={t('Refresh token balances')} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16}/></button></div>
  {loading ? <p role="status">{t('Loading token balances…')}</p> : <>
   {available.map(a => <div className="wallet-token-row" key={a.address}><span><strong>{a.symbol}</strong><small>{a.name}</small></span><span title={formatUnits(balances[a.address.toLowerCase()], a.decimals)}>{number(formatUnits(balances[a.address.toLowerCase()], a.decimals))}</span></div>)}
   {!available.length && <p>{t('No token balance found.')}</p>}
  </>}
  {failed && <p role="alert">{t('Some token balances could not load. Refresh to retry.')}</p>}
  <small>{t('Tokens used in Support Me missions. Balances are read from your wallet.')}</small>
  {!open && <button className="button secondary wide" disabled={busy || !available.length || loading} onClick={() => { setSelected(available[0].address.toLowerCase()); setOpen(true); clearNotice(); }}>{t('Send tokens')}<ArrowUpRight size={16}/></button>}
  {open && <div className="wallet-token-send">
   {result ? <div role="status"><strong>{t('Tokens sent')}</strong><a href={`${config?.explorer}/tx/${result}`} target="_blank" rel="noreferrer">{t('View transaction')}<ArrowUpRight size={15}/></a><button className="button secondary wide" onClick={reset}>{t('Done')}</button></div> : <>
    {review ? <div className="wallet-token-review"><h3>{t('Review transfer')}</h3><strong>{amount} {asset?.symbol}</strong><p>{t('Token contract')}</p><code>{asset?.address}</code><p>{t('Recipient wallet')}</p><code>{recipient.trim()}</code><p>{config?.chainId === 143 ? 'Monad' : 'Monad Testnet'} · {t('Network fee in MON')}</p><small>{t('Check the address and network. Transfers cannot be reversed.')}</small></div> : <>
     <label>{t('Token')}<select disabled={busy} value={selected} onChange={e => { setSelected(e.target.value); setAmount(''); setError(''); }}>{available.map(a => <option value={a.address.toLowerCase()} key={a.address}>{a.symbol} · {a.address.slice(0, 8)}…{a.address.slice(-4)}</option>)}</select></label>
     {asset && <small>{t('Available')}: {number(formatUnits(balance, asset.decimals))} {asset.symbol}</small>}
     <label>{t('Recipient wallet')}<input autoComplete="off" spellCheck={false} disabled={busy} value={recipient} placeholder="0x…" onChange={e => setRecipient(e.target.value)}/></label>
     <label>{t('Amount')}<div className="wallet-token-amount"><input inputMode="decimal" autoComplete="off" disabled={busy} value={amount} placeholder="0.0" onChange={e => setAmount(e.target.value.replace(',', '.'))}/><button type="button" disabled={busy || !asset} onClick={() => asset && setAmount(formatUnits(balance, asset.decimals))}>{t('Max')}</button></div></label>
    </>}
    {error && <p role="alert">{t(error)}</p>}
    {notice && <p role="status">{t(notice.text, notice.values)}{notice.tx && <a href={`${config?.explorer}/tx/${notice.tx}`} target="_blank" rel="noreferrer">{t('View transaction')}</a>}</p>}
    <button className="button primary wide" disabled={busy || loading || (!!notice?.tx && notice.kind === 'error')} onClick={() => review ? void submit() : check()}>{busy ? t('Confirm in your wallet') : review ? t('Confirm transfer') : t('Review transfer')}</button>
    <button className="button secondary wide" disabled={busy} onClick={() => review ? setReview(false) : reset()}>{t('Back')}</button>
   </>}
  </div>}
 </section>;
}
