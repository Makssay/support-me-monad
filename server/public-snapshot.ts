import type { Snapshot } from '../shared/model';

// Never use a persisted display snapshot to authorize a write. Freshness and
// deployment identity remain explicit; a different chain/contract is discarded.
export function publicSnapshot(data: any, chainId: number, contractAddress: string, now = Date.now()): Snapshot | undefined {
 const value = data?.value;
 if (!value || value.config?.chainId !== chainId || value.config?.contractAddress?.toLowerCase() !== contractAddress.toLowerCase() || !Array.isArray(value.missions) || !Array.isArray(value.contributions) || !Array.isArray(value.profiles) || !Number.isFinite(data.time) || data.time > now || !value.updatedAt) return;
 return { ...value, stale:now-data.time>=15000 };
}
