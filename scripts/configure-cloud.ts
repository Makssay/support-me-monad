import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setDefaultResultOrder } from 'node:dns';
import { parse } from 'dotenv';
setDefaultResultOrder('ipv4first');
// Explicit allowlist: never upload SEED, mainnet keys, QA wallets or the .env file.
const source=fs.existsSync('.env')?parse(fs.readFileSync('.env')):{};
const file='.data/cloud-config.json';
const saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const config:Record<string,string>={...saved,STORAGE_MODE:'d1',MONAD_CHAIN_ID:'10143',LOCAL_E2E:'0',APP_ORIGIN:'https://support-me-monad.support-me.workers.dev',D1_GATEWAY_URL:'https://support-me-monad-storage.support-me.workers.dev'};
for(const name of ['MONAD_PRIVATE_KEY','MONAD_RPC_URL','OPENROUTER_API_KEY','SOCIAL_DATA_API_KEY','PRIVY_APP_ID','PRIVY_APP_SECRET','PRIVY_GAS_SPONSORSHIP','AUTH_PROVIDER','DYNAMIC_ENVIRONMENT_ID','DYNAMIC_ALLOWED_ORIGINS','DYNAMIC_GAS_SPONSORSHIP','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','AI_BUDGET_USD','SOCIAL_LOOKUP_DAILY_LIMIT','SOCIAL_LOOKUP_TOTAL_LIMIT'])if(source[name])config[name]=source[name];
if(!config.SOCIAL_DATA_API_KEY&&source.SOCIALDATA_API_KEY)config.SOCIAL_DATA_API_KEY=source.SOCIALDATA_API_KEY;
config.D1_GATEWAY_SECRET ||= randomBytes(32).toString('hex');config.SCHEDULER_SECRET ||= randomBytes(32).toString('hex');
config.SOCIAL_VERIFIER_PRIVATE_KEY ||= JSON.parse(fs.readFileSync('.data/social-verifier.json','utf8')).privateKey;
config.COMMUNITY_ENCRYPTION_KEY ||= fs.readFileSync('.data/community-encryption-key').toString('hex');
for(const name of ['MONAD_PRIVATE_KEY','PRIVY_APP_ID','PRIVY_APP_SECRET'])if(!config[name])throw new Error('Missing required server variable: '+name);
fs.mkdirSync('.data',{recursive:true});fs.writeFileSync(file,JSON.stringify(config),{mode:0o600});
async function command(args:string[],input:string){
 await new Promise<void>((resolve,reject)=>{
  const child=spawn(process.execPath,args,{env:{...process.env,NODE_OPTIONS:'--dns-result-order=ipv4first'},stdio:['pipe','pipe','pipe'],windowsHide:true});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.stdin.end(input);child.on('error',()=>reject(new Error('Cloud configuration command failed.')));child.on('close',code=>{if(code===0)resolve();else{for(const value of Object.values(config))if(value.length>6)output=output.split(value).join('[redacted]');reject(new Error(output.slice(-2000)));}});
 });
}
if(process.argv.includes('--worker')){await command(['node_modules/wrangler/bin/wrangler.js','secret','bulk'],JSON.stringify({D1_GATEWAY_SECRET:config.D1_GATEWAY_SECRET,SCHEDULER_SECRET:config.SCHEDULER_SECRET}));console.log('Cloudflare: two private service secrets configured.');}
if(process.argv.includes('--vercel')||process.argv.includes('--vercel-origin')){
 const {execFileSync}=await import('node:child_process');const cli=execFileSync('where.exe',['vercel.cmd'],{encoding:'utf8'}).trim().split(/\r?\n/)[0].replace(/vercel\.cmd$/i,'node_modules/vercel/dist/index.js');
 const publicNames=new Set(['STORAGE_MODE','MONAD_CHAIN_ID','LOCAL_E2E','APP_ORIGIN','D1_GATEWAY_URL','PRIVY_APP_ID','PRIVY_GAS_SPONSORSHIP','AUTH_PROVIDER','DYNAMIC_ENVIRONMENT_ID','DYNAMIC_ALLOWED_ORIGINS','DYNAMIC_GAS_SPONSORSHIP','DISCORD_CLIENT_ID','AI_BUDGET_USD','SOCIAL_LOOKUP_DAILY_LIMIT','SOCIAL_LOOKUP_TOTAL_LIMIT']);
 for(const [name,value] of Object.entries(config)){
  if(process.argv.includes('--vercel-origin')&&name!=='APP_ORIGIN')continue;
  await command([cli,'env','add',name,'production','--force',...(publicNames.has(name)?[]:['--sensitive'])],value);console.log('Vercel: configured '+name);
 }
}
