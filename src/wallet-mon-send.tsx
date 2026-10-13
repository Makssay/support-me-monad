import {useEffect,useState} from 'react';
import {parseEther} from 'ethers';
import {ArrowUpRight} from 'lucide-react';
import {useApp} from './state';
import {t,useLocale,noticeText} from './i18n';
import {validateNativeTransfer} from './native-transfer';

export function WalletMonSend(){
 useLocale();
 const {address,balance,config,busy,transact,notice,clearNotice}=useApp();
 const [open,setOpen]=useState(false),[review,setReview]=useState(false),[recipient,setRecipient]=useState(''),[amount,setAmount]=useState(''),[error,setError]=useState(''),[result,setResult]=useState('');
 useEffect(()=>{reset();},[address,config?.chainId]);
 function reset(){setOpen(false);setReview(false);setRecipient('');setAmount('');setError('');setResult('');}
 function check(){try{validateNativeTransfer(address,recipient,amount,parseEther(balance||'0'));setError('');clearNotice();setReview(true);}catch(e){setError((e as Error).message);}}
 async function submit(){const receipt=await transact('MON transfer','sendWalletMON',[recipient.trim(),amount.trim(),address]);if(receipt){setResult(receipt.hash);setReview(false);}}
 return <section className="wallet-mon-send" aria-label={t('Withdraw MON')}>
 {!open?<button className="button primary wide" disabled={busy||!balance} onClick={()=>{setOpen(true);clearNotice();}}>{t('Withdraw MON')}<ArrowUpRight size={18}/></button>:<div className="wallet-token-send">
 {result?<div role="status"><strong>{t('MON sent')}</strong><a href={`${config?.explorer}/tx/${result}`} target="_blank" rel="noreferrer">{t('View transaction')}<ArrowUpRight size={15}/></a><button className="button secondary wide" onClick={reset}>{t('Done')}</button></div>:<>
 {review?<div className="wallet-token-review"><h3>{t('Review transfer')}</h3><strong>{amount} MON</strong><p>{t('Recipient wallet')}</p><code>{recipient.trim()}</code><p>{config?.chainId===143?'Monad Mainnet':'Monad Testnet'}</p><small>{t('Check the address and network. Transfers cannot be reversed.')}</small></div>:<><h3>{t('Withdraw MON')}</h3><label>{t('Recipient wallet')}<input autoComplete="off" spellCheck={false} disabled={busy} value={recipient} placeholder="0x…" onChange={e=>setRecipient(e.target.value)}/></label><label>{t('Amount')}<input inputMode="decimal" autoComplete="off" disabled={busy} value={amount} placeholder="0.0" onChange={e=>setAmount(e.target.value.replace(',','.'))}/></label></>}
 <small>{t('Leave some MON for the network fee. Your wallet shows the fee before you confirm.')}</small>
 {error&&<p role="alert">{t(error)}</p>}{notice&&<p role={notice.kind==='error'?'alert':'status'}>{noticeText(notice.text,notice.values)}{notice.tx&&<a href={`${config?.explorer}/tx/${notice.tx}`} target="_blank" rel="noreferrer">{t('View transaction')}</a>}</p>}
 <button className="button primary wide" disabled={busy||!!notice?.tx&&notice.kind==='error'} onClick={()=>review?void submit():check()}>{busy?t('Confirm in your wallet'):review?t('Confirm transfer'):t('Review transfer')}</button><button className="button secondary wide" disabled={busy} onClick={()=>review?setReview(false):reset()}>{t('Back')}</button>
 </>}
 </div>}
 </section>;
}
