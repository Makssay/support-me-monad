type FeeRegistry = {
 tiers(escrow:string,id:number):Promise<bigint>;
 paid(escrow:string,id:number):Promise<bigint>;
 collected(escrow:string,id:number):Promise<boolean>;
};

export async function requireServiceEntitlement(version:number,fees:FeeRegistry|undefined,escrow:string,id:number,tier:number){
 if(version<5)return;
 const denied=()=>new Error('This mission did not include this verification service in its creation fee.');
 if(!fees)throw denied();
 // V9 records collection even when the creator is exempt and pays zero.
 // Older deployments have no collection flag and always charge a positive fee.
 const [selected,registered]=await Promise.all([
  fees.tiers(escrow,id),
  version>=9?fees.collected(escrow,id):fees.paid(escrow,id).then(amount=>amount>0n)
 ]);
 if(Number(selected)<tier||!registered)throw denied();
}
