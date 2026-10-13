# Support Me

Creator contribution network deployed on Monad Mainnet (chain ID 143). Built with React 19, React Router 7, TypeScript, Vite, Motion, Privy, Express and Solidity escrow.

Live app: https://support-me-monad.support-me.workers.dev/

Current release: Privy and external-wallet/X-code login, creator-only submission review tabs with search and pagination, MON withdrawals and ERC-20 reward transfers. Active templates are replies, memes, content, NFT holders, token holders and wallet lists; feedback, bug hunting and the custom builder are marked coming soon. Mainnet gas sponsorship is currently disabled; users need MON for network fees.

Mainnet deployment, verification and isolation from historical testnet data: [launch report](docs/mainnet-launch-2026-10-13.md). Older testnet examples below are development/test references, not the current production network.

Cloud deployment uses Vercel + Cloudflare D1 + a one-minute Cloudflare scheduler. See [CLOUD-DEPLOYMENT.md](CLOUD-DEPLOYMENT.md) for storage guarantees, quotas, secrets and update instructions.

## Participation experience

Mission pages explain who chooses rewards, payment conditions, deadlines and outage refunds before participation. A personal next step follows the connected account's submission and delivery status. Closed missions expose rewarded entries, payout receipts and indexed prize refunds; an unfinished draw is shown as cancelled, not as a participant loss.

The creation review separates prizes, platform fees, randomness and execution reserves, with an exact MON/token total and a separate gas explanation. Unknown oracle quotes are never presented as a zero fee.

Contribution drafts save locally for 30 days, scoped by chain, contract, account, mission and proposal/delivery stage. Confirmed submission clears the draft; failed transactions preserve it. Verification tickets, signatures and consent are never restored. Restricted missions require community admission before revealing work/reply fields. Provider failures are distinguished from confirmed ineligibility.

`npm test` includes status, eligibility-error and draft validation. Browser tests cover reload recovery, payout, refund and mobile/Russian layouts. `npx tsx scripts/experience-visual.ts` checks production UI with explicitly labelled visual fixtures at 1440/390/320px in EN/RU; it sends no transactions and uses no paid verification APIs. Protocol browser tests use isolated Anvil instead.

## Run

Node 22+, npm; Foundry/Anvil for tests. Copy `.env.example` to private `.env`.

```sh
npm install
npm run dev
```

Web: http://127.0.0.1:5173. API: http://127.0.0.1:3001.

```sh
npm run build
npm start
```

Production: http://127.0.0.1:3001. Public hosting needs Node, HTTPS and persistent private `.data/` storage; static hosting cannot run verification. Use existing `deployment.json`; no redeployment needed.

## nad.fun tokens

V4 supports MON or verified nad.fun ERC20 reward currencies. See [NAD-REWARDS.md](NAD-REWARDS.md) for approvals, claims, network restrictions and demo steps. Production uses the separate mainnet deployment; reward tokens must match the mission network.

## Creation fees

V5 charges a fixed creation fee: 0.2 / 0.5 / 2 testnet MON (manual / X / AI). Mainnet launch tariffs are 100 times larger. Rewards and refundable technical reserves remain separate. See [CREATION-FEES.md](CREATION-FEES.md).

## Payment agreements

| Category | Format | Payment rule |
|---|---|---|
| Memes | Creator choice | Open contest. Only selected work is paid; entering does not guarantee payment. |
| Feedback | Paid report slots | Reserve funded place before work. Complete checklist qualifies, including negative feedback. |
| Social content | Selected contributor | Proposal first; work/publication after selection. |
| Bug hunting | Bug bounty | Scoped reproducible issue confirmed by creator. Stable issue key pays once; earliest complete report checked manually. |
| Replies | Raffle | Verified direct reply. Pyth selects equal prizes from locked onchain entries. |

The underlying work categories are Memes, Feedback, Social content, Replies and Bug hunting; Feedback and Bug hunting templates are currently marked coming soon in the creation UI. Historical Testing and Launch support missions are displayed under Feedback and Social content; immutable onchain metadata is preserved. Categories describe the work; payment format controls reservation, selection and payout. Creator choice and supported text-based AI contests remain separate payment options.

Brief, criteria, funded places, rewards and deadlines are fixed when published. No top-ups or rule edits. At most three active reservations/assignments per wallet. Expired reservations can be released; original proposals remain visible after delivery.

Reserved and pending rewards block creator refunds before the review deadline. Rejections need a public reason. Missed reviews appear in creator history. After review timeout, unspent rewards may return to the creator; unreviewed work does **not** automatically get paid. Reserved funds cannot force honest approval. No independent jury or dispute arbitration.

## Reply raffle flow

1. Creator selects category **Replies** and payment format **Raffle**, original X post, deadline, equal prize size and prize count, then funds it.
2. Entrant connects wallet and gets a unique `SM-…` ownership code.
3. Entrant publishes a direct reply containing that code and submits its URL.
4. Backend checks original post and reply through SocialData: stable author ID, parent post, code, timing and known creator identity. A short-lived voucher binds chain, contract, mission, wallet, X ID and post ID.
5. **Enter verified reply** records entry onchain. Duplicate wallet, X ID and post ID entries are blocked. Maximum 256 entries and 20 prizes.
6. After deadline anyone can **Start random draw**, paying current Pyth fee plus gas. Only Pyth's callback for the committed request supplies the seed.
7. Anyone can **Finalize & pay winners**. Unique winners receive MON; unused prizes return to creator. No manual winner selection, removal, approval or reroll. A raffle with any entrant cannot be cancelled.

Draw requires two user transactions and an asynchronous callback. No backend settlement signing. If callback stalls, the draw remains locked awaiting that valid callback; no organizer-selected fallback seed or cancellation bypass. Rejected transfers become withdrawable credit.

Admission trusts the disclosed backend signer and SocialData evidence. Persistent storage binds one wallet to one X ID and vice versa. Known creator identity is excluded, but hidden alternate accounts and multiple X accounts cannot be eliminated. Pyth prevents choosing the winner, not every Sybil attack. Creator-choice contests cannot prevent selecting an undisclosed organizer alt account.

Raffle rewards count toward MON earned/history, but never increase work Signal or acceptance rate. Work Signal: `10 × accepted contributions + 5 × distinct completed work missions`.

## Environment and budget

| Variable | Use |
|---|---|
| `MONAD_PRIVATE_KEY` | CLI testnet deployment/demo only; API never signs user transactions. |
| `MONAD_RPC_URL` | Private server RPC; defaults to public Monad Testnet. |
| `SOCIAL_DATA_API_KEY` | Private SocialData key; `SOCIALDATA_API_KEY` alias accepted. |
| `SOCIAL_LOOKUP_DAILY_LIMIT` | Default 100 outbound attempts per UTC day. |
| `SOCIAL_LOOKUP_TOTAL_LIMIT` | Default 1000 total attempts in persistent storage. |
| `OPENROUTER_API_KEY` | Server-only fixed-model AI assessments; optional CLI images. |
| `PRIVY_APP_ID` | Public login identifier served by API. |
| `PRIVY_APP_SECRET` | Private; wallet-signed verification does not need it. |
| `PRIVY_GAS_SPONSORSHIP` | `1` enables native Privy gas sponsorship for embedded wallets on Monad Testnet after dashboard setup. Default `0`. |
| `CONTRACT_ADDRESS`, `DEPLOYMENT_BLOCK` | Optional public deployment overrides. |
| `PORT` | Server port, default 3001. |

Never prefix secrets with `VITE_`. `.env` and `.data/` are ignored and never served. `.data/social-verifier.json` contains a separate private admission signer, not the funded deployment key. Back it up securely with `.data/reply-identities.json` and `.data/social-lookups.json`. Contract verifier is fixed; losing this signer prevents new admissions.

Explicit verification only: no paid polling, timelines, search or automatic retries. Cache: 24h success / 15m failure; concurrent same-post requests share a lookup. Counters persist and count attempts before sending. Default total cap is approximately $0.20 at $0.0002/retrieval; actual provider billing is authoritative. Never delete counters to reset the limit. Only one live lookup was used during implementation, approximately $0.0002.

Privy X-first login with optional backup email uses `PRIVY_APP_ID` and server-only `PRIVY_APP_SECRET`; allow local and production origins in Privy Dashboard. Native gas sponsorship is implemented for Privy embedded wallets. Configure **Fee sponsorship → Sponsor gas fees → Monad Testnet only**, enable **Allow transactions from the client**, and ensure wallets use TEE execution. Then set `PRIVY_GAS_SPONSORSHIP=1` and restart the API. The React SDK explicitly requests `sponsor: true` for mission contract calls and waits for a successful Monad transaction receipt. There is no automatic user-paid retry if sponsorship fails or confirmation times out.

Contributors need no MON for gas when sponsorship works. Creators still need MON for the mission's prize budget; Pyth draw requests still need the oracle fee. External/injected wallets continue to pay their own gas. No reputation migration between wallets. A displayed sponsored-gas message indicates the configured route, not proof that a transaction succeeded: use its receipt.

The UI sends only mission-contract actions through sponsorship, but this is **not a provider-side access restriction**. Client sponsorship must be restricted to Monad Testnet in the dashboard; before mainnet use, add enforced provider policies/server validation and spending controls. Mainnet sponsorship bills gas plus provider fees; do not assume the free authentication plan covers them. Live native sponsorship passed for a separate app-controlled Privy QA wallet: 0 MON before/after submission, followed by the exact 0.005 MON reward and updated onchain reputation (`gas-sponsorship-proof.json`). Live X/backup-email login and sponsored UI submission remain pending. This QA wallet is not a real user or traction claim.

## Live deployment

- Monad Testnet, chain **10143**.
- V2 [0x52A1660F907221afbc6c29c02249FD5c0a7f661b](https://testnet.monadscan.com/address/0x52A1660F907221afbc6c29c02249FD5c0a7f661b).
- [Sourcify source](https://repo.sourcify.dev/10143/0x52A1660F907221afbc6c29c02249FD5c0a7f661b): exact creation/runtime match.
- Pyth Entropy: `0x825c0390f379C631f3Cf11A82a37D20BddF93c07`, confirmed onchain.
- [Report payout](https://testnet.monadscan.com/tx/0x4e49cb4f4f1b24ca129be57dd8055de850991ff81bf4777ae7897f8dbb8eaf10): **0.005 MON**.
- [Pyth callback](https://testnet.monadscan.com/tx/0xe1460fee204f9d9c591e45a2ba8d5beed6fef13e178a49742c97e86149b222b8).
- [Raffle payout](https://testnet.monadscan.com/tx/0xfe78474a54b9afca72969cde0aa93e2385a980faa4f2308c917262f3ba5ba5a0): **0.005 MON**.
- Observed Pyth fee: **0.12816 testnet MON**, plus gas. UI gets a fresh quote per request.

Live oracle test uses an explicitly labelled **synthetic admission**: it proves real callback/payment, not live X ownership. Browser fixture tests cover ownership/direct-reply eligibility; separate live SocialData retrieval passed. Full live X entry demo requires an entrant to publish their code. The app does not post on their behalf.

Evidence: `v2-demo-proof.json`, `chain-verification-v2.json`, `source-verification.json`, `social-live-check.json`. Six example missions have real testnet funding.

Earlier [V1 contract](https://testnet.monadscan.com/address/0x78E73688933237fd2b43C15fc81269A17F82Af35) remains linked in footer. Its balances/history were not migrated; old owners can use the original contract through explorer. `demo-proof.json` and `chain-verification.json` are historical V1 evidence; app indexes V2.

## Exact demo: paid report

1. A creates **Feedback** with explicit checklist, 0.01 MON/reward and two places; publishes/funds 0.02 MON. Open funding receipt.
2. B clicks **Reserve & contribute** and **Reserve paid place** before work.
3. B submits a complete report and agrees to terms. Pending reserved reward blocks A's refund.
4. A opens My missions, records review or verifies optional post, checks authorship, clicks **Approve & pay**.
5. Open payout receipt and B's profile: 0.01 MON earned, one accepted contribution, 15 Signal for fresh wallet; show activity.
6. A closes/refunds unused rewards. Existing live example: `/mission/2`.

Raffle demo follows its seven steps above; create ahead of time because deadline must pass before draw. Settled `/mission/7` shows actual seed/callback/payment and synthetic-test disclosure.

## Checks

```sh
npm run build
npm test
npm run contract:test
npm run test:e2e
npm run test:production
npm run verify:onchain
npm run verify:scenarios
npm run secrets:check
```

E2E uses isolated Anvil, mock social/AI and Entropy, with no paid API calls/testnet spending. `npm run test:monad` sends capped real Monad testnet transactions from controlled private QA wallets and uses real Pyth and two low-cost AI assessments. It saves each hash before waiting and resumes recorded receipts; it never claims synthetic X tickets are genuine Social Data validation. The run caps total quoted gas spending at 1.5 testnet MON and each oracle quote at 0.2 MON; after initial QA funding it requests manual funding if an account runs short, rather than automatically transferring more from the main wallet. Do not run it to manufacture activity or customer traction. `npm run verify:scenarios` independently rechecks all saved successful receipts, six payouts, reputation, closed escrows, Pyth callback and deployed runtime/infrastructure without sending transactions. `demo:onchain` sends real testnet transactions and resumes saved receipts; do not run casually to reseed. Results: `VALIDATION.md`. Design/art notes: `DESIGN.md`.

No token, DAO, NFTs, messaging, cross-chain or jury. Optional fixed-rubric AI assessments and contests are described in [AI-REVIEW.md](AI-REVIEW.md). Local JSON persistence and incremental RPC indexing suit this MVP, not high-traffic multi-server hosting. Testnet MON has no monetary value.

## X signup and optional backup email

Support Me enrollment requires a verified X account. The primary login modal offers X only. After server admission, an embedded Support Me wallet is automatically created if missing, even when a legacy external wallet exists. The app uses only the embedded wallet. Legacy external links are retired only after the replacement wallet and another login method exist.

In Your wallet, click **Add backup email** and complete Privy's email verification. On the next visit use **Sign in with backup email** and the OTP to regain the same Privy account and its linked wallets. The app calls Privy's email flow with `disableSignup: true`; email-only identities cannot enroll through the backend either. This is an alternate login, not a password reset or MFA.

Server requirements: `PRIVY_APP_ID` and `PRIVY_APP_SECRET`, both read from the server environment; only the public app ID is exposed. Privy Dashboard Authentication must enable Twitter OAuth and Email. X can use Privy's development credentials; production should use your own OAuth app. No extra OAuth scopes or OAuth-token sharing are required.

The backend verifies access-token signatures, issuer, audience and expiry with the official SDK, then fetches authoritative linked accounts. Original X ID is persisted in ignored `.data/auth-accounts.json`, namespaced by app ID. Back up this private file for recovery and keep a single API process for the MVP. Changing X cannot reset identity; an email-only recovery works only for an already-enrolled identity with verified email. Protected social APIs require both Privy membership and a signature from a linked wallet; reply authors must match the original X ID.

Public browsing is open. The Solidity contract remains permissionless; app authentication cannot prohibit direct contract calls. One X per membership/raffle is not proof of one human, and independent alternate X accounts remain possible.

`npm run test:privy` checks X-first UI, backup email form, mobile layout and unauthorized API rejection without sending emails or creating identities. Live X signup and real email recovery still require the account owner's interaction. The former external-wallet-only smoke script is historical and is no longer part of this command.

Support Me now uses one embedded wallet per account. Manual creation, external wallet linking and wallet selection controls have been removed. The legacy local wallet preference is cleared. The wallet is created automatically after X-first enrollment; existing external links are removed only once an embedded wallet and X/backup-email login are available. This removes active links in Privy; onchain history and any provider retention/audit records are not erased.
