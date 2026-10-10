# nad.fun reward currencies — V4

Creators choose MON or a nad.fun token by pasting its token URL or contract address. The server verifies that the contract exists on the active network, confirms its nad.fun listing, reads its onchain name/symbol/decimals, and issues an expiring chain/escrow/token-bound admission signature. External metadata is cached for one hour; new lookups are spaced to stay under the documented free API rate limit. No SocialData or OpenRouter calls are needed.

Token funding uses an exact, single-budget ERC20 approval (resetting any previous nonzero allowance). The escrow checks actual received balances. Prizes and refunds remain in the selected token; Pyth fees, gas and execution reserves remain in MON. Creator choice, paid slots, selected work, bug bounties, reply raffles and AI contests reuse their existing eligibility/payout rules. No token swapping, buying, pricing or selling is performed.

Taxed funding is rejected atomically. A failed, paused or taxed outgoing transfer is rolled back and recorded as a claim; profile claim buttons retry escrow rewards or AI organizer refunds. Tokens which remain frozen, blacklist recipients, rebase or behave maliciously cannot be guaranteed to pay. A nad.fun listing is not a security audit. No conversion of token earnings into MON or invented USD values is shown.

## Networks

The active app remains Monad testnet (10143). Testnet token discovery uses `https://dev-api.nadapp.net`; mainnet uses `https://api.nad.fun`. A mainnet token cannot fund a testnet mission. The isolated browser test uses a clearly synthetic six-decimal QA token; its bypass is allowed only with LOCAL_E2E and a loopback RPC, never in the public application.

Mainnet runtime configuration is prepared: MONAD_CHAIN_ID=143, a matching MONAD_RPC_URL, mainnet-deployment.json, and mainnet-ai-deployment.json referencing that escrow. Mainnet deployment is not performed by the current testnet-only deployment scripts. MAINNET_PRIVATE_KEY is separate and is used only by the mainnet executor; MONAD_PRIVATE_KEY stays testnet-only. SEED is never used by this feature. Privy gas sponsorship is currently testnet-only. Mainnet Entropy configuration/fees and sponsorship must be checked before a mainnet rollout.

## Run and checks

`npm run dev`, or `npm run build && npm start` (PowerShell: run separately).

`npm test`, `npm run contract:test`, `npm run test:e2e -- e2e/core.spec.ts e2e/token-rewards.spec.ts`, `npm run secrets:check`.

Old immutable contracts and their missions are preserved in deployment-history. V4 is a new deployment; historical balances are not migrated. Use the legacy contract explorer link for old missions.

## Manual demo

Use two accounts with testnet MON; the creator also needs an actual nad.fun testnet token. Create a mission, choose nad.fun token, paste its active-network address, check metadata/balance, set reward and places, review the separate token/MON totals, confirm exact approval and funding. With another account submit/complete work. Approve or use the relevant timeout/raffle/AI settlement. Check the token transfer receipt and the contributor profile's Token rewards section. MON earnings stay separate.

## Verified result — 2026-10-09

- Monad testnet V4 escrow: `0x6D09cbc8c1AB978133ddC5C9a1bA54AAd6A5e194`.
- AI controller: `0xf0e892789E78b3474fdF71B38ABcF6D9d9BA85eb`.
- Both deployments confirmed; deployed runtime checks passed; Sourcify exact source matches. Monadscan automatic source submission was rate limited by the external service (daily quota); Sourcify is verified.
- 66 Solidity tests (17 token-specific, including conservation fuzz), 57 application tests, MON and token browser flows passed. Mobile 390px overflow checks passed. Production build passed with existing dependency/chunk-size warnings. Configured-secret scan passed; `.env` ignored.
- Actual Monad token funding/submission/payout/refund verified with a synthetic, unlisted six-decimal token; see token-monad-proof.json. Public lookup correctly rejects that unlisted token. This is not an end-to-end proof with a real nad.fun-listed asset.
- Browser proof: token-browser-proof.json. Mainnet rollout remains pending separate deployment, mainnet executor funding/configuration and real token wallet testing.
