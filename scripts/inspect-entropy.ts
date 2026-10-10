import { checkedProvider } from './env';
import { Contract,id } from 'ethers';
const p=await checkedProvider();const target='0x825c0390f379C631f3Cf11A82a37D20BddF93c07';
try{console.log({chain:await p.send('eth_chainId',[]),runtimeLength:(await p.getCode(target)).length,proxySlot:await p.getStorage(target,'0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc')});for(const signature of ['getDefaultProvider()','getFeeV2()']){try{console.log({signature,result:await p.send('eth_call',[{to:target,data:id(signature).slice(0,10)},'latest'])});}catch(e:any){console.log({signature,errorCode:e.code,hasRevertData:!!e.data,rpcCode:e.info?.error?.code});}}}finally{p.destroy();}

