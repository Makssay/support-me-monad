// Extensions may announce the same wallet through legacy injection and EIP-6963.
export function mergeWalletChoice<P>(list: {name:string;provider:P}[], provider:P, name:string) {
 const normalized=name.trim().replace(/\s+wallet$/i,'').trim()||'Browser wallet';
 const key=normalized.toLowerCase();
 const index=list.findIndex(wallet=>wallet.provider===provider||wallet.name.toLowerCase()===key);
 if(index<0)return [...list,{name:normalized,provider}];
 // Prefer the latest EIP-6963 announcement over a legacy injected proxy.
 if(list[index].name===normalized&&list[index].provider===provider)return list;
 return list.map((wallet,i)=>i===index?{name:normalized,provider}:wallet);
}
