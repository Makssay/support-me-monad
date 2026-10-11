import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DynamicContextProvider, getAuthToken, useConnectWithOtp, useDynamicContext, useIsLoggedIn, useProjectSettings, useSocialAccounts, useUserWallets } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum-core';
import { DynamicWaasEVMConnectors } from '@dynamic-labs/waas-evm';
import { Configuration, ProviderEnum, SDKApi } from '@dynamic-labs/sdk-api-core';
import { create7702DelegationRegistry, sendSponsoredTransaction } from '@dynamic-labs/ethereum-gasless-core';
import type { Hex } from 'viem';
import type { AuthSession, AuthWallet } from './state';
import BackupSignInDialog from './backup-signin-dialog';
import { dynamicWalletProvider } from './dynamic-wallet-provider';

function DynamicBridge({ environmentId, chainId, gasSponsorship, onSession }: { environmentId:string; chainId:number; gasSponsorship:boolean; onSession:(auth:AuthSession)=>void }) {
 const { sdkHasLoaded, user, handleLogOut, setShowDynamicUserProfile } = useDynamicContext();
 const authenticated = useIsLoggedIn();
 const wallets = useUserWallets();
 const social = useSocialAccounts();
 const otp = useConnectWithOtp();
 const project = useProjectSettings();
 const [attempt, setAttempt] = useState(0);
 const [membership, setMembership] = useState<{ id:string; member:NonNullable<AuthSession['member']> }>();
 const [error, setError] = useState(''); const [needsX,setNeedsX] = useState(false);
 const [backup,setBackup] = useState(false); const [email,setEmail] = useState(''); const [code,setCode] = useState('');
 const [sent,setSent] = useState(false); const [sending,setSending] = useState(false); const [emailError,setEmailError] = useState('');
 const delegation = useRef(create7702DelegationRegistry());
 const accessToken = useCallback(async () => getAuthToken() || null, []);
 const retry = useCallback(() => setAttempt(n=>n+1), []);
 const login = useCallback(() => { void social.signInWithSocialAccount(ProviderEnum.Twitter).catch(()=>setError('Sign in could not load. Please retry.')); }, [social.signInWithSocialAccount]);
 const linkX = useCallback(() => { void social.linkSocialAccount(ProviderEnum.Twitter).catch(()=>setError('Sign in could not load. Please retry.')); }, [social.linkSocialAccount]);
 const loginBackup = useCallback(() => {setSent(false);setEmail('');setCode('');setEmailError('');setBackup(true);}, []);
 const identity = JSON.stringify(user?.verifiedCredentials);
 const member = authenticated && membership?.id === user?.userId ? membership?.member : undefined;
 useEffect(()=>{
  let cancelled=false;setMembership(undefined);setError('');setNeedsX(false);
  if(!sdkHasLoaded||!authenticated||!user)return;
  void (async()=>{
   try {
    const token=await accessToken();if(!token)throw new Error();
    const response=await fetch('/api/auth/session',{method:'POST',headers:{Authorization:`Bearer ${token}`,'X-Auth-Provider':'dynamic'},redirect:'error'});
    const data=await response.json();if(cancelled)return;
    if(!response.ok){setError(data.error||'Your account could not be verified.');setNeedsX(data.code==='X_REQUIRED');return;}
    setMembership({id:user.userId!,member:data});setBackup(false);
   }catch{if(!cancelled)setError('Account verification is unavailable. Please retry.');}
  })();return()=>{cancelled=true;};
 },[sdkHasLoaded,authenticated,user?.userId,identity,attempt,accessToken]);
 const sdkApi=useMemo(()=>new SDKApi(new Configuration({accessToken:()=>getAuthToken()||''})),[]);
 const allowedWallets=useMemo<AuthWallet[]>(()=> !member ? [] : wallets.filter(isEthereumWallet).filter(w=>user?.verifiedCredentials.some(c=>c.format==='blockchain'&&c.walletProvider==='embeddedWallet'&&!!c.embeddedWalletId&&c.address?.toLowerCase()===w.address.toLowerCase())).map(w=>({
  address:w.address,label:'Support Me wallet',getProvider:async()=>dynamicWalletProvider(w),switchChain:async(id)=>{await w.switchNetwork(id);},
  sendSponsored:gasSponsorship ? async(tx)=>{
   if(tx.chainId!==chainId)throw new Error('Gas sponsorship was not verified for this chain.');
   const settings=project?.sdk.embeddedWallets;
   if(!settings?.evmGasSponsorshipEnabled||settings.evmGasSponsorshipRelayMode==='serverOnly')throw new Error('Gas sponsorship is unavailable. Please retry later.');
   await w.switchNetwork(chainId);
   const [walletClient,publicClient]=await Promise.all([w.getWalletClient(String(chainId)),w.getPublicClient()]);
   // The MPC signing transport serializes EIP-712 messages as JSON.
   const signingClient={...walletClient,signTypedData:((params:any)=>walletClient.signTypedData({...params,message:JSON.parse(JSON.stringify(params.message,(_key,value)=>typeof value==='bigint'?value.toString():value))})) as typeof walletClient.signTypedData};
   const result=await sendSponsoredTransaction({autoDelegate:true,calls:[{target:tx.to as Hex,data:tx.data as Hex,value:tx.value}]},{environmentId,sdkApi,chainId,walletClient:signingClient,publicClient,delegationRegistry:delegation.current});
   return result.transactionHash;
  }:undefined
 })),[member,wallets,user,gasSponsorship,project,chainId,environmentId,sdkApi]);
 const linkEmail=useCallback(()=>setShowDynamicUserProfile(true),[setShowDynamicUserProfile]);
 const session=useMemo<AuthSession>(()=>({provider:'dynamic',ready:sdkHasLoaded,authenticated,login,loginBackup,logout:handleLogOut,connectWallet:retry,retry,linkX,linkEmail,getAccessToken:accessToken,member,needsX,accountError:error,wallets:allowedWallets}),[sdkHasLoaded,authenticated,login,loginBackup,handleLogOut,retry,linkX,linkEmail,accessToken,member,needsX,error,allowedWallets]);
 useEffect(()=>onSession(session),[session,onSession]);
 async function submitEmail(e:FormEvent){e.preventDefault();if(sending)return;setSending(true);setEmailError('');try{if(!sent){await otp.connectWithEmail(email.trim());setSent(true);}else{await otp.verifyOneTimePassword(code);setBackup(false);}}catch{setEmailError('Could not send a code. Use the backup email you already linked, or sign in with X.');}finally{setSending(false);}}
 return backup?<BackupSignInDialog email={email} code={code} sent={sent} sending={sending} error={emailError} onEmail={setEmail} onCode={setCode} onClose={()=>setBackup(false)} onReset={()=>{setSent(false);setCode('');setEmailError('');}} onSubmit={submitEmail}/>:null;
}
export default function DynamicAuth(props:{ environmentId:string; chainId:number; gasSponsorship:boolean; onSession:(auth:AuthSession)=>void }) {
 return <DynamicContextProvider settings={{environmentId:props.environmentId,walletConnectors:[DynamicWaasEVMConnectors],appName:'Support Me',appLogoUrl:`${location.origin}/mark.svg`,socialProvidersFilter:providers=>providers.filter(p=>p==='twitter'),overrides:{evmNetworks:[{iconUrls:[`${location.origin}/mark.svg`],blockExplorerUrls:[props.chainId===143?'https://monadscan.com':'https://testnet.monadscan.com'],chainId:props.chainId,name:props.chainId===143?'Monad':'Monad Testnet',networkId:props.chainId,nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:[props.chainId===143?'https://rpc.monad.xyz':'https://testnet-rpc.monad.xyz']}]}}} theme="dark"><DynamicBridge {...props}/></DynamicContextProvider>;
}
