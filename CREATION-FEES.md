# Agreed creation fee policy

Confirmed by the user: fixed creation price, no author-selected participant quota, no percentage of rewards, no payout/claim fee. Mainnet tariffs are 20 MON (manual), 50 MON (X verification), 200 MON (AI, with or without X). Monad Testnet and local QA use exactly a 100-fold discount: 0.2 / 0.5 / 2 MON. Testnet tokens have no monetary value. These are launch tariffs, not guaranteed dollar margins; review prices for new missions if MON or API costs change.

The fee is charged atomically with successful funding; reverted creation collects nothing. It is non-refundable after successful publication, including cancellation and unused checks. Failed blockchain transactions may still spend gas. Rewards and MON automation/Pyth reserves are accounted for separately and never fund the platform fee. Unused rewards and technical reserves keep existing refund rules. No additional percentage or fee on contributors.

V5 SupportMe calls a separate CreationFees contract during creation. Fees stay in that vault; only the configured treasury can withdraw them. The vault holds no reward tokens and cannot access the escrow's prize or reserve balances. PLATFORM_TREASURY is optional (defaults to the testnet deployer on deployment). The address is public; a key never goes to the frontend. AI contests always pay tier 2, including token contests. Regular missions explicitly pay the selected tier. A creator who writes misleading metadata cannot obtain paid X/AI calls: the server checks the onchain paid tier before provider access.

The existing contract entry cap remains 256. Fixed-price reply checks also have a persistent ceiling of 768 distinct X post checks and 256 AI assessments per mission; repeated identical checks reuse the reservation/cache. These are platform rules, not a quota selected by the author. A reservation is retained on failure to avoid free unlimited provider retries. Existing global SocialData/OpenRouter spending limits still apply. Hosting, provider availability, attack traffic and market movements mean fixed tariffs cannot promise a net profit on every individual mission.

Review screen: selected-token reward budget, platform fee in MON, technical reserves in MON, and MON due at creation. Tier changes automatically when enabling required X links or AI. Manual missions can include work URLs but automated X verification requires tier 1 or 2; enable X verification before publication if needed.

Contracts and deployments before V5 remain immutable and are saved in deployment-history. New creation APIs are createMissionPaid, createMissionV3 (with fee tier), and createTokenMission (feeTier in its tuple). Old deployed missions do not acquire new fees retroactively. API/service support for historical deployment versions stays compatible.

Run: npm run dev, or npm run build then npm start. Checks: npm test, forge test --summary, npm run test:e2e -- e2e/core.spec.ts e2e/token-rewards.spec.ts e2e/ai.spec.ts, npm run secrets:check.

## Deployment and verification — 2026-10-09

Active V5 escrow: 0xa59066862f69ae1e3131e439F44FfFb516D451Ed.
Fee vault: 0xEe432048f8cF183d05Eec40BdD16CFfD0EB8BA4F.
AI controller: 0x1F3612F453177caB5E46A346Aef1759882f22Cf5.
All three source contracts have Sourcify exact matches; runtime and deployment receipts were checked. The running app is Monad Testnet on port 3001.

76 Solidity tests and 58 application tests passed. Browser tests passed for native rewards, token rewards and AI/advisory/reply scenarios, including rejection of unpaid AI metadata and mobile layout checks. Production build passed (existing third-party/chunk-size warnings). Secret scan passed; `.env` is ignored.

Live testnet QA created and refunded three synthetic missions. Exactly 0.2 / 0.5 / 2 MON was collected in the fee vault (2.7 MON total); prize budgets were fully refunded and the escrow was empty afterwards. Wrong funding was rejected. No new paid SocialData or OpenRouter calls were made. Proof: creation-fees-monad-proof.json. Mainnet is not deployed; historical missions remain on their original contracts.
