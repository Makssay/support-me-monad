# Concurrency and RPC resilience — 2026-10-13

Application preview: https://support-me-wallet-preview.support-me.workers.dev/ (temporary share access). Immutable deployment: https://support-me-monad-1b3vtnfqh-makssays-projects.vercel.app/.

Production frontend/server remains on the stable Privy release. The shared storage gateway gained backwards-compatible collection lease endpoints (version `83914021-8347-41e5-ad23-4bf4892fceb8`); its new table was applied before deployment. Production health, config and state returned HTTP 200 afterward. Stable checkpoint: `checkpoint/privy-stable-2026-10-13`.

## Changes

- GET state collection hydrates under the writer lease, releases it before network reads, and reacquires it briefly to persist only the display snapshot and event index. Each changed record is compared against its original value before commit. A concurrent change rejects the stale collector rather than overwriting it. Collection cannot save private scopes or issue budget/signing checkpoints.
- A separate fenced collector lease permits one collector at a time, preventing a burst of identical RPC scans. Other clients receive saved display state while collection is running. Its five-minute crash expiry delays display refresh, not independent payment/auth writers.
- Busy writer acquisition waits with jitter for up to roughly eight seconds before failing. Only acquisition is retried; operations, paid lookups and transaction broadcasts are not replayed.
- Read RPC transport/internal failures can switch to an independent endpoint, with a four-second timeout per HTTP request and ten-second cooldown. Endpoint chain ID is checked before use. Contract reverts are returned unchanged, and broadcasts/wallet commands stay on the primary.
- Testnet default fallback is `https://rpc-testnet.monadinfra.com`, listed in [Monad's official network documentation](https://docs.monad.xyz/developer-essentials/testnet). Both public primary and fallback returned chain ID 10143 during live checks. `MONAD_RPC_FALLBACK_URLS` overrides defaults with a comma-separated list (empty disables fallback; maximum three endpoints including primary). Mainnet has no new default fallback; configure and validate it explicitly before deployment. Local Anvil never uses public fallback.

## Evidence

- 132 unit/integration tests passed; TypeScript and deployment build passed.
- Two browser regression tests passed: external wallet restore/transfer and Privy provider stability. Transfers are isolated Anvil fixtures, not hosted payouts.
- Local D1/Miniflare: 95 reader clients made 285 reads, while five separate Node processes made 20 durable writes during a slow display collection. No increments were lost. Conflicting collectors, private saves and detached checkpoints were rejected. Last targeted run: read p95 1,084 ms, mixed work elapsed 4,272 ms. These timings describe the local environment only.
- Hosted preview burst at 2026-10-13T01:08:30.479Z: 95 GET state clients and five random wallet clients performing challenge + real signature verification; all 105 API requests succeeded. Read p95 2,727 ms, total elapsed 9,150 ms. Two read responses were marked stale during collection. Unlinked wallets received only pending X challenges, never membership sessions.
- The hosted burst performed no paid X lookups, account binding, posts, token transfers or transactions. It was one brief API burst, not 100 concurrent real browser sessions or a sustained capacity guarantee.
- Follow-up sustained run: 100 simulated clients (95 state readers in bursts every 30 seconds and five random wallet challenge/signature flows) over 14m32s. All 2,850 state reads returned HTTP 200; p50 1,749 ms, p95 3,064 ms, max 9,412 ms. **1,793/2,850 (62.9%) reads were marked stale.** Three of five challenge/login flows completed; two challenges got HTTP 503 after 8.5–8.7 seconds because the strict writer lease was occupied. Their dependent login requests were skipped. The test made no posts, paid lookups, account bindings, transfers or executor calls. This fails the write/auth part of the sustained-load check; do not treat the 100-client result as launch clearance.

## Remaining limits

This is not a replacement of all global serialization. Auth, social verification, payment reservations and the scheduled executor still use the strict global writer lease, including some external waits. A crashed strict writer can still block them until lease expiry. Within one Node process, mutable stores still require a local queue. Full hydration and large display records remain bounded by existing guards. Next work should isolate strict operations by invariant, move external work into durable jobs, and test sustained mixed sessions including scheduler overlap, paid-service failures and transaction recovery before a larger launch. Provider quotas and paid budgets are unchanged.
