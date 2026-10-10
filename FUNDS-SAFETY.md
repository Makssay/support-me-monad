# Funds safety — V8 (oracle outage policy correction)

Monad Testnet escrow: `0x3573d0a55bA41c4405eE01b2A0172820CbfA7476`.
AI controller: `0x68Ce7a8f0575D22c869d379eec88B293eBb37F9D`.

## Fixed recovery rules

- Raffles and protected creator-choice contests accept a Pyth seed only before `reviewDeadline + 7 days`. A timely seed stays authoritative even if settlement happens later.
- Once this absolute deadline passes without a seed, anyone can call `recoverUnavailableDraw(id)`. This also works when the request never succeeded, its fee increased, or the executor was offline. No replacement randomness and no organizer-controlled reroll.
- A creator missing the review deadline still triggers the normal Pyth fallback raffle. An oracle/infrastructure outage is different: if no seed arrives before the fixed recovery deadline, the entire unspent prize pool returns to the original organizer. Earlier accepted awards remain unchanged. Pending entries receive no reward or reputation for an uncompleted draw.
- The refund is permissionless and does not depend on X API, Discord or final eligibility checks. Failed MON/ERC20 transfers create a recoverable credit for the organizer. Late seeds cannot revive a refunded draw; a timely received seed prevents opting for a refund instead. Creation fees and already spent oracle/execution costs are not part of the unspent prize refund.
- Community raffles still require the published final eligibility check. If it cannot finish within its fixed recovery window, the existing community refund path applies. Unverified eligibility is never silently accepted.
- AI contests that miss their review deadline can be refunded by anyone, including the executor, to the original organizer. Paused ERC20 refunds remain claimable; a blocked transfer no longer prevents closing the AI contest.

## Bounded settlement

`settleDraw` scans at most 32 entries, pays at most 8 winners, and cleans at most 32 losing entries per call. Its shuffle state and seed persist across calls. `settleOverdueWork` handles at most 8 contributions and 8 reservation holders per call. Oracle recovery marks at most 32 pending entries per call, then refunds the organizer. Repeat the same function until the mission closes. Callers cannot change winners or recipients. The existing 256-entry limit remains.

Settlement executes through a module fixed in the escrow constructor. There is no module upgrade function, admin withdrawal, or generic delegatecall endpoint. Both contracts use the same storage base. Their deployed runtime is checked independently. The module entry points retain the shared reentrancy lock.

## Deployment and operations

The old V7 contract cannot be patched. Before V8 deployment, RPC inspection found no open V7 missions and a zero MON balance. Its address and deployment history are preserved. Old unrelated deployments are not upgraded by this release.

The executor is convenience infrastructure, not an exclusive authority. Mission pages expose settlement, recovery and AI timeout refund actions. A caller still needs transaction gas; execution reserves are finite and cannot guarantee a perpetually funded service. Loss of the user's signing keys and a permanently frozen/malicious reward token cannot be repaired by escrow code. Direct unsupported transfers to a contract are not mission funding. This release is not an independent security audit or a zero-risk guarantee.

## Verification

- `npm run contract:test`: payout conservation, double-withdrawal protection, unavailable and late randomness, immutable timely seed, 256 entrants, batch settlement, paused-token credits and AI timeout refunds.
- `npm test`: application and authorization regression tests.
- `npm run test:e2e`: main browser flows, including ERC20, eligibility and RU/mobile.
- `npm run test:automation`: automatic settlement, community failures, missing callback and automatic creator refund without participant rewards.
- `npm run build`, `npm run secrets:check`.
- `scripts/safety-live.ts`: journaled testnet creation, sponsored participation, direct payout/refund and real Pyth settlement. `safety-live-proof.json` retains successful transactions and failed test attempts separately; a raw unbuffered estimate initially exhausted gas and was retried with an explicit gas margin. App and executor paths already reserve a gas margin.

Live tests do not manufacture or suppress real Pyth randomness. The missing-callback timeout is tested on an isolated Anvil network with advanced timestamps.

### Previous V7 release checks (2026-10-10; historical evidence)

- 138 Solidity tests passed, including 256-run fuzz tests; 69 application tests passed.
- 14 main browser tests and 5 separate automation tests passed. The normal suite intentionally skips the five automation-only tests; those ran separately with the executor enabled.
- Production build and secret scan passed (546 source/build files checked). Six production pages checked at 1440, 390 and 320px; the final recovery panel and its Russian translation rechecked at 320px.
- Escrow and AI controller: Sourcify exact creation/runtime matches. Settlement engine: independently compared exact deployed runtime, 11,263 bytes.
- Real Monad Testnet: native payout/refund, real Pyth callback/payout, and synthetic ERC20 exact payout/refund/allowance accounting passed. The ERC20 fixture is not a nad.fun-listed asset and does not claim to validate every third-party token.
- Public evidence: `safety-runtime-proof.json`, `safety-live-proof.json`, `token-monad-proof.json`, `safety-production-proof.json`, `safety-ai-source-proof.json`.

### V8 policy correction (2026-10-10)

138 Solidity tests, 69 application tests, and all 5 automation browser scenarios passed; production build passed. Oracle timeout scenarios run on isolated Anvil with advanced time. V8 deployed on Monad Testnet and its escrow runtime exactly matches compiled code. Prior V7 live-payment proofs above are historical, not V8 transaction proofs.

V8 escrow and AI controller source verification both returned exact creation and runtime matches. Secret scan passed (558 files). The broader browser run found an existing native wizard/navigation timeout; wizard feedback was moved to a short reduced-motion-aware Motion animation and both core payout and Russian/mobile browser scenarios passed on the final rerun. The other 12 main browser scenarios passed in the preceding run.
