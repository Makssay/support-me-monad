# AI review in Support Me

Replies are a contribution category; Raffle is a payment format. The MVP random draw accepts verified X replies. The three contest formats are **Creator choice**, **AI judged contest**, and **Raffle**. Paid report places, selected work and confirmed bug bounties keep their existing payment rules. Opt-in AI Review gives those formats an advisory checklist assessment; it does not release escrow or replace creator approval.

## Published policy and evidence

Before funding, creators publish one to ten text criteria with positive integer weights totaling exactly 100% (validated before Review and again before publication), the brief, deadline, review window and number of equal prizes. Model `google/gemini-3.1-flash-lite` and policy version `support-me-rubric-v1` are fixed in the onchain metadata. AI reads submitted text and, where supplied, verified public X text. It cannot inspect images, arbitrary work links, reproduce bugs, or establish copyright/originality. Those tasks need human review.

The server removes creator/contributor names, wallets, follower statistics and ownership codes from the scoring payload. Work text can still identify its author; this is not a guarantee of anonymity. Google receives the published brief and work through OpenRouter. The UI explains that processing before submission.

Each response must match a validated schema: pass/fail/uncertain, one 0–100 score per criterion and a short reason. The server calculates the weighted score. Identical evidence is cached; there is no model fallback or automatic request retry. Prompt-injection resistance is a best-effort instruction and schema check, not a security proof.

## AI judged contests

`AIContestController` creates a Creator choice mission in the existing SupportMe escrow with itself as onchain creator. The original organizer is separately recorded. Ordinary manual approval/rejection by the organizer is therefore rejected by the escrow.

After submissions close, the service assesses the complete onchain entry list. Only pass entries qualify, ranked by weighted score, then earlier onchain contribution ID for ties. The organizer's recorded wallet cannot receive a prize. Any uncertain entry pauses automatic selection; cached assessments and reasons are publicly accessible. Unsupported policies, missing evidence, budget exhaustion and provider failures do not silently pick a winner.

A fixed result is signed over chain ID, controller, mission ID, metadata policy hash, the complete ordered entry-list hash, winner-list hash, public result hash and review expiry. The controller rejects modified results, duplicates, organizer-wallet winners, early settlement and replay. Settlement pays through the existing escrow, updating the same payout events and reputation. Unused funds return to the organizer; failed transfers remain claimable credits.

The result is not regenerated if settlement expires. If selection cannot complete before the review deadline, the organizer can refund unspent funds; missed AI selections are shown separately from missed creator reviews. Contributors can record review expiry on the existing escrow. There is no independent jury or automatic compensation for unselected/uncertain work.

**Trust boundary:** Support Me holds the assessment signing key. The contract checks its signature, not the correctness of Google's assessment. An organizer cannot manually override an honest service, but hidden alternate accounts and persuasive/adversarial model inputs remain possible. This is not trustless judging, one-person proof, or audited production escrow.

## AI reply eligibility

Existing Social Data validation runs first: direct parent post, publication date, ownership code, original linked X identity, organizer exclusion and duplicate X/post checks. When AI eligibility is enabled, a pass verdict is required before the server issues the onchain entry ticket. Fail or uncertain means no admission, with a reason. Pyth Entropy alone draws equally among admitted entries; AI scores, likes and followers do not weight randomness. Same cached evidence gets the same assessment.

## Running and budget

Run `npm run build`, then `npm start` (http://127.0.0.1:3001). `.env` is server-only and ignored. `OPENROUTER_API_KEY` must be an ordinary API key, not a management key. `AI_BUDGET_USD` defaults to **0.25 USD** across this cache's lifetime. The server conservatively reserves a maximum cost before each call, including failures; this counter is not actual invoiced usage. No automatic retries or expensive fallback model. Raising the cap requires editing local configuration. The persistent cap can limit large contests; there is no uptime/finalization guarantee.

Keep `.data/ai-cache.json` and `.data/social-verifier.json` backed up privately. Fixed rankings, review caches and spending caps live in that directory; losing them loses service-side persistence. This MVP supports one server process; use a transactional database and key management before scaling to multiple instances. Local QA caches/fixtures are separate and cannot produce a Monad result.

Other environment variables: `MONAD_RPC_URL`, `MONAD_PRIVATE_KEY` (testnet deployer only), `SOCIAL_DATA_API_KEY`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, optional `PRIVY_GAS_SPONSORSHIP` configured separately in Privy. `OPENROUTER_API_KEY` and all other secret values never go to the frontend.

## Demo

1. Sign in through X, open Create mission, choose a text-based brief and **AI judged contest**.
2. Set equal prizes, deadlines and rubric; publish/fund with testnet MON. AI contests and reply raffles offer a five-minute demo submission window.
3. Use separate contributor accounts to submit text that can be evaluated from the actual evidence.
4. After the submission deadline, any signed-in member selects **Publish AI ranking**.
5. Review scores, reasons and the result commitment, then **Finalize & pay**.
6. Open the payout receipt and contributor profile: MON earned and Signal Score update in the existing ledger.
7. For the reply variant, choose category **Replies** and format **Raffle**, enable **AI reply eligibility**, get a personal code, submit a direct public reply URL, verify, enter, then request and settle the Pyth draw after the deadline.

Tests: `npm test`; `npm run contract:test` (Foundry); `npm run test:e2e` uses isolated Anvil and deterministic AI/Social Data fixtures with no paid provider calls. `npx tsx scripts/ai-live-check.ts` explicitly exercises the real model and cache. `npx tsx scripts/check-ai-chain.ts` verifies deployed runtime, immutable infrastructure and deployment receipt.

## Verified live demo

Monad testnet controller: `0xEb10839bcF0E94BBC1B97a3b941e81cb4dEE391B`, bound to existing escrow `0x52A1660F907221afbc6c29c02249FD5c0a7f661b`. Sourcify reports an exact source match. Mission **9** used separate synthetic QA accounts, real Gemini assessments (eligible report 96/100, incomplete report 0/100), and paid **0.003 MON**. Manual organizer approval was rejected. The winner has one accepted contribution and 15 Signal. This demonstrates protocol integration, not customer traction or live X authorship.

Settlement: https://testnet.monadscan.com/tx/0x4871906f86235897e2673a1752220488641f839d85db44df20cc1f5a14d409be. Public proof is saved in `ai-demo-proof.json`; private QA wallet keys remain only in ignored `.data/`.

Wallet-paid transactions check rewards plus the quoted maximum gas fee before opening the signer. Sponsored transactions check only creator-funded reward value; zero-value sponsored participation remains available to unfunded users. Slow public transaction-history indexing runs in the background on Monad and resumes from persisted block checkpoints. Contract state remains the source of payout and reputation data; explorer links can populate as indexing catches up.


## Verified X evidence (2026-10-10)
AI review of Replies and Social content requires X API evidence, including older missions whose metadata did not require a link. New AI missions in these categories lock the public X link requirement on. For any category, supplying a public X post URL makes verified, non-empty publication text mandatory for AI assessment. Required X evidence is checked before any model call or spending reservation; unavailable/empty evidence returns uncertain and pauses automatic ranking. Form text is excluded from the model payload when assessing X work, so it cannot replace the real post. Text-only reports remain eligible for AI without X API. UI labels use X API and AI; provider configuration and frozen model IDs remain unchanged. X API is a product-facing label for our third-party X data integration, not a claim of direct official API access.
