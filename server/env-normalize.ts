import 'dotenv/config';
import fs from 'node:fs';
import { parse } from 'dotenv';
// The user updates this project key in .env. An older inherited desktop value
// must not shadow it. Isolated QA deliberately retains its empty provider keys.
if(process.env.LOCAL_E2E!=='1'&&fs.existsSync('.env')){const configured=parse(fs.readFileSync('.env'));if(Object.hasOwn(configured,'OPENROUTER_API_KEY'))process.env.OPENROUTER_API_KEY=configured.OPENROUTER_API_KEY.trim();}
// Accept the provider's conventional spelling as well as the project spelling.
if(process.env.LOCAL_E2E==='1'){process.env.SOCIAL_DATA_API_KEY='';process.env.SOCIALDATA_API_KEY='';}
else if(!process.env.SOCIAL_DATA_API_KEY?.trim())process.env.SOCIAL_DATA_API_KEY=process.env.SOCIALDATA_API_KEY?.trim()||'';
