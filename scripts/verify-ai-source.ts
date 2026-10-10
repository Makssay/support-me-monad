import fs from 'node:fs';
try{
 const d=JSON.parse(fs.readFileSync('ai-deployment.json','utf8'));const artifact=JSON.parse(fs.readFileSync('artifacts/AIContestController.json','utf8'));
 const response=await fetch(`https://sourcify.dev/server/v2/verify/${d.chainId}/${d.address}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stdJsonInput:JSON.parse(fs.readFileSync('artifacts/ai-standard-input.json','utf8')),compilerVersion:JSON.parse(artifact.metadata).compiler.version,contractIdentifier:'AIContestController.sol:AIContestController',creationTransactionHash:d.transactionHash}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok||!result.verificationId)throw new Error();fs.writeFileSync('ai-source-verification-job.json',JSON.stringify(result,null,2));console.log('AI source verification submitted.');
}catch{console.log('AI source verification submission unavailable.');process.exitCode=1;}
