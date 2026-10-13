// Only explicitly configured site origins may appear in SIWE messages.
export function walletDeploymentAlias(environment?:string,url?:string){
 return environment==='preview'&&/^[a-z0-9-]+\.vercel\.app$/.test(url||'')?`https://${url}`:'';
}
export function walletOrigin(canonical:string, aliases:string, requested?:string){
 const allowed=[canonical,...aliases.split(',')].filter(Boolean).map(value=>{
  const url=new URL(value.trim());
  if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:'))throw new Error('Wallet sign-in is not configured yet. Use Privy for now.');
  return url.origin;
 });
 if(!requested)return allowed[0];
 if(!allowed.includes(requested))throw new Error('Wallet verification failed. Connect again.');
 return requested;
}
