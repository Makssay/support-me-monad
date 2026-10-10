import { useEffect, useRef, useState } from 'react';
export interface ContributionDraft {name:string;text:string;url:string;}
const empty:ContributionDraft={name:'',text:'',url:''};
export function draftKey(chain:number,contract:string,wallet:string,id:string,delivery:boolean){return `support.contribution.v1:${chain}:${contract.toLowerCase()}:${wallet.toLowerCase()}:${id}:${delivery?'delivery':'entry'}`;}
export function readDraft(storage:Pick<Storage,'getItem'>,key:string,now=Date.now()):ContributionDraft|undefined {
 try{const d=JSON.parse(storage.getItem(key)||'null');if(!d||d.version!==1||!Number.isFinite(d.savedAt)||now-d.savedAt>30*86400000||d.savedAt>now+60000)return;
 if(typeof d.name!=='string'||typeof d.text!=='string'||typeof d.url!=='string'||d.name.length>40||d.text.length>2600||d.url.length>400)return;
 return {name:d.name,text:d.text,url:d.url};}catch{return;}
}
export function useContributionDraft(key:string|undefined){
 const [draft,setDraft]=useState<ContributionDraft>(empty);const [loaded,setLoaded]=useState<string>();const [saved,setSaved]=useState(false);const [storageError,setStorageError]=useState(false);const cleared=useRef(false);
 useEffect(()=>{cleared.current=false;setStorageError(false);let restored:ContributionDraft|undefined;try{if(key)restored=readDraft(localStorage,key);}catch{setStorageError(true);}setDraft(restored||empty);setSaved(!!restored);setLoaded(key);},[key]);
 useEffect(()=>{if(!key||loaded!==key||cleared.current)return;try{if(draft.name||draft.text||draft.url){localStorage.setItem(key,JSON.stringify({...draft,version:1,savedAt:Date.now()}));setSaved(true);}else{localStorage.removeItem(key);setSaved(false);}}catch{setStorageError(true);setSaved(false);}},[key,loaded,draft]);
 function update(field:keyof ContributionDraft,value:string){cleared.current=false;setDraft(d=>({...d,[field]:value}));}
 function clear(){cleared.current=true;try{if(key)localStorage.removeItem(key);}catch{}setSaved(false);}
 function discard(){clear();setDraft(empty);}
 return {draft,update,clear,discard,saved,storageError};
}
