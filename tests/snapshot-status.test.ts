import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotLoadError, SNAPSHOT_DELAY_MS } from '../src/snapshot-status';

const now = Date.parse('2026-10-13T00:02:00Z');
const snapshot = (age: number) => ({ updatedAt: new Date(now - age).toISOString(), stale: true });

test('normal cache expiration and background collection do not warn users', () => {
 for (const age of [0, 15000, 34000, 60000, SNAPSHOT_DELAY_MS - 1]) assert.equal(snapshotLoadError(snapshot(age), false, now), '');
});
test('genuinely delayed data warns and a recovered snapshot clears the warning', () => {
 assert.match(snapshotLoadError(snapshot(SNAPSHOT_DELAY_MS), false, now), /last saved state/);
 assert.match(snapshotLoadError(snapshot(300000), false, now), /last saved state/);
 assert.equal(snapshotLoadError(snapshot(1000), false, now), '');
});
test('failed requests still distinguish saved data from an unavailable first load', () => {
 assert.match(snapshotLoadError(snapshot(1000), true, now), /last saved state/);
 assert.match(snapshotLoadError(undefined, true, now), /could not load Monad/);
});
test('invalid and future timestamps cannot silently look current', () => {
 assert.match(snapshotLoadError({updatedAt:'invalid'}, false, now), /last saved state/);
 assert.match(snapshotLoadError(snapshot(-60000), false, now), /last saved state/);
});
