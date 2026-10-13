# Production recovery, 2026-10-13

Historical testnet recovery report. The subsequent mainnet launch is documented in `mainnet-launch-2026-10-13.md`, which supersedes the current-production values below.

This note supersedes older production deployment and login-configuration statements in the readiness and wallet-login reports.

## Current release

Production is now `support-me-monad-icgscs0hi-makssays-projects.vercel.app`, deployment `dpl_FAgr7wC4wAAx9wTWMPn3DyvCxRXZ`, promoted explicitly after preflight. It follows the creator-review-tab release `1x9apy583` (`dpl_GF6dMTp8jCPCLaVXx7opasUkVAQ6`). The public entrance is https://support-me-monad.support-me.workers.dev/. It proxies https://support-me-monad.vercel.app/. The preceding configuration recovery release was `gqb4jfu7l` (`dpl_HCxn3r6AQCY5HuiSXFiVZEUnT8zc`).

The release uses the same uploaded source as the previously tested current working tree (145 passing tests). It retains the X-ID profile/history/leaderboard aggregation from `ec606bd`. This is display aggregation; it does not migrate authentication member records or combine the spending authority of separate wallets. No contract deployment, asset transfer, or schema/data migration occurred during this recovery.

## Configuration regression and repair

The previous bare CLI production deployment `m4vwlgixb` omitted the per-deployment overrides used by the earlier `lu5jkqn1o` release. Its public configuration incorrectly disabled both wallet/X fallback and Privy testnet gas sponsorship. A comparison against the earlier release confirmed the regression. Production was temporarily rolled back to `lu5jkqn1o` while the corrected release was prepared.

These values are now persisted in the Vercel project's **Production** environment, rather than existing only as ephemeral deployment overrides:

- `WALLET_AUTH_ENABLED=1`
- `PRIVY_GAS_SPONSORSHIP=1`
- `WALLET_AUTH_X_POST=https://x.com/Makssay_eth/status/2109778998876119439`
- `APP_ORIGIN=https://support-me-monad.vercel.app`
- `APP_ORIGIN_ALIASES=https://support-me-monad.support-me.workers.dev`

Vercel CLI 50.4.5 preserves stdin bytes for `env add`. A PowerShell string pipeline appends a newline, which makes strict `=== '1'` flags false. Use exact stdin bytes without a trailing newline, or edit values in the dashboard. The intermediate `6yp9p72h1` build failed configuration preflight and was never promoted to the main domain.

For subsequent releases, use `--skip-domain`, check the new immutable deployment's public config/state and origin-bound wallet challenge, then explicitly promote. Do not infer successful runtime configuration from a successful build alone.

## Hosted checks

The corrected deployment returned a fresh public snapshot with 21 missions, 12 contributions and five wallet profiles. Its public configuration reports Privy as the primary provider, wallet fallback enabled, gas sponsorship enabled, chain ID 10143 and the unchanged escrow `0x3573d0a55bA41c4405eE01b2A0172820CbfA7476`.

A random-address wallet challenge accepted the approved Workers origin and returned a SIWE message bound to that exact URI and chain 10143. No signature/login, paid X lookup or transaction was performed in this recovery test.

## Separate Vercel hostname transport issue

The user reported `ERR_TIMED_OUT` for `support-me-monad.vercel.app`. The failure was reproduced before receiving HTML or an API response. During the check, Cloudflare DNS returned `216.198.79.131` / `64.29.17.131`, while the local system resolver had `216.198.79.195` / `64.29.17.195`. TCP connections to the `.131` pair timed out from the test client; TLS/HTTP requests pinned to `.195` succeeded with the same hostname and certificate validation. The Workers entrance and its state endpoint remained accessible.

This is evidence of a client-path problem reaching part of Vercel's edge address pool, not evidence of deleted missions or a globally unavailable deployment. The direct Vercel hostname is not marked fixed. Use the existing Workers entrance for the launch while that route remains unreliable.

## Follow-up: creator review tab

Commit `8cd2ccc` adds Overview / Participant work tabs for the creator identity on non-raffle missions. The work tab has search, four status filters, pages of ten compact rows and one expanded work card at a time. Dashboard review links open the specific work and its page. RU/EN, keyboard tab navigation and mobile layout are supported. Only the actual funding wallet retains approval/payment controls. This is application UI visibility, not confidentiality of on-chain payloads or the existing public snapshot API.

Validation: four browser scenarios with a 200-submission fixture passed (pagination/search/filtering, Russian deep links, noncreator visibility, linked-creator-wallet viewing without approval rights). The existing full two-wallet Anvil scenario also passed through creation, submission, verification, payout, reputation and refund. TypeScript and the production build passed. The new immutable deployment's public state retained 21 missions and both wallet fallback and gas sponsorship; its deployed JS included the new review-tab UI before promotion.

Hosted UI validation: signed-in @CredVote opened its actual mission 14 on the Workers entrance, selected Participant work, saw the one submitted work and expanded RialoFun's contribution 8 with the existing payment/submission receipts. No live wallet action was submitted. An initial browser data load failed during this check; reloading restored the actual mission and tabs. A direct API navigation in the in-app browser reported ERR_BLOCKED_BY_CLIENT, while compressed HTTP checks returned the full fresh snapshot. The transient browser-load failure is not claimed resolved by the UI release.


## Follow-up: exhausted prizes before the submission deadline

Commit `be8f236` makes an open mission with less than one reward remaining show “All rewards have been paid” in the journey and detail badge. The journey completes its steps and hides the countdown/deadline. Creator, participant and signed-out next-step copy no longer invites new entries; accepted payout/claim guidance keeps priority. No fallback draw is offered once prizes are exhausted unless a draw has already been requested and still needs settlement. Active recovery and requested-draw phases keep their own status. Token quantities are compared at their configured decimal precision.

Validation: eight mission-experience tests and six browser scenarios passed, including RU/EN exhausted-prize pages and mobile overflow checks. TypeScript and production builds passed. The immutable release retained all 21 missions, 12 contributions, Privy, wallet fallback, gas sponsorship, chain 10143 and the existing escrow. The new deployed frontend included the status copy and review tabs before promotion. After promotion, the Workers entrance served the new `index-BFICJ-Q3.js` bundle and the expected public authentication configuration. No live payment or contract mutation was required for this display fix; the before-deadline exhausted-prize condition was tested with API fixtures.
