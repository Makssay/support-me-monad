import { jsonStore, checkpoint, cloudStorage } from './persistence';
import fs from 'node:fs';
import {creationFees,contractAddress,version,chainId} from './chain';
export async function requirePaidService(id:number,tier:number){if(version<5)return;if(!creationFees||Number(await creationFees.tiers(contractAddress,id))<tier||await creationFees.paid(contractAddress,id)===0n)throw new Error('This mission did not include this verification service in its creation fee.');}

const file='.data/service-checks.json';const store=jsonStore<Record<string,string[]>>(file,{});const usage=store.data;
export function reserveServiceCheck(id:number,service:'x'|'ai',key:string){if(version<5)return;const scope=`${chainId}:${contractAddress.toLowerCase()}:${id}:${service}`;const entries=usage[scope]||[];if(entries.includes(key))return;if(entries.length>=(service==='x'?768:256))throw new Error('The fixed-price verification allowance has been reached. No paid request was sent.');entries.push(key);usage[scope]=entries;store.save();}
