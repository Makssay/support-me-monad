// Privy's event callbacks can finish even when its modal promise does not.
// Listen to both, settle once, and never automatically resend a payment.
export class WalletRequest {
 private active?: {resolve:(hash:string)=>void;reject:(error:unknown)=>void};
 private unresolved = false;
 success(hash:string) { this.active?.resolve(hash); }
 failure(error:unknown) { this.active?.reject(error); }
 run(send:()=>Promise<{hash:string}>):Promise<string> {
  if(this.active || this.unresolved) return Promise.reject(Object.assign(new Error('A wallet confirmation is already pending.'),{code:'WALLET_REQUEST_PENDING'}));
  return new Promise((resolve,reject)=>{
   const request={resolve:(hash:string)=>{if(this.active!==request)return;this.active=undefined;resolve(hash);},reject:(error:unknown)=>{if(this.active!==request)return;this.active=undefined;reject(error);}};
   this.active=request;
   this.unresolved=true;
   // Keep the request-specific closure: a late SDK promise must never settle
   // the next request after the earlier one ended through an event callback.
   Promise.resolve().then(send).then(result=>{this.unresolved=false;request.resolve(result.hash);},error=>{this.unresolved=false;request.reject(error);});
  });
 }
}
