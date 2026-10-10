import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
const artifact = JSON.parse(fs.readFileSync('artifacts/SupportMe.json', 'utf8'));
const compilerVersion = JSON.parse(artifact.metadata).compiler.version;
const endpoint = `https://sourcify.dev/server/v2/verify/${d.chainId}/${d.address}`;
try {
 const existing = await fetch(`https://sourcify.dev/server/v2/contract/${d.chainId}/${d.address}`, { signal: AbortSignal.timeout(20000) });
 if (existing.ok) { const result = await existing.json(); if (result.runtimeMatch) { fs.writeFileSync('source-verification.json', JSON.stringify(result, null, 2)); console.log('Source already verified:', result.match); process.exit(0); } }
 const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stdJsonInput: JSON.parse(fs.readFileSync('artifacts/standard-input.json', 'utf8')), compilerVersion, contractIdentifier: 'SupportMe.sol:SupportMe', creationTransactionHash: d.transactionHash }), signal: AbortSignal.timeout(30000) });
 const result = await response.json();
 if (!response.ok || !result.verificationId) { console.log('Source verification service did not accept submission.', { status: response.status, errorCode: result.customCode }); process.exitCode = 1; }
 else { fs.writeFileSync('source-verification-job.json', JSON.stringify(result, null, 2)); console.log('Source verification submitted.', result.verificationId); }
} catch { console.log('Source verification service is unavailable. Exact deployed runtime was verified independently.'); process.exitCode = 1; }
