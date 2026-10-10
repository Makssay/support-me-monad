// Live testnet diagnostic using a separate app-controlled Privy QA wallet.
// This proves the sponsorship engine, not email-login/browser completion.
import 'dotenv/config';
import fs from 'node:fs';
import { Contract, JsonRpcProvider, Wallet, Interface, parseEther, formatEther } from 'ethers';
import abi from '../shared/abi.json';
import { CHAIN_ID, PUBLIC_RPC } from '../shared/model';

const appId = process.env.PRIVY_APP_ID;
const secret = process.env.PRIVY_APP_SECRET;
const key = process.env.MONAD_PRIVATE_KEY;
if (!appId || !secret || !key) throw new Error('Configure server-side Privy and testnet credentials first.');
const provider = new JsonRpcProvider(process.env.MONAD_RPC_URL || PUBLIC_RPC, CHAIN_ID, { staticNetwork: true });
const deployment = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
const creator = new Wallet(key, provider);
const contract = new Contract(deployment.address, abi, creator);
const iface = new Interface(abi);
fs.mkdirSync('.data', { recursive: true });
const journalPath = '.data/gas-sponsorship-qa.json';
const journal: any = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : {};
function save() { fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2)); }
async function privy(endpoint: string, body: unknown) {
  const response = await fetch(`https://api.privy.io/v1/${endpoint}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'privy-app-id': appId!, Authorization: `Basic ${Buffer.from(`${appId}:${secret}`).toString('base64')}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Privy sponsorship QA request failed (HTTP ${response.status}). No response body or credentials logged.`);
  return response.json();
}
async function confirmed(hash: string) {
  const receipt = await provider.waitForTransaction(hash, 1, 90000);
  if (!receipt || receipt.status !== 1) throw new Error('QA transaction not confirmed. Inspect saved hash; do not resubmit blindly.');
  return receipt;
}
try {
  if (Number((await provider.getNetwork()).chainId) !== CHAIN_ID || await provider.send('eth_chainId', []) !== '0x279f') throw new Error('Only Monad Testnet allowed.');
  if (!journal.wallet) {
    const wallet = await privy('wallets', { chain_type: 'ethereum', external_id: 'support-me-gas-qa-20261008' });
    journal.wallet = { id: wallet.id, address: wallet.address }; save();
  }
  const entrant = journal.wallet.address;
  if (journal.before === undefined) { journal.before = (await provider.getBalance(entrant)).toString(); save(); }
  if (journal.before !== '0') throw new Error('QA wallet must start with zero MON.');
  const reward = parseEther('0.005');
  if (!journal.createTx) {
    const tx = await contract.createMissionPaid(reward, Math.floor(Date.now() / 1000) + 86400,259200,0,86400,
      JSON.stringify({ title: 'Gas sponsorship protocol QA', category: 'feedback', description: 'Explicit test harness mission. Not real user traction.', requirements: 'Prove a zero-balance Privy QA wallet can submit and receive MON.', creatorName: 'Support Me QA', socialRequired: false }),0, { value: reward });
    journal.createTx = tx.hash; save();
  }
  const created = await confirmed(journal.createTx);
  journal.missionId = Number(created.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(e => e?.name === 'MissionCreated')!.args.missionId); save();
  if (journal.submitRequested && !journal.submitTx) {
    // A sponsored request may return before a transaction hash is available.
    // Recover the actual contract event instead of sending another request.
    const tip = await provider.getBlockNumber();
    for (let from = Math.max(created.blockNumber, tip - 1999); from <= tip; from += 100) {
      const logs = await provider.getLogs({ address: deployment.address, fromBlock: from, toBlock: Math.min(from + 99, tip),
        topics: [iface.getEvent('ContributionSubmitted')!.topicHash, null,
          `0x${BigInt(journal.missionId).toString(16).padStart(64, '0')}`, `0x${entrant.slice(2).padStart(64, '0')}`] });
      if (logs.length === 1) { journal.submitTx = logs[0].transactionHash; save(); break; }
    }
  }
  if (!journal.submitTx) {
    const data = iface.encodeFunctionData('submitContribution', [journal.missionId, JSON.stringify({ description: 'Protocol QA submission through Privy native gas sponsorship; zero starting MON.', socialUrl: '' })]);
    // Stop after an ambiguous POST; an automatic rerun must not send it twice.
    if (journal.submitRequested) throw new Error('Submission was already requested. Inspect the wallet transaction history before rerunning.');
    journal.submitRequested = true; save();
    const result = await privy(`wallets/${journal.wallet.id}/rpc`, { method: 'eth_sendTransaction', caip2: `eip155:${CHAIN_ID}`, sponsor: true,
      params: { transaction: { to: deployment.address, data, value: '0x0', chain_id: CHAIN_ID } } });
    journal.providerTransactionId = result.transaction_id || result.data?.transaction_id;
    journal.submitTx = result.data?.hash || result.data?.transaction_hash || result.hash;
    save();
    if (!journal.submitTx) throw new Error('Provider did not return a transaction hash. Inspect wallet history.');
    save();
  }
  const submitted = await confirmed(journal.submitTx);
  if (!journal.approveTx) journal.afterSubmission = (await provider.getBalance(entrant)).toString();
  if (journal.afterSubmission !== '0') throw new Error('Contributor MON balance changed before payout.');
  journal.contributionId = Number(submitted.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(e => e?.name === 'ContributionSubmitted')!.args.contributionId); save();
  if (!journal.approveTx) { const tx = await contract.approveContribution(journal.contributionId); journal.approveTx = tx.hash; save(); }
  await confirmed(journal.approveTx);
  const balance = await provider.getBalance(entrant);
  if (balance !== reward) throw new Error('QA contributor did not receive the exact funded reward.');
  const profile = await contract.reputation(entrant);
  if (profile.accepted !== 1n || profile.earned !== reward) throw new Error('Onchain reputation was not updated.');
  const proof = { passed: true, chainId: CHAIN_ID, contract: deployment.address, contributor: entrant,
    initialMON: '0', afterSponsoredSubmissionMON: '0', payoutMON: formatEther(balance),
    missionId: journal.missionId, contributionId: journal.contributionId, createTx: journal.createTx,
    sponsoredSubmissionTx: journal.submitTx, payoutTx: journal.approveTx,
    acceptedContributions: Number(profile.accepted), infrastructureOnly: true, browserEmailLoginVerified: false, creatorApprovalSponsored: false,
    checkedAt: new Date().toISOString() };
  fs.writeFileSync('gas-sponsorship-proof.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
} catch (e) { console.error(e instanceof Error ? e.message : 'Gas sponsorship QA failed.'); process.exitCode = 1; }
finally { provider.destroy(); }
