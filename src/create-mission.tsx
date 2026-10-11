import {missionTemplates, type MissionTemplate} from './mission-templates';
import './mission-templates.css';
import {PaymentFormat} from './payment-format';
import {FundingBreakdown} from './mission-experience';
import {CommunityEditor,draftPolicy,emptyCommunity, type CommunityDraft} from './community';
import {communityMessage,policyHash,tierForCommunity} from '../shared/community';
import {feeTier,creationFeeMon} from '../shared/fees';
import { nativeReward, type RewardAsset } from '../shared/rewards';
import { t, criterionLabel, useLocale, number as localizedNumber, counted } from './i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatEther, formatUnits, parseUnits, Interface, parseEther, ZeroAddress } from 'ethers';
import { ArrowLeft, ArrowUpRight, Plus, ShieldCheck, Trash2, Gift, Trophy, Ticket, CheckCircle2, ChevronDown, Coins, LockKeyhole } from 'lucide-react';
import { useApp } from './state';
import { categories, defaultMode, paymentModes, paymentRule, requiresXEvidence, socialPostId, sameAddress, shortAddress } from '../shared/model';
import abi from '../shared/abi.json';
import { AI_MODEL, AI_VERSION, DEFAULT_RUBRIC, MAX_AI_CRITERIA, parseRubric } from '../shared/ai';
import { StepTransition, TransitionLink } from './view-transitions';

const steps = ['Basic info', 'Reward', 'Details', 'Review'];
const num = (value: string | number) => localizedNumber(value);

export default function CreateMission() { useLocale(); 
 const { address, transact, busy, setWalletOpen, auth, config, sign, apiFetch, gasSponsored, state } = useApp();
 const navigate = useNavigate();
 const [step, setStep] = useState(0);
 const [template,setTemplate]=useState<MissionTemplate>();
 function applyTemplate(next:MissionTemplate) {
  setTemplate(next);setStep(0);setError('');setCategory(next.category);setMode(next.mode);
  setTitle(t(next.title));setDescription(t(next.brief));setRequirements(t(next.requirements));
  setTargetPost('');setSocial(false);setAIReview(false);setCriteria(parseRubric(DEFAULT_RUBRIC));
  setCommunity(next.id==='wallet'?{...emptyCommunity,nft:'list'}:next.id==='nft'?{...emptyCommunity,nft:'hold'}:next.id==='token'?{...emptyCommunity,token:true,tokenContract:'',tokenMinimum:'1'}:emptyCommunity);setAsset(nativeReward);setTokenInput('');setTokenError('');setTokenBalance('');
  tokenRequest.current++;setCheckingToken(false);setReward('0.01');setSlots('3');setDays('7');setReviewDays('3');setWorkHours('24');setQuick(false);
 }
 const compact=!!template&&step!==3;
 const publishing = useRef(false);
 const [preparingPublication,setPreparingPublication] = useState(false);
 const [community,setCommunity]=useState<CommunityDraft>(emptyCommunity);
 let admissionPolicy:ReturnType<typeof draftPolicy>;let admissionError='';try{admissionPolicy=draftPolicy(community);}catch(e){admissionError=(e as Error).message;}
 const [title, setTitle] = useState('');
 const [description, setDescription] = useState('');
 const [requirements, setRequirements] = useState('');
 const [category, setCategory] = useState('Memes');
 const profile = state?.profiles.find(p => sameAddress(p.address, address));
 const username = auth?.member?.username || profile?.username;
 const name = username ? '@' + username.replace(/^@/, '') : shortAddress(address);
 const modeOptions = category === 'Bug hunting' ? [3] : [defaultMode(category), 0, ...(config?.aiController ? [5] : []), ...(category === 'Replies' ? [4] : (config?.version || 0) >= 6 ? [6] : [])].filter((v,i,a) => a.indexOf(v) === i);
 function chooseMode(next: number) { setError(''); tokenRequest.current++; setCheckingToken(false); setMode(next); if (next === 6 || next === 3) setAIReview(false); if ([4,5,6].includes(next) && Number(slots)>20) setSlots('20'); if (![4,5,6].includes(next) && Number(days) < 1) setDays('7'); }
 function chooseCategory(next: string) { setCategory(next); chooseMode(defaultMode(next)); }
 const [mode,setMode]=useState(0); const [targetPost,setTargetPost]=useState(''); const [reviewDays,setReviewDays]=useState('3'); const [workHours,setWorkHours]=useState('24');
 const [asset,setAsset]=useState<RewardAsset>(nativeReward);
 const [tokenInput,setTokenInput]=useState('');const [tokenBalance,setTokenBalance]=useState('');const [checkingToken,setCheckingToken]=useState(false);const [tokenError,setTokenError]=useState('');
 const tokenRequest=useRef(0);
 async function checkToken(){const request=++tokenRequest.current;setCheckingToken(true);setTokenError('');try{const r=await fetch(`/api/reward-tokens/lookup?token=${encodeURIComponent(tokenInput)}&wallet=${address}&ai=${mode===5?'1':'0'}`);const data=await r.json();if(request!==tokenRequest.current)return;if(!r.ok)throw new Error(data.error);setAsset(data.asset);setTokenBalance(data.balance||'0');setReward('1');}catch(e){if(request===tokenRequest.current)setTokenError(e instanceof Error?e.message:'Token lookup failed.');}finally{if(request===tokenRequest.current)setCheckingToken(false);}}
 const tokenMode=asset.source!=='native';
 const [reward, setReward] = useState('0.01');
 const [slots, setSlots] = useState('3');
 const [days, setDays] = useState('7');
 const [social, setSocial] = useState(false);
 const [aiReview,setAIReview]=useState(false);const [criteria,setCriteria]=useState(parseRubric(DEFAULT_RUBRIC));
 const [quick,setQuick]=useState(false);const [pythQuote,setPythQuote]=useState<string>();
 const protectedMode=(config?.version||0)>=3&&[0,1,2,4,6].includes(mode);
 useEffect(()=>{let alive=true;if(protectedMode&&[0,4,6].includes(mode)){setPythQuote(undefined);void fetch('/api/draw-fee').then(r=>r.ok?r.json():Promise.reject()).then(q=>{if(alive)setPythQuote(q.wei);}).catch(()=>{});}else setPythQuote('0');return()=>{alive=false;};},[mode,protectedMode]);
 const [error, setError] = useState('');
 // New missions use fixed templates; existing AI missions are handled elsewhere.
 const needsAI = false;
 const forcedX=category==='Replies'||mode===4||(needsAI&&requiresXEvidence({category,socialRequired:false}));
 const requireX=mode!==6&&(social||forcedX);
 const serviceTier=Math.max(feeTier(needsAI,requireX),tierForCommunity(admissionPolicy));const platformFee=(config?.version||0)>=5?parseEther(creationFeeMon(config!.chainId,serviceTier)):0n;
 const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
 let rubricError = '';
 if (needsAI) { try { parseRubric(JSON.stringify(criteria)); } catch (e) { rubricError = (e as Error).message; } }
 const heading = useRef<HTMLHeadingElement>(null);
 const previousStep = useRef(step);
 useEffect(() => {
  if (previousStep.current !== step) heading.current?.focus({ preventScroll: true });
  previousStep.current = step;
 }, [step]);
 let budget = '0';
 const durationLabel=quick?t('5 minutes'): Number(days)<1?(Number(days)<1/24?t('5 minutes'):t('1 hour')):counted(Number(days), 'day', ['день', 'дня', 'дней']);
 try { budget = formatUnits(parseUnits(reward || '0',asset.decimals) * BigInt(Number(slots) || 0),asset.decimals); } catch {}
 function changeStep(next: number) {
  setError('');
  setStep(next);
 }
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError('');
  if(!template||mode!==Number(template.mode)){setError('Choose an available template.');return;}
  if (category==='Replies'&&!socialPostId(targetPost)){if(step!==0)changeStep(0);setError('Use a public X post URL for the reply task.');return;}
  if(template.id==='token'&&!community.token){setError('Choose a community requirement.');return;}
  if(template.id==='wallet'&&community.nft!=='list'){setError('Choose a community requirement.');return;}
  if(template.id==='nft'&&community.nft!=='hold'){setError('Choose a community requirement.');return;}
  if((compact||step>=2)&&admissionError){setError(admissionError);return;}
  if((compact||step>=2)&&mode===6&&!admissionPolicy){setError('Choose a community requirement.');return;}
  if ((compact||step >= 2) && rubricError) { setError(rubricError); return; }
  if ((compact||step===1)&&tokenMode&&!asset.address){setError('Check and select a token before continuing.');return;}
  if (step < 3) { changeStep(template?3:step + 1); return; }
  if (publishing.current || busy) return;
  publishing.current=true;setPreparingPublication(true);
  try {
   if (auth && !auth.member?.username) throw new Error('Your X profile is still loading. Please retry shortly.');
   const amount = parseUnits(reward,asset.decimals); const count = Number(slots);
   if (amount <= 0n || !Number.isInteger(count) || count < 1 || count > ([4,5,6].includes(mode)?20:100) || title.trim().length < 5 || !description.trim() || !requirements.trim()) throw new Error('Check the brief, a positive reward, and the number of reward slots.');
   if(category==='Replies'&&!socialPostId(targetPost))throw new Error('Use a public X post URL for the reply task.');
   const useAI=needsAI;if(useAI){parseRubric(JSON.stringify(criteria));if(!config?.aiConfigured)throw new Error('AI unavailable.');}
   let communitySummary;
   if(admissionPolicy){const hash=policyHash(admissionPolicy);const timestamp=Date.now();const signature=await sign(communityMessage('Prepare community policy',config!.chainId,config!.contractAddress,address,timestamp,hash));const r=await apiFetch('/api/community/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({policy:admissionPolicy,wallet:address,timestamp,signature,mode,quick})});communitySummary=await r.json();if(!r.ok)throw new Error(communitySummary.error);}
   const metadata = JSON.stringify({ communityHash:communitySummary?.hash||'',communitySummary:communitySummary?JSON.stringify(communitySummary):'',title: title.trim(), description: description.trim(), category, requirements: requirements.trim(), creatorName: name.trim(), socialRequired: requireX,targetPost:category==='Replies'?targetPost.trim():'',aiReview:useAI,aiModel:useAI?AI_MODEL:'',aiVersion:useAI?AI_VERSION:'',aiRubric:useAI?JSON.stringify(criteria):'' });
   if (new TextEncoder().encode(metadata).length > 4096) throw new Error('The brief is too long. Shorten it before publishing.');
   if(mode===5&&(count>20||!config?.aiController))throw new Error('AI contest requires 1–20 prizes and a deployed controller.');
   let deadline=Math.floor(Date.now()/1000)+(quick?300:Math.round(Number(days)*86400));
   const reviewSeconds=quick?300:Math.round(Number(reviewDays)*86400);const workSeconds=quick?300:Math.round(Number(workHours)*3600);
   const pythReserve=protectedMode&&[0,4,6].includes(mode)?BigInt(pythQuote||'0')*2n:0n;
   if(protectedMode&&[0,4,6].includes(mode)&&!pythQuote)throw new Error('Pyth quote unavailable. Retry before funding.');
   const executionReserve=protectedMode?parseEther('0.3'):0n;
   let tokenQuote:any;
   if(tokenMode){
    if((config?.version||0)<4)throw new Error('Token rewards require the upgraded escrow contract.');
    const response=await fetch(`/api/reward-tokens/lookup?token=${asset.address}&wallet=${address}&ai=${mode===5?'1':'0'}`);tokenQuote=await response.json();if(!response.ok)throw new Error(tokenQuote.error);
    if(tokenQuote.asset.decimals!==asset.decimals)throw new Error('Token metadata changed. Select it again.');
    const total=amount*BigInt(count);if(parseUnits(tokenQuote.balance,asset.decimals)<total)throw new Error('Insufficient reward token balance.');
    const spender=mode===5?config!.aiController!:config!.contractAddress;
    const allowance=BigInt(tokenQuote.allowance||'0');
    if(allowance!==total){if(allowance>0n){if(!await transact('Reward token approval reset','approveRewardToken',[asset.address,spender,0n]))return;}if(!await transact('Reward token approved','approveRewardToken',[asset.address,spender,total]))return;}
    // Refresh short-lived admission after the user completes wallet confirmations.
    const fresh=await fetch(`/api/reward-tokens/lookup?token=${asset.address}&wallet=${address}&ai=${mode===5?'1':'0'}`);tokenQuote=await fresh.json();if(!fresh.ok)throw new Error(tokenQuote.error);
    deadline=Math.floor(Date.now()/1000)+(quick?300:Math.round(Number(days)*86400));
   }
   const tokenArgs=mode===5?[asset.address,amount,count,deadline,reviewSeconds,metadata,tokenQuote?.validUntil,tokenQuote?.signature]:[{token:asset.address,reward:amount,slots:count,deadline,reviewWindow:reviewSeconds,mode,workWindow:workSeconds,protectedMode,pythReserve,executionReserve,feeTier:serviceTier},metadata,tokenQuote?.validUntil,tokenQuote?.signature];
   const gatedArgs=[{token:tokenMode?asset.address:ZeroAddress,reward:amount,slots:count,deadline,reviewWindow:reviewSeconds,mode:mode===6?5:mode===5?0:mode,workWindow:workSeconds,protectedMode,pythReserve,executionReserve,feeTier:serviceTier},metadata,communitySummary?.hash, ...(mode===5?[]:[communitySummary?.recheck]),communitySummary?.recoveryWindow,tokenQuote?.validUntil||0,tokenQuote?.signature||'0x'];
   const receipt = communitySummary?await transact('Mission published & funded',mode===5?'createGatedContest':'createGatedMission',gatedArgs,(tokenMode?0n:amount*BigInt(count))+pythReserve+executionReserve+platformFee):tokenMode?await transact('Mission published & funded',mode===5?'createTokenContest':'createTokenMission',tokenArgs,pythReserve+executionReserve+platformFee):await transact('Mission published & funded', mode===5?'createContest':protectedMode?'createMissionV3':(config?.version||0)>=5?'createMissionPaid':'createMissionV2',mode===5?[amount,deadline,reviewSeconds,metadata]:protectedMode?[amount,count,deadline,reviewSeconds,mode,workSeconds,metadata,pythReserve,executionReserve,...((config?.version||0)>=5?[serviceTier]:[])]:[amount,deadline,reviewSeconds,mode,workSeconds,metadata,...((config?.version||0)>=5?[serviceTier]:[])],amount*BigInt(count)+pythReserve+executionReserve+platformFee);
   if (receipt) {
    const iface = new Interface(abi);
    const created = receipt.logs.map(log => { try { return iface.parseLog(log); } catch { return null; } }).find(log => log?.name === 'MissionCreated');
    if (!created) { setError('Mission funded. Open My missions to find it.'); return; }
    navigate(`/mission/${created.args.missionId}`);
   }
  } catch(e) { setError(e instanceof Error&&e.message.length<200?e.message:'Could not publish. Check your brief and reward settings, then retry.'); }
  finally {publishing.current=false;setPreparingPublication(false);}
 }
 return <div className="page narrow-page create-page">
  <TransitionLink className="back-link" to="/"><ArrowLeft size={16}/>{t("All missions")}</TransitionLink>
  <div className="page-title"><span className="title-symbol"><Plus size={30}/></span><h1>{t("Ask for a little help.")}</h1><p>{t("A clear brief. A fair reward. Something worth showing up for.")}</p></div>
  {!template&&<section className="template-picker" aria-labelledby="templates-heading"><div className="template-heading"><div><span className="preview-eyebrow">{t('LESS SETUP. MORE GOOD WORK.')}</span><h2 id="templates-heading">{t('Start with a template')}</h2><p>{t('Pick a goal. The payment format and checks are already set.')}</p></div></div><div className="template-grid">{missionTemplates.map(item=><button type="button" key={item.id} className="template-tile" onClick={()=>applyTemplate(item)}><img src={`/art/templates/${item.id}.webp`} alt="" width={480} height={480}/><span><strong>{t(item.title)}</strong><small>{t(item.summary)}</small></span><ArrowUpRight size={18}/></button>)}<button type="button" className="template-tile template-soon" disabled aria-describedby="builder-soon-description"><img src="/art/templates/builder.webp" alt="" width={480} height={480}/><span><strong>{t("Custom builder")} <b className="soon-badge">SOON</b></strong><small id="builder-soon-description">{t("Your own payment formats and flexible settings. Coming soon.")}</small></span></button></div><p className="template-hint">{t('Templates are editable starting points. Nothing is published or charged when you choose one.')}</p></section>}
  {template&&<div className="selected-template"><img src={`/art/templates/${template.id}.webp`} alt="" width={64} height={64}/><div><small>{t('YOUR TEMPLATE')}</small><strong>{t(template.title)}</strong><span>{t(template.summary)}</span></div><button className="button secondary" type="button" disabled={busy||preparingPublication} onClick={()=>{setTemplate(undefined);changeStep(0);}}>{t('Change template')}</button></div>}
  {!template?null:!address ? <div className="empty"><h3>{t("Make yourself part of it.")}</h3><p>{t("Sign in to create a mission and fund its rewards.")}</p><button className="button primary" onClick={() => setWalletOpen(true)}>{auth ? t("Sign in") : t("Connect wallet")}</button></div> : <div className="form-layout">
   <form id="custom-mission" className={`mission-form ${compact?"template-form":""}`} onSubmit={submit}>
    {!template&&<ol className="wizard-steps" aria-label={t("Mission creation progress")}>{steps.map((label,index) => <li key={label} aria-current={index === step ? 'step' : undefined}><span>{index+1}</span>{t(label)}</li>)}</ol>}
    <div className="wizard-panels">{steps.map((label, panel) => { const content = <>
     <h2 id={`step-heading-${panel}`} ref={element => { if (element && panel === step) heading.current = element; }} tabIndex={-1}>{t(label)}</h2>
     {panel === 0 && <>
      <div className="creator-identity"><span className="identity-avatar">{profile?.avatarUrl?<img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer"/>:<ShieldCheck size={20}/>}</span><span><small>{t("Publishing as")}</small><strong>{name}</strong></span><span className="identity-connected"><CheckCircle2 size={15}/>{t(username?"Connected through X":"Connected wallet")}</span></div>
      <label>{t("Mission title")}<input required minLength={5} maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder={t("Make a meme for our launch")}/></label>

      <details className="form-disclosure"><summary><ShieldCheck size={17}/>{t("How rewards work")}<ChevronDown size={17}/></summary><p>{t(paymentRule(mode,protectedMode))}</p>{mode===6&&<p>{t("A raffle is one payment format. Discord, NFT and lists only decide who can enter. Add at least one access requirement in Details for an entry-only raffle.")}</p>}</details>
      {category==='Replies'&&<label>{t("Contest post URL")}<input type="url" required maxLength={300} value={targetPost} onChange={e=>{setTargetPost(e.target.value);setError('');}} placeholder="https://x.com/creator/status/…"/><small>{mode===4?t("Only direct replies from the connected X account, posted during the mission, can enter. Maximum 256 entries; up to 20 equal prizes."):t("X API checks that the contribution is a direct reply to this post. The payment format decides who receives a reward.")}</small></label>}
     </>}
     {panel === 1 && <>
      {platformFee>0n&&<div className="creation-fee"><Coins size={26}/><div><small>{t("Platform creation fee")}</small><strong>{num(formatEther(platformFee))} MON</strong></div><p>{t("Includes the selected verification service. Changes when you enable X or AI checks.")}</p><small>{t("Up to 256 entries. Paid repeat checks are limited; no surprise charges.")}</small></div>}<details className="form-disclosure" open={template?undefined:true}><summary><Coins size={17}/>{t("Reward currency and test settings")}<ChevronDown size={17}/></summary><section className="reward-token-picker"><label>{t('Reward currency')}<select value={tokenMode?'token':'MON'} onChange={e=>{tokenRequest.current++;setCheckingToken(false);if(e.target.value==='MON'){setAsset(nativeReward);setTokenError('');}else{setTokenInput('');setAsset({...nativeReward,source:'nad.fun',symbol:'TOKEN',address:''});}}}><option value="MON">MON</option><option value="token" disabled={(config?.version||0)<4}>{t('nad.fun token')}</option></select></label>{tokenMode&&<><label>{t('nad.fun token URL or contract address')}<input maxLength={300} value={tokenInput} onChange={e=>{tokenRequest.current++;setCheckingToken(false);setTokenInput(e.target.value);setTokenBalance('');setTokenError('');setAsset({...nativeReward,source:'nad.fun',symbol:'TOKEN',address:''});}} placeholder={config?.chainId===143?"https://nad.fun/tokens/0x…":"https://testnet.nad.fun/tokens/0x…"}/></label><button type="button" className="button secondary" disabled={checkingToken||busy||!tokenInput.trim()} onClick={()=>void checkToken()}>{checkingToken?t('Checking token…'):t('Check token')}</button>{asset.address&&<div className="inline-note"><strong>{asset.name} ({asset.symbol})</strong><p>{t('Your token balance')}: {num(tokenBalance)} {asset.symbol}</p><a href={asset.url} target="_blank" rel="noopener noreferrer">{t('View on nad.fun')}</a><small>{asset.address}</small></div>}{tokenError&&<p role="alert" className="form-error">{t(tokenError)}</p>}<p className="payment-note">{t('Rewards use this token. Gas, Pyth and execution reserves use MON. Token prices and liquidity are not guaranteed.')}</p></>}</section>
      {config?.chainId!==143&&<label className="checkbox-label"><input type="checkbox" checked={quick} onChange={e=>setQuick(e.target.checked)}/><span>{t("Quick test · every stage is 5 minutes")}<small>{t("Testnet only. Submissions, review and delivery use five-minute windows. Pyth callback timing is external.")}</small></span></label>}</details>
      <div className="form-pair"><label>{t("Reward per contribution")}<span className="input-unit"><input aria-label={t("Reward per contribution")} required inputMode="decimal" type="number" min={formatUnits(1n,asset.decimals)} step={formatUnits(1n,asset.decimals)} value={reward} onChange={e => setReward(e.target.value)}/><span>{asset.symbol}</span></span></label><label>{t("Reward slots")}<input required type="number" min="1" max={[4,5,6].includes(mode)?20:100} step="1" value={slots} onChange={e => setSlots(e.target.value)}/></label></div>
      <label>{t("Accept submissions for")}<select disabled={quick} value={quick?"quick":days} onChange={e => setDays(e.target.value)}>{quick&&<option value="quick">{t("5 minutes · demo")}</option>}{[...([4,5,6].includes(mode)&&config?.chainId!==143?[1/288,1/24]:[]),1,3,7,14,30].map(d => <option key={d} value={d}>{d<1?d<1/24?t("5 minutes · demo"):t("1 hour"):counted(d,'day',['день','дня','дней'])}</option>)}</select></label>
      {!template&&protectedMode&&<div className="reserve-summary"><div><LockKeyhole size={23}/><span><small>{t("Execution reserve")}</small><strong>0.3 MON</strong></span></div>{[0,4,6].includes(mode)&&<div><Ticket size={23}/><span><small>{t("Randomness reserve")}</small><strong title={pythQuote?formatEther(BigInt(pythQuote)*2n)+' MON':undefined}>{pythQuote?new Intl.NumberFormat(undefined,{maximumSignificantDigits:6,roundingMode:'ceil'} as Intl.NumberFormatOptions).format(Number(formatEther(BigInt(pythQuote)*2n))):t("Loading…")} MON</strong></span></div>}<p>{t("Unused reserves return to you. Prize funds stay separate.")}</p></div>}
      <p className="inline-note"><ShieldCheck size={18}/>{t("Prize budget") } {num(budget)} {asset.symbol} {t("when you publish.")}</p>
      {![4,6].includes(mode)&&<details className="form-disclosure" open={template?undefined:true}><summary><ShieldCheck size={17}/>{t("Review timing")}<ChevronDown size={17}/></summary><label>{t("Review period after submissions close")}<select disabled={quick} value={quick?"quick":reviewDays} onChange={e=>setReviewDays(e.target.value)}>{quick&&<option value="quick">{t("5 minutes")}</option>}{[1,3,7].map(d=><option key={d} value={d}>{counted(d,"day",["день","дня","дней"])}</option>)}</select></label></details>}
      {[1,2].includes(mode)&&<label>{t("Time to deliver after reservation / selection")}<select disabled={quick} value={quick?"quick":workHours} onChange={e=>setWorkHours(e.target.value)}>{quick&&<option value="quick">{t("5 minutes")}</option>}{[1,6,24,72,168].map(h=><option key={h} value={h}>{counted(h,"hour",["час","часа","часов"])}</option>)}</select><small>{t("Delivery must also be before the submission deadline.")}</small></label>}
      {protectedMode&&<details className="form-disclosure"><summary><ShieldCheck size={17}/>{t("Reserves, deadlines and refunds")}<ChevronDown size={17}/></summary><p>{t("Unused reserves return to the creator. Rewards are separate. The server executes automatically while online; anyone can also trigger settlement.")}</p>{[0,4,6].includes(mode)&&<p>{t("If Pyth remains unavailable for 7 days after review ends, unspent prizes return to the creator. Anyone can process the refund in batches. Already paid rewards are preserved.")}</p>}{mode===0&&<p>{t("Choose winners before the review deadline. Remaining prizes are drawn randomly among remaining submissions. Contest entries cannot be rejected or expired.")}</p>}{[1,2].includes(mode)&&<p>{t("Delivered reserved work is paid automatically if the creator misses the review deadline.")}</p>}{[4,6].includes(mode)&&<p>{t("Pyth and execution reserves are funded now. After the deadline the draw starts automatically while the server is online. If fewer people enter than prizes, everyone wins once and unused prizes return to you.")}</p>}</details>}

     </>}
     {panel === 2 && <>
      <details className="form-disclosure" open={['nft','token','wallet'].includes(template?.id||'')||!template?true:undefined}><summary><ShieldCheck size={17}/>{t(template?.id==='wallet'?"Wallet list requirements":template?.id==='token'?"Token holder requirements":template?.id==='nft'?"NFT holder requirements":"Community access and extra checks")}<ChevronDown size={17}/></summary><CommunityEditor value={community} onChange={next=>{setCommunity(next);setError('');}} nftOnly={template?.id==='nft'} tokenOnly={template?.id==='token'} listOnly={template?.id==='wallet'}/></details>
      <label>{t("The brief")}<textarea aria-label={t("The brief")} required rows={5} maxLength={1800} value={description} onChange={e => setDescription(e.target.value)} placeholder={t("What are you making, and how can someone help?")}/></label>
      <label>{t("What makes a great contribution?")}<textarea aria-label={t("What makes a great contribution?")} required rows={3} maxLength={1000} value={requirements} onChange={e => setRequirements(e.target.value)} placeholder={t("Publish objective acceptance criteria. For bugs, define scope, reproduction steps and the duplicate rule.")}/></label>
      {mode!==6&&<label className="checkbox-label"><input type="checkbox" checked={requireX} disabled={forcedX} onChange={e => setSocial(e.target.checked)}/><span>{t("Require a public X / Twitter post link")}<small>{t("X API retrieves the publication. The creator checks quality unless AI judging is selected.")}</small></span></label>}
      <p className="payment-note">{mode===6?t("Verify community access and enter. No reply or work is required; Pyth randomly selects winners."):mode===4?t("X API confirms the reply belongs to your connected X account, the target post and publication date. AI is optional; Pyth selects winners randomly."):needsAI&&requireX?t("X API + AI: X API retrieves the real post; AI assesses only its verified text. If the post cannot be confirmed, AI assessment pauses. Text from the form cannot replace it."):needsAI?t("AI assesses the text submitted here. If an X post link is supplied, X API must confirm its text first. Images and external work links require human review."):t("Without AI, the creator reviews the work. X API can confirm a public post, but does not judge its quality.")}</p>
      <label className="checkbox-label ai-soon"><input type="checkbox" checked={false} disabled/><span>{t("AI verification")} <b className="soon-badge">SOON</b><small>{t("Review contributions against your criteria. Coming soon; no AI checks or AI fees for this mission.")}</small></span></label>
      {needsAI&&<section className="ai-policy"><h3>{mode===5?t("Freeze the judging rubric."):t("What should AI check?")}</h3><p>{t("Text and verified X content only. Images, external links and reproduced bugs require human review. Conditions cannot change after funding.")}</p>{criteria.map((c,i)=><div className="criterion-row" key={i}><label>{t("Criterion")} {i+1}<input required maxLength={160} value={c.criterion} onChange={e=>setCriteria(criteria.map((v,j)=>i===j?{...v,criterion:e.target.value}:v))}/>{criterionLabel(c.criterion)!==c.criterion&&<small>{criterionLabel(c.criterion)}</small>}</label><label>{t("Weight %")}<input aria-label={t("Weight for criterion {index}", {index:i+1})} required type="number" min={1} max={100} step={1} value={c.weight || ''} onChange={e=>setCriteria(criteria.map((v,j)=>i===j?{...v,weight:Number(e.target.value)}:v))}/></label><button className="icon-button criterion-remove" type="button" disabled={criteria.length===1} aria-label={t("Remove criterion {index}",{index:i+1})} onClick={()=>setCriteria(criteria.filter((_,j)=>i!==j))}><Trash2 size={17}/></button></div>)}
       <div className="rubric-toolbar"><button className="button secondary" type="button" disabled={criteria.length>=MAX_AI_CRITERIA} onClick={()=>setCriteria([...criteria,{criterion:'',weight:10}])}><Plus size={16}/>{t("Add criterion")}</button><span>{t("{count} / 10 criteria",{count:criteria.length})}</span></div>
       <div className={`rubric-total ${rubricError?'invalid':'valid'}`} role="status" aria-live="polite"><strong>{t("Total weight: {total}% / 100%",{total:totalWeight})}</strong><span>{totalWeight<100?t("Add {amount}% to reach 100%.",{amount:100-totalWeight}):totalWeight>100?t("Remove {amount}% to reach 100%.",{amount:totalWeight-100}):rubricError?t(rubricError):t("Ready: all weights add up to 100%.")}</span></div><small>{t("Weights must total 100. AI uses a fixed review policy. Follower counts and wallet balances do not influence scoring.")}</small></section>}
     </>}
     {panel === 3 && <dl className="mission-review" tabIndex={0} aria-label={t("Mission review")}>
      <div><dt>{t("Mission")}</dt><dd>{title}</dd></div><div><dt>{t("Creator · category")}</dt><dd>{name} · {t(category)}</dd></div>
      {admissionPolicy&&<div><dt>{t('Community access')}</dt><dd>{[community.xBlue?t('Only X accounts with a blue checkmark'):'',community.discord!=='none'?t('Discord requirement'):'',community.nft!=='none'?t('Wallet / NFT requirement'):'',community.token?t('Token holder requirements'):''].filter(Boolean).join(' + ')} · {t('Requirements are fixed when funded.')}</dd></div>}{admissionPolicy?.nft?.kind==='list'&&<div><dt>{t('Eligible wallets')}</dt><dd>{admissionPolicy.nft.addresses?.length} · {t('The list cannot change after funding.')}</dd></div>}{admissionPolicy?.token&&<><div><dt>{t('Token contract')}</dt><dd>{admissionPolicy.token.contract}</dd></div><div><dt>{t('Minimum token balance')}</dt><dd>{admissionPolicy.token.minimum}</dd></div></>}<div><dt>{t("Payment agreement")}</dt><dd>{t(paymentModes[mode])} — {t(paymentRule(mode,protectedMode))}</dd></div>{category==='Replies'&&<div><dt>{t("Reply to")}</dt><dd>{targetPost}</dd></div>}
      {needsAI&&<div><dt>{t("Fixed AI policy")}</dt><dd>{criteria.map(c=>`${c.weight}% ${criterionLabel(c.criterion)}`).join(' · ')}. {mode===5?t("After the deadline: eligible entries ranked by weighted score, earlier onchain entry breaks ties. Uncertain evidence pauses selection. No manual override; service failure unlocks a refund after the review deadline."):mode===4?t("Pass required for entry; uncertain or failed replies do not enter."):t("Advisory review; approval still belongs to the creator.")}</dd></div>}
      <div><dt>{t("The brief")}</dt><dd>{description}</dd></div>{requirements && <div><dt>{t("What good looks like")}</dt><dd>{requirements}</dd></div>}
      <div><dt>{t("Reward & funding")}</dt><dd>{num(reward)} {asset.symbol} × {counted(Number(slots),"slot",["награда","награды","наград"])} = {num(budget)} {asset.symbol}</dd></div>{platformFee>0n&&<div><dt>{t("Platform creation fee")}</dt><dd>{num(formatEther(platformFee))} MON · {t("One-time, non-refundable after successful creation")}</dd></div>}<div><dt>{t("Submission window")}</dt><dd>{durationLabel} · {requireX ? t("Public X post required") : t("Social link optional")}</dd></div>
      {![4,6].includes(mode)&&<div><dt>{t("Review deadline")}</dt><dd>{quick?t("5 minutes"):counted(Number(reviewDays),"day",["день","дня","дней"])} · {protectedMode?t("Timeout protection enabled"):t("Creator review required")}</dd></div>}
     </dl>}
    </>; return <fieldset key={label} className="wizard-panel" data-active={compact?panel<3:panel===step} disabled={compact?panel===3:panel!==step} inert={compact?panel===3:panel!==step} aria-hidden={compact?panel===3:panel!==step} aria-labelledby={`step-heading-${panel}`}>{panel === step ? <StepTransition step={step}><div className="wizard-step-content">{content}</div></StepTransition> : <div className="wizard-step-content">{content}</div>}</fieldset>; })}</div>
    {step===3&&<FundingBreakdown budget={budget} symbol={asset.symbol} tokenMode={tokenMode} fee={platformFee} pyth={protectedMode&&[0,4,6].includes(mode)?(pythQuote?BigInt(pythQuote)*2n:undefined):0n} execution={protectedMode?parseEther('0.3'):0n} gasSponsored={gasSponsored}/>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {step>=2&&admissionError&&<p className="form-error" role="alert">{t(admissionError)}</p>}
    <div className="wizard-actions"><button className="button secondary" type="button" disabled={busy || preparingPublication || step === 0} onClick={() => changeStep(template?0:step-1)}><ArrowLeft size={17}/>{t("Back")}</button><button className="button primary" disabled={busy || preparingPublication || (step>=2 && (!!rubricError||!!admissionError||mode===6&&!admissionPolicy))} type="submit">{step === 3 ? (busy || preparingPublication) ? t("Publishing…") : t("Publish & fund mission") : t(template?"Review mission":"Next")}<ArrowUpRight size={19}/></button></div>
    <p className="form-footnote">{step === 3 ? tokenMode?t("Approve the exact token budget, then publish and fund. MON reserves are separate."):t("One transaction publishes the mission and funds its rewards. Wallet gas is additional.") : t("Your changes stay here as you move between steps. Funding happens only when you publish.")}</p>
   </form>
   <aside className="funding-preview"><div className="preview-eyebrow"><span>{t("MISSION REWARDS")}</span><Gift size={27}/></div><h3>{t("A little support goes a long way.")}</h3><div className="big-budget">{num(budget)}<span>{asset.symbol}</span><small>{t("Total prize pool")}</small></div><dl><div><dt><Trophy size={19}/>{t("Per reward")}</dt><dd>{num(reward || 0)} {asset.symbol}</dd></div><div><dt><ShieldCheck size={19}/>{t("Reward places")}</dt><dd>{slots || 0}</dd></div><div><dt><Ticket size={19}/>{t("Payment format")}</dt><dd>{t(paymentModes[mode])}</dd></div></dl><div className="preview-note"><ShieldCheck size={18}/><p>{t([4,6].includes(mode)?"Winners are drawn randomly with Pyth. Access requirements decide who can enter, not who wins.":mode===5?"The fixed AI rubric determines the winners. Your criteria cannot change after funding.":"Rewards are funded upfront. The published rules determine who gets paid.")}</p></div><small>{t("Terms and budget are fixed when published. No independent jury or dispute resolution in this MVP.")}</small></aside>
  </div>}
 </div>;
}
