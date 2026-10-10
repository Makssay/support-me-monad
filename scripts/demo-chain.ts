import fs from 'node:fs';
import { Contract, Wallet, parseEther, formatEther, Interface } from 'ethers';
import { checkedProvider, deployer, safeFailure } from './env';
import artifact from '../artifacts/SupportMe.json';
import { CHAIN_ID, EXPLORER } from '../shared/model';
try {
 const p = await checkedProvider(); if (Number((await p.getNetwork()).chainId) !== CHAIN_ID) throw new Error('Monad only');
 const deployment = JSON.parse(fs.readFileSync('deployment.json', 'utf8')); const owner = deployer(p);
 if (fs.existsSync('demo-proof.json')) { console.log('Existing Monad demo proof preserved. No extra transactions.'); p.destroy(); }
 else {
  fs.mkdirSync('.data', { recursive: true });
  const file = '.data/demo-wallet.json';
  let contributor: Wallet;
  if (fs.existsSync(file)) contributor = new Wallet(JSON.parse(fs.readFileSync(file, 'utf8')).privateKey, p);
  else { const w = Wallet.createRandom(); fs.writeFileSync(file, JSON.stringify({ privateKey: w.privateKey, address: w.address }), { mode: 0o600 }); contributor = new Wallet(w.privateKey, p); }
  const contract = new Contract(deployment.address, artifact.abi, owner); const receipts: Record<string, string> = {};
  const funding = await owner.sendTransaction({ to: contributor.address, value: parseEther('0.5') }); const fundReceipt = await funding.wait(); if (!fundReceipt || fundReceipt.status !== 1) throw new Error('Funding failed'); receipts.contributorGasFunding = fundReceipt.hash;
  const briefs = [
   { title: 'Make the internet a little more supportive.', category: 'Memes', description: 'We are launching Support Me, a place where creators can ask for useful help and reward the people who show up. Make one original meme about the small things that make a community great.', requirements: 'Share an original meme concept, the caption, and why it resonates. Keep it kind. A social link is optional; creators review every submission.', reward: '0.005', slots: 3 },
   { title: 'Be our first fresh pair of eyes.', category: 'Feedback', description: 'Try the Support Me mission flow and tell us where you got stuck. We want your honest first impression, especially the parts that feel confusing or unnecessary.', requirements: 'Give us three specific observations and one actionable improvement. Include the screen and steps you tried.', reward: '0.003', slots: 4 },
   { title: 'Give the mobile experience a proper workout.', category: 'Testing', description: 'Open Support Me on a small screen. Browse a mission, read the brief, and check the submission form. Help us make contributing feel good everywhere.', requirements: 'Include device, viewport size, steps, and expected versus actual behavior. A reproducible issue or a documented successful test counts.', reward: '0.004', slots: 3 },
   { title: 'Tell a story about someone who showed up.', category: 'Social content', description: 'Write a short post celebrating a useful contribution: helpful feedback, an overlooked bug, or a little creative support that made a launch better.', requirements: 'Submit 80–200 words. Share a public post link if you publish it. No follower minimums. Originality and usefulness come first.', reward: '0.002', slots: 5 }
  ];
  const ids: number[] = []; const iface = new Interface(artifact.abi);
  for (const brief of briefs) { const { reward, slots, ...meta } = brief; const creationFee=await contract.creationFee(0);const tx = await contract.createMissionPaid(parseEther(reward), Math.floor(Date.now()/1000) + 7 * 86400,259200,0,86400, JSON.stringify({ ...meta, creatorName: 'Support Me Studio', socialRequired: false }),0, { value: parseEther(reward) * BigInt(slots)+creationFee }); const r = await tx.wait(); if (!r || r.status !== 1) throw new Error('Create failed'); const e = r.logs.map((l: any) => { try { return iface.parseLog(l); } catch { return null; } }).find((l: any) => l?.name === 'MissionCreated'); const id = Number(e.args.missionId); ids.push(id); receipts[`mission${id}`] = r.hash; console.log(`Demo mission ${id} funded on Monad.`); }
  const submitted = await contract.connect(contributor).getFunction('submitContribution')(ids[0], JSON.stringify({ name: 'First Supporter', text: 'Original meme concept: a tired creator staring at a launch checklist, then a tiny crowd of hands appears: one finds a bug, one writes a caption, one offers feedback. Caption: "The real launch budget was the people who showed up."\n\nDemo contribution: a public reference post is included to exercise link review; it is not claimed as my own social account.', socialUrl: 'https://x.com/monad' })); const sr = await submitted.wait(); if (!sr || sr.status !== 1) throw new Error('Submit failed'); const se = sr.logs.map((l: any) => { try { return iface.parseLog(l); } catch { return null; } }).find((l: any) => l?.name === 'ContributionSubmitted'); const cid = Number(se.args.contributionId); receipts.submission = sr.hash;
  // Query exact blocks rather than a provider's short-lived balance cache.
  const before = BigInt(await p.send('eth_getBalance', [contributor.address, 'latest']));
  const approval = await contract.approveContribution(cid); const ar = await approval.wait(); if (!ar || ar.status !== 1) throw new Error('Approval failed'); receipts.payout = ar.hash;
  const after = BigInt(await p.send('eth_getBalance', [contributor.address, `0x${ar.blockNumber.toString(16)}`]));
  const reputation = await contract.reputation(contributor.address); const c = await contract.contributions(cid);
  const payoutEvent = ar.logs.map((l: any) => { try { return iface.parseLog(l); } catch { return null; } }).find((l: any) => l?.name === 'ContributionAccepted');
  if (after - before !== parseEther('0.005') || Number(c.status) !== 1 || reputation.accepted !== 1n || !payoutEvent.args.transferred) throw new Error('Payout verification failed');
  let doubleBlocked = false; try { await contract.approveContribution.staticCall(cid); } catch { doubleBlocked = true; } if (!doubleBlocked) throw new Error('Double payout allowed');
  const runtime = await p.getCode(deployment.address); if (runtime !== artifact.deployedBytecode) throw new Error('Runtime mismatch');
  const proof = { chainId: CHAIN_ID, contractAddress: deployment.address, creator: owner.address, contributor: contributor.address, missionIds: ids, contributionId: cid, rewardMON: '0.005', balanceDeltaMON: formatEther(after - before), reputation: { submitted: Number(reputation.submitted), accepted: Number(reputation.accepted), earnedMON: formatEther(reputation.earned), signalScore: 15 }, doublePayoutBlocked: doubleBlocked, runtimeVerified: true, socialVerification: 'Manual demo review; Social Data key not configured.', transactions: receipts, explorer: EXPLORER, checkedAt: new Date().toISOString() };
  fs.writeFileSync('demo-proof.json', JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof, null, 2)); p.destroy();
 }
} catch { safeFailure('Onchain demo'); }
