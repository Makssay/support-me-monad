import { parseUnits, formatUnits } from 'ethers';
import { t, useLocale, localeTag, counted, number as num } from './i18n';
import { useApp } from './state';
import { sameAddress } from '../shared/model';
import { identityWallets } from '../shared/identity-profiles';
export default function CreatorRecord({address,wallets}:{address:string;wallets?:string[]}){ useLocale();
 const {state}=useApp();const accounts=wallets||identityWallets(address,state?.profiles);const missions=state?.missions.filter(m=>accounts.some(a=>sameAddress(m.creator,a)))||[];
 const work=state?.contributions.filter(c=>missions.some(m=>m.id===c.missionId))||[];
 const paid=work.filter(c=>c.status===1);const closed=missions.filter(m=>m.closed&&!paid.some(c=>c.missionId===m.id));
 const overdue=(c:typeof work[number])=>{const m=missions.find(m=>m.id===c.missionId);return (c.status===0&&(m?.reviewDeadline||Infinity)<Date.now()/1000)||(c.status===5&&!!c.reason);};
 const missed=work.filter(c=>{const m=missions.find(m=>m.id===c.missionId);return m?.mode!==4&&m?.mode!==5&&overdue(c);});
 const aiMissed=work.filter(c=>missions.find(m=>m.id===c.missionId)?.mode===5&&overdue(c));
 const tokens=new Map<string,{symbol:string;decimals:number;amount:bigint}>();for(const c of paid){if(c.rewardAsset){const a=c.rewardAsset;const entry=tokens.get(a.address)||{symbol:a.symbol,decimals:a.decimals,amount:0n};entry.amount+=parseUnits(c.paid,a.decimals);tokens.set(a.address,entry);}}
 return <section className="creator-record" aria-label={t("Creator payment history")}><h3>{paid.length?t("Creator payment history"):t("No payout history yet")}</h3><div><span><strong>{paid.filter(c=>!c.rewardAsset).reduce((n,c)=>n+Number(c.paid),0).toLocaleString(localeTag(),{maximumFractionDigits:5})} MON</strong> {t("paid")}</span>{[...tokens].map(([token,v])=><span key={token}><strong>{num(formatUnits(v.amount,v.decimals))} {v.symbol}</strong> {t("paid")}</span>)}<span><strong>{paid.length}</strong> {t("rewards")}</span><span><strong>{missed.length}</strong> {t("creator reviews missed")}</span>{aiMissed.length>0&&<span><strong>{aiMissed.length}</strong> {t("AI selections missed")}</span>}<span><strong>{closed.length}</strong> {t("closed without payouts")}</span></div><small>{t("Payment and review history is public. Raffle results and AI selections are tracked separately from creator reviews.")}</small></section>;
}
