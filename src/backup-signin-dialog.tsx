import { useEffect, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, X } from 'lucide-react';
import { t, useLocale } from './i18n';
interface Props { email:string; code:string; sent:boolean; sending:boolean; error:string; onEmail:(value:string)=>void; onCode:(value:string)=>void; onClose:()=>void; onReset:()=>void; onSubmit:(event:FormEvent)=>void; }
export default function BackupSignInDialog(props:Props) {
 useLocale(); const dialog=useRef<HTMLElement>(null); const current=useRef(props); current.current=props;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null; const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!current.current.sending){e.preventDefault();current.current.onClose();}if(e.key!=='Tab')return;const els=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')||[]).filter(el=>el.getClientRects().length);const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
  document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
 },[]);
 useEffect(()=>{dialog.current?.querySelector<HTMLInputElement>('input')?.focus();},[props.sent]);
 return createPortal(<div className="modal-backdrop account-backdrop" onClick={()=>{if(!props.sending)props.onClose();}}><section ref={dialog} className="wallet-dialog account-dialog account-recovery" role="dialog" aria-modal="true" aria-labelledby="backup-title" aria-describedby="backup-description" onClick={e=>e.stopPropagation()}>
  <div className="account-dialog-header"><span className="wordmark"><img src="/mark.svg" alt=""/>support me<span className="logo-dot">.</span></span><button className="icon-button" aria-label={t('Close backup sign in')} disabled={props.sending} onClick={props.onClose}><X size={25}/></button></div>
  <span className="recovery-symbol">{props.sent?<ShieldCheck size={29}/>:<Mail size={29}/>}</span><p className="social-eyebrow">{t('YOUR WAY BACK IN')}</p><h2 id="backup-title">{t(props.sent?'Check your inbox.':'Your backup way in.')}</h2><p id="backup-description">{props.sent?t('Enter the six-digit code sent to {email}.',{email:props.email}):t('Use the verified email linked to your existing Support Me account.')}</p>
  <form onSubmit={props.onSubmit} className="backup-form" aria-busy={props.sending}><label htmlFor="backup-email-input">{t(props.sent?'Email verification code':'Backup email')}</label><div className={`recovery-input ${props.sent?'recovery-code':''}`}><Mail size={19}/><input key={props.sent?'code':'email'} id="backup-email-input" required autoComplete={props.sent?'one-time-code':'email'} type={props.sent?'text':'email'} inputMode={props.sent?'numeric':'email'} pattern={props.sent?'[0-9]{6}':undefined} maxLength={props.sent?6:254} placeholder={props.sent?'000000':'you@example.com'} value={props.sent?props.code:props.email} onChange={e=>props.sent?props.onCode(e.target.value):props.onEmail(e.target.value)} disabled={props.sending} aria-invalid={!!props.error} aria-describedby={props.error?'backup-error':undefined}/></div>
   {props.error&&<p className="callout recovery-error" id="backup-error" role="alert">{t(props.error)}</p>}<button className="button primary wide" disabled={props.sending}>{t(props.sending?'Please wait…':props.sent?'Sign in':'Send verification code')}<ArrowRight size={18}/></button>{props.sent&&<button type="button" className="recovery-reset" disabled={props.sending} onClick={props.onReset}>{t('Use another email / resend')}</button>}
  </form><p className="recovery-security"><LockKeyhole size={15}/>{t('Only your linked email can open this account.')}</p><div className="recovery-bottom"><p>{t('New here? Create your account with X first.')}</p><button className="text-button" disabled={props.sending} onClick={props.onClose}>{t('Back to Support Me')}<ArrowRight size={15}/></button></div>
 </section></div>,document.body);
}
