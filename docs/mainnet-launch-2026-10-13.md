# Mainnet launch preparation — 2026-10-13

Status: mainnet contracts deployed and production promoted after explicit approval to spend up to 1.2 MON. Total deployment expense: 1.06069341 MON. Mainnet production is `support-me-monad-o5qhc130d-makssays-projects.vercel.app` (`dpl_5esxWwb6kJH4FXvxn6FPYtSkZQpU`); public entrance https://support-me-monad.support-me.workers.dev/. The preparation notes below record the earlier state.

- Preserved production testnet deployment: `support-me-monad-icgscs0hi-makssays-projects.vercel.app` (`dpl_FAgr7wC4wAAx9wTWMPn3DyvCxRXZ`), commit `be8f236`, and a timestamped checkpoint Git tag/bundle/working-tree patch in ignored `.data`.
- User-provided `.env` key name: `MONAD_PRIVATE_KEY_MAINNET`; only the public deployer address is recorded here: `0xf337687dD73c1A13EFE39393a000f55a95B1ac54`.
- RPC chain 143 balance at preflight: 97.957397185142752197 MON. Testnet (10143) balance on the same public address is separate.
- Mainnet Pyth Entropy: `0xD458261E832415CFd3BAE5E416FdF3230ce6F134`, from official Pyth chainlist data; code present, default provider `0x52DeaA1c84233F7bb8C8A45baeDE41091c616506`, live fee 1.4 MON at check time.
- Read-only deployment plan: maximum gas 1.06069341 MON at the quoted gas price; enforced total deployment cap defaults to 1.2 MON. No deployment transaction has been signed or sent.
- Dedicated deployment script `scripts/deploy-mainnet.ts` defaults to planning, requires `--execute` to broadcast, uses separate manifest/journal, checks chain/nonce/gas budget, records signed bytes before broadcasting and verifies runtime/config/exemption afterwards. Testnet deployment script/manifest remain untouched.
- Separate D1 database `support-me-mainnet`, ID `86b3098b-dd41-42af-95fd-0efa44f713c5`, initialized with current schema. Storage worker `support-me-mainnet-storage.support-me.workers.dev` deployed with separate generated storage/scheduler secrets. It currently cannot execute production jobs because the live backend still uses testnet's scheduler secret.
- Ten permanent identity records copied from production's fifteen identity rows into mainnet storage. Wallet challenges/link codes/session hashes were not copied. Testnet missions, communities, verification results and public snapshot were not copied. The original DB was read only.
- Production environment has NOT yet been changed. Ignored `.data/setup-mainnet-production.cjs` is ready to set exact stdin values once the verified mainnet manifest exists. Existing Vercel sensitive values pull as empty strings; never treat the downloaded env file as a complete secret backup.
- UI mainnet labels/faucet suppression and cross-deployment draft guard prepared. Runtime recognises the requested mainnet key variable. Mainnet RPC fallback checked chain 143 successfully. Vercel includes the separate mainnet manifest in function files.
- Validation: 147 unit/integration tests passed before the final UI changes; ten affected transaction/RPC/fee tests then passed. Foundry contract tests passed. Nine browser scenarios passed including mainnet RU/EN wallet labels/no faucet/mobile overflow, testnet creation-draft isolation and existing creator review UI. TypeScript and production build passed after changes.
- Mainnet gas sponsorship is intentionally disabled in the current supported configuration. Privy supports mainnet authentication/embedded wallet, but users need MON for gas. The fee exemption file includes the deployer address; deployment verifies the zero platform quote. Network and Pyth charges remain payable.

Next after explicit confirmation of spending real MON: execute the bounded deployment, verify sources, apply mainnet production env, create an immutable build with `--skip-domain`, preflight config/state/identity and mainnet RPC, then promote and verify the Workers entrance. Do not expose testnet records as mainnet history.

A testnet alias `support-me-monad-testnet.vercel.app` points to the saved deployment but returns Vercel protection (HTTP 302); it is a rollback reference, not a verified public testnet entrance. Do not claim uninterrupted side-by-side testnet automation after switching production; its scheduler origin must be addressed separately if needed.


## Completed launch

- Escrow: `0x49743a16D7B3dDe2214a5B1c3D6f5871f58Fa131`, transaction `0x92c9a2a1402c722b5a0fbb05b96a3637d87af947dfd7a977c1bad14f8db2770d`, block 113027450.
- CreationFees: `0xBF5d66a89cc86de826eBa40EeACb6B2D5D2C6fC8`, deployment `0x429334d1d0deb14e1ef1ae5346e1a765a8facbc2bec16a3bc753405adb4b0eee`.
- Fee exemption transaction: `0xb7e60b99c68c7739c21918a3b00386d6b4e363dcabefe1ef5a73715bbf92f28f`. All three platform fee tiers quote zero for `0xf337687dD73c1A13EFE39393a000f55a95B1ac54`. The exemption is address-specific; a different Privy wallet does not inherit it.
- CommunityGate: `0x7D01A3F02876eF4a0851d09E3dfFCc2fDF2571b7`; SettlementEngine: `0x4a330fD05d109fA109978484a777f33363bee206`.
- All four contracts have exact runtime AND creation source matches on Sourcify. Results: `mainnet-source-status.json`. Chain verification: `mainnet-chain-verification.json`.
- Read-only mainnet creation simulation succeeded with the owner's fee exemption and real Pyth fee. Testnet quick review/work windows reverted correctly. No additional mainnet transaction was sent for this check.
- Production variables set to chain 143, mainnet RPC/fallback, separate mainnet D1 gateway/secrets, and the explicitly named `MONAD_PRIVATE_KEY_MAINNET`. The eligibility verifier matches the deployed address. Runtime sponsorship remains false; wallet fallback and Privy remain enabled.
- Immutable hosted checks confirmed chain 143, version 9, correct escrow, five preserved wallet profiles with zero mainnet history, zero missions/contributions, live Pyth quote 1.4 MON, and the new frontend bundle `index-BfimEsAt.js`. A random local ephemeral wallet completed the mainnet-bound SIWE signature, replay was rejected, and the authorized executor returned OK with no onchain action or paid X lookup. This test created no permanent account. Evidence: `mainnet-hosted-preflight.json`.
- After promotion, the Workers entrance returned the same config and new bundle. Actual in-app browser retained @CredVote's Privy session and showed Monad Mainnet, its embedded-wallet address and zero mainnet MON. An initial data load temporarily failed, then recovered automatically to the canonical X profile and complete empty mainnet feed. This display fix does not claim to eliminate all transient client/network failures.

## Scheduler and rollback

The newly created storage Worker's cron registration was accepted by Cloudflare but produced no health record. Its cron was disabled (`wrangler.mainnet.jsonc` has no schedules). The existing `support-me-monad-storage` Worker already executes every minute, so its scheduler secret was switched to the new backend's scheduler secret. Its original D1 gateway secret and testnet data were left intact; only scheduled execution now targets the mainnet production backend. Mainnet backend application data remains in the separate `support-me-mainnet` DB. Scheduler health is therefore read from the existing Worker's DB, not the mainnet DB.

For testnet rollback, promote saved Vercel deployment `dpl_FAgr7wC4wAAx9wTWMPn3DyvCxRXZ` AND restore the preceding existing-storage Worker version/configuration with its old scheduler secret (version `c89d9665-c878-4eb4-8ff3-ce508e77f4af`). Production environment defaults are now mainnet; do not create a fresh deployment assuming it will inherit testnet defaults. Keep mainnet manifest and deployment journal intact even if rolling the UI back.

Scheduler verification after credential migration: the existing Worker wrote `status=ok` at Unix milliseconds `1791891809094` (2026-10-13T11:43:29.094Z). This is a real scheduled invocation, separate from the earlier manual executor preflight.
