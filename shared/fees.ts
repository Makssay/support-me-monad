export const CREATION_FEE_MON=['20','50','200'] as const;
export function feeTier(ai:boolean,social:boolean){return ai?2:social?1:0;}
export function creationFeeMon(chainId:number,tier:number){if(!Number.isInteger(tier)||tier<0||tier>2)throw new Error('Invalid creation fee tier.');return String(Number(CREATION_FEE_MON[tier]) / ([10143,31337].includes(chainId)?100:1));}
