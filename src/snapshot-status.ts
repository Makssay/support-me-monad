import type { Snapshot } from '../shared/model';

// The server's `stale` flag expires its 15-second cache, not the data itself.
// Allow a minute scheduler cycle plus collection time before warning users.
export const SNAPSHOT_DELAY_MS = 90_000;
export function snapshotLoadError(snapshot: Pick<Snapshot, 'updatedAt'> | undefined, failed = false, now = Date.now()): string {
 if (!snapshot) return 'We could not load Monad right now. Retry in a moment.';
 const updated = Date.parse(snapshot.updatedAt);
 return failed || !Number.isFinite(updated) || updated > now || now - updated >= SNAPSHOT_DELAY_MS
  ? 'Data is updating. Showing the last saved state; please check again shortly.' : '';
}
