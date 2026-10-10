import { jsonStore, checkpoint, cloudStorage } from './persistence';
import fs from 'node:fs';
import { randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
import type {CommunityPolicy,CommunitySummary} from '../shared/community';
import type {XCheckmark} from './x-checkmark';
const dir='.data';
function encryptionKey(){if(cloudStorage){const value=process.env.COMMUNITY_ENCRYPTION_KEY;if(!value||!/^[a-f0-9]{64}$/i.test(value))throw new Error('Community encryption is unavailable.');return Buffer.from(value,'hex');}fs.mkdirSync(dir,{recursive:true});const keyPath=dir+'/community-encryption-key';if(!fs.existsSync(keyPath))fs.writeFileSync(keyPath,randomBytes(32),{mode:0o600});return fs.readFileSync(keyPath);}
export function seal(text:string){const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',encryptionKey(),iv);const data=Buffer.concat([c.update(text,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');}
export function unseal(text:string){const b=Buffer.from(text,'base64');const c=createDecipheriv('aes-256-gcm',encryptionKey(),b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8');}
export interface DiscordIdentity {id:string;access:string;refresh:string;expires:number;}
export interface HolderSnapshot {id:string;owner:string;contract:string;chainId:number;block:number;blockHash:string;timestamp:number;top:number;holders:{address:string;quantity:number}[];selected?:string[];boundary:string[];places:number;}
export interface CommunityData {policies:Record<string,{policy:CommunityPolicy;summary:CommunitySummary}>;discord:Record<string,DiscordIdentity>;oauth:Record<string,{account:string;wallet:string;missionId:number;expires:number}>;challenges:Record<string,{account:string;wallet:string;missionId:number;expires:number;used:boolean}>;proofs:Record<string,{account:string;nftWallet?:string;discordId?:string;xCheckmark?:XCheckmark}>;snapshots:Record<string,HolderSnapshot>;}
export function communityStore(local:boolean,chainId:number){const file=`${dir}/${local?'local-':''}community-${chainId}.json`;return jsonStore<CommunityData>(file,{policies:{},discord:{},oauth:{},challenges:{},proofs:{},snapshots:{}});}
