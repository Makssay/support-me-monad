# Capacity improvements — 2026-10-13

The stable Privy checkpoint remains `checkpoint/privy-stable-2026-10-13`.

## Applied to the shared storage gateway

- Added an expression index on `json_extract(key,'$[0]')`. The existing public snapshot query uses this index without changing its result or authorization.
- Live comparison on the same 147 records: indexed query read 8 rows; forced table scan read 147. This is about 18 times fewer billed row reads for this query, not an 18-times increase in whole-product capacity.
- Added an authenticated, lease-fenced paging protocol. Old deployments retain the existing response and 3 MB guard. New deployments opt in with `paginated:true`, load bounded pages and enforce a 12 MB aggregate guard in Node. Readers cannot change records while another owner holds the lease.
- Production `/api/health`, `/api/config`, `/api/state` returned HTTP 200 after deployment.

Gateway version: `c8e655ef-7954-4d38-a617-20a910ea0b0e`.

## Included in the application preview

- Visible tabs poll every 30 seconds instead of 15; hidden tabs stop polling. Returning to a tab refreshes immediately. Post-transaction refresh remains immediate, and polls do not overlap or interrupt a wallet operation.
- Server hydration uses paging, lifting its aggregate guard from 3 MB to 12 MB. This does not increase the Cloudflare plan quota, eliminate full hydration on writes, or remove the global writer lease. Individual records and commit payloads retain their existing safety limits.

Application preview: https://support-me-wallet-preview.support-me.workers.dev/ (temporary access). Immutable deployment: https://support-me-monad-n55zlb04e-makssays-projects.vercel.app/. Production frontend/server was not redeployed.

## Validation

- 128 unit/integration tests passed; TypeScript passed.
- Miniflare with actual D1 SQLite: 2,021 records, including more than 4 MB of values, paginated without duplicate/missing rows. A fresh Node process hydrated them and persisted an update.
- 100 concurrent public reads returned the correct snapshot while a writer held the lease; a competing writer and reads under an expired lease were rejected. This is a local gateway test, not a production load guarantee.
- Hosted preview: snapshot, real signature verification, nonce replay rejection and forged-session rejection passed. The first challenge attempt returned 503; a subsequent run passed. Global lease contention remains a limitation and this is not a launch load guarantee.
- Two browser regressions passed: external login/restore/ERC-20 transfer with sender-paid local gas, and Privy provider stability during confirmation.

## Limits still requiring attention before a large launch

Cloudflare account request quotas, Vercel Hobby quotas and usage terms, Privy MAUs, SocialData balance and application spending limits are unchanged. No paid subscriptions or higher paid lookup allowance were enabled. More capacity will require measured load tests, bounded/scoped hydration for writes and eventually replacing the global writer lease with narrower transactions. Read savings should be measured over a full day after rollout.
