import 'dotenv/config';
import fs from 'node:fs';
import {verifySocial,lookupUsage} from '../server/social';
const before=lookupUsage();const result=await verifySocial('https://x.com/jakemor/status/1549281861687451648');const after=lookupUsage();const report={status:result.status,authorPresent:!!result.author,stableAuthorIdPresent:!!result.authorId,datePresent:!!result.postedAt,paidLookupAttempts:after.total-before.total,estimatedCostUSD:(after.total-before.total)*0.0002};fs.writeFileSync('social-live-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
