import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { dynamicIdentity, dynamicIssuer, verifyDynamicToken } from '../server/dynamic-auth';
import { enroll, ownsWallet } from '../server/account-policy';
import { dynamicWalletProvider } from '../src/dynamic-wallet-provider';

const environment='a51a05b7-b985-4218-b365-74736013c3f8';
const subject='11111111-2222-4333-8444-555555555555';
const address='0x1111111111111111111111111111111111111111';
const origin='https://support-me-monad.vercel.app';
const x={format:'oauth',oauth_provider:'twitter',oauth_account_id:'12345',oauth_username:'creator'};
const wallet={format:'blockchain',chain:'EVM',wallet_provider:'embeddedWallet',embedded_wallet_id:'embedded-1',address};
function profile(credentials:unknown[]){return {id:subject,projectEnvironmentId:environment,verifiedCredentials:credentials};}
test('Dynamic verifier rejects wrong origins, issuers, environments, expiry and forged signatures',async()=>{
 const pair=await generateKeyPair('RS256');
 async function token(overrides:Record<string,unknown>={}){return new SignJWT({environment_id:environment,sub:subject,scope:'user:basic',iss:dynamicIssuer(environment),aud:origin,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,...overrides}).setProtectedHeader({alg:'RS256'}).sign(pair.privateKey);}
 assert.equal((await verifyDynamicToken(await token(),environment,[origin],pair.publicKey)).sub,subject);
 for(const overrides of [{aud:'https://attacker.example'},{iss:'attacker'},{environment_id:subject},{exp:1},{sub:'untrusted'},{scope:undefined},{scope:'user:basic requiresAdditionalAuth'}])await assert.rejects(verifyDynamicToken(await token(overrides),environment,[origin],pair.publicKey));
 const forged=(await token()).split('.');forged[2]='A'.repeat(forged[2].length);await assert.rejects(verifyDynamicToken(forged.join('.'),environment,[origin],pair.publicKey));
});
test('Dynamic accounts require X and only embedded EVM wallets can authorize payouts',()=>{
 const user=dynamicIdentity(profile([x,wallet]),environment,subject);
 assert.equal(enroll(user,{}).xId,'12345');assert.equal(ownsWallet(user,address),true);
 assert.throws(()=>enroll(dynamicIdentity(profile([{format:'email',email:'backup@example.com'}]),environment,subject),{}),/Link X/);
 for(const change of [{wallet_provider:'browserExtension'},{embedded_wallet_id:undefined},{chain:'SOL'},{format:'oauth'}])assert.equal(ownsWallet(dynamicIdentity(profile([x,{...wallet,...change}]),environment,subject),address),false);
 assert.throws(()=>dynamicIdentity({...profile([x]),id:'different'},environment,subject),/mismatch/);
});
test('Existing Privy X membership cannot silently become a new Dynamic wallet',()=>{
 const member={userId:'did:privy:old',xId:'12345',username:'creator',joinedAt:1};
 assert.throws(()=>enroll(dynamicIdentity(profile([x,wallet]),environment,subject),{[member.userId]:member}),/already belongs/);
});
test('MPC message signing stays in wallet and rejects a different from address',async()=>{
 let signed='';let requests=0;
 const provider=dynamicWalletProvider({address,getNetwork:async()=>10143,switchNetwork:async()=>{},signMessage:async(message)=>{signed=message;return 'signature';},getWalletClient:async()=>({}),getPublicClient:async()=>({request:()=>{requests++;}})});
 assert.equal(await provider.request({method:'personal_sign',params:['0x6869',address]}),'signature');assert.equal(signed,'hi');assert.equal(requests,0);
 await assert.rejects(provider.request({method:'personal_sign',params:['0x6869','0x2222222222222222222222222222222222222222']}),/mismatch/);
 assert.equal(await provider.request({method:'eth_chainId'}),'0x279f');
});
