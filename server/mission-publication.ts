import { chainId, contractAddress, contract, provider, startBlock, local } from './chain';
import { jsonStore } from './persistence';

const store = jsonStore<{ times: Record<string, number> }>('.data/mission-publication.json', { times: {} });
const localTimes = new Map<number, number>();
// Use the funding transaction's block time, never creator-supplied metadata or
// the first participant's visit. Existing missions need no contract migration.
export async function missionPublishedAt(id: number, createdTx?: string): Promise<number> {
 const key = `${chainId}:${contractAddress.toLowerCase()}:${id}`;
 const cached = local ? localTimes.get(id) : store.data.times[key];
 if (cached) return cached;
 if (!contract) throw new Error('Mission publication could not be verified. Retry shortly.');
 const ledger = contract;
 let blockNumber: number | undefined;
 if (createdTx) {
  const receipt = await provider.getTransactionReceipt(createdTx);
  if (receipt?.status === 1 && receipt.logs.some(log => {
   if (log.address.toLowerCase() !== contractAddress.toLowerCase()) return false;
   const event = ledger.interface.parseLog(log);
   return event?.name === 'MissionCreated' && Number(event.args.missionId) === id;
  })) blockNumber = receipt.blockNumber;
 }
 // The background event index may still be catching up. Monotonically growing
 // missionCount locates the creation block in logarithmic historical reads.
 if (blockNumber === undefined) {
  let low = startBlock, high = await provider.getBlockNumber();
  if (Number(await ledger.missionCount({ blockTag: high })) < id) throw new Error('Mission publication could not be verified. Retry shortly.');
  while (low < high) {
   const mid = Math.floor((low + high) / 2);
   if (Number(await ledger.missionCount({ blockTag: mid })) >= id) high = mid;
   else low = mid + 1;
  }
  blockNumber = low;
 }
 const block = await provider.getBlock(blockNumber);
 if (!block) throw new Error('Mission publication could not be verified. Retry shortly.');
 if (local) localTimes.set(id, block.timestamp);
 else { store.data.times[key] = block.timestamp; store.save(); }
 return block.timestamp;
}
