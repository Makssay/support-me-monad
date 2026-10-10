import 'dotenv/config';
import fs from 'node:fs';
import {PrivyClient} from '@privy-io/node';
import {recordPublicIdentity} from '../server/public-profiles';
import {enroll} from '../server/account-policy';
try {
 const id=process.env.PRIVY_APP_ID!;
 const members=JSON.parse(fs.readFileSync('.data/auth-accounts.json','utf8'))[id]||{};
 const client=new PrivyClient({appId:id,appSecret:process.env.PRIVY_APP_SECRET!,timeout:10000,maxRetries:0});
 let count=0;
 for(const userId of Object.keys(members).slice(0,20)){
  const user=await client.users()._get(userId);
  recordPublicIdentity(user,enroll(user,members)); count++;
 }
 console.log(JSON.stringify({verifiedProfilesUpdated:count}));
}catch{console.log('Profile sync unavailable. Existing users will sync on their next sign-in.');process.exitCode=1;}

