// Called after every asynchronous eligibility check, immediately before persistence.
// The final uniqueness check and claim must stay synchronous in this single-process MVP.
export function claimReplyIdentity(bindings:Record<string,string>,wallets:Record<string,string>,chainId:number,wallet:string,xUser:string){
 const address=wallet.toLowerCase();const walletKey=`${chainId}:${address}`;const xKey=`${chainId}:${xUser}`;
 if(wallets[xKey]&&wallets[xKey]!==address)throw new Error('This X account is already linked to a different wallet.');
 if(bindings[walletKey]&&bindings[walletKey]!==xUser)throw new Error('Use the X account already linked to this wallet.');
 bindings[walletKey]=xUser;wallets[xKey]=address;
}
