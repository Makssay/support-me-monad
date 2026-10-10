# Free-tier testnet deployment

Public app: https://support-me-monad.support-me.workers.dev

Frontend build and Node API origin: https://support-me-monad.vercel.app

Private source: https://github.com/Makssay/support-me-monad

Cloudflare Worker: `support-me-monad-storage`, D1: `support-me-monad`.

## Architecture

Vercel serves the existing Vite SPA and one Express function at `/api/*`. A separate public Cloudflare Worker forwards requests to that fixed Vercel origin, because direct access to its domain timed out on the deployment computer/user network. It holds no secrets, preserves authentication/cookies, blocks private scheduler paths, and does not follow OAuth redirects on the server. The frontend contains no provider keys. Cloudflare runs a separate authenticated D1 gateway and calls Vercel's `/api/internal/tick` every minute. Signing, Privy, RPC indexing, AI and X provider calls run in Node rather than within Workers Free's 10ms CPU budget.

D1 holds separate records for membership, X identity bindings, eligibility policies/proofs, encrypted Discord tokens, AI evidence/results, provider spending reservations, event history and the executor journal. Local files remain available for offline development and isolated Anvil QA. Production fails closed without D1; it never silently falls back to ephemeral local files.

One global fenced lease serializes persistent operations across all Vercel instances. Writes use one atomic D1 batch, reject stale owners and only change modified records. Paid requests are preceded by a durable budget checkpoint. Responses/signatures are withheld if the commit fails. This is intentionally a low-traffic MVP design, not a high-concurrency backend. Contending operations receive a retryable 503.

The executor journals a fully signed transaction and hash **before** broadcasting. Restart/retry uses the same bytes. It scans at most 30 missions / 180 seconds per cloud tick with a persistent cursor. One action is sent per tick; confirmation normally occurs on a later tick. A queued action is not a guarantee of immediate execution: the executor still needs MON for gas, the RPC/oracle must work and quotas must remain available. Existing permissionless contract settlement/recovery remains usable if hosting stops.

## Limits and costs

- Workers Free: 100,000 requests/day, 10ms CPU/invocation.
- D1 Free: 5 million rows read/day, 100,000 rows written/day, 5GB total storage. One free database has a lower per-database storage limit; the MVP uses only KB initially.
- Cron: one invocation/minute, approximately 43,200/month. Requests to the D1 gateway and public app entrance also count toward Workers usage. Static assets remain served from Vercel through the entrance; this is not an independent frontend mirror.
- Vercel Hobby is restricted to personal/non-commercial use. This deployment uses Monad **testnet**. Revisit hosting/plan before commercial mainnet platform fees.
- X API/AI charges and blockchain gas are separate from hosting. Existing spending caps are preserved; no paid provider calls are required for deployment QA.
- Application-level snapshot capacity is deliberately capped at 3MB of serialized private records. Exceeding it fails closed and requires pagination/scaling, even when D1 has remaining storage. Avoid treating 5GB as the app's practical capacity.

Official references: https://developers.cloudflare.com/workers/platform/limits/ , https://developers.cloudflare.com/d1/platform/pricing/ , https://vercel.com/docs/plans/hobby . Checked 2026-10-10.

## Setup and updates

Production environment variables are server-side, encrypted/sensitive where applicable. Keep `.env`, `.data`, `.vercel`, `.wrangler` and all credentials out of Git. `SEED`, mainnet keys and QA wallet files must never be uploaded.

1. Create D1 and apply `cloudflare/schema.sql`. Set the database/account IDs in `wrangler.jsonc` for your account.
2. Link a **separate** Vercel project using `vercel link`.
3. Set the public app/gateway origins in `scripts/configure-cloud.ts` and `wrangler.jsonc`.
4. Run `npx tsx scripts/configure-cloud.ts --worker --vercel`. It uploads an explicit allowlist, keeps private configuration only in ignored `.data/cloud-config.json`, and never outputs values. Never use a funded deployment wallet as the eligibility signer.
5. Stop/disable the old local executor before enabling cloud cron against the same wallet. Run `npx tsx scripts/seed-cloud.ts` **once**, before users access the cloud site. It refuses to overwrite an already populated database.
6. Run `npm run build`, `npm test`, `npm run test:e2e`, `npm run test:automation`, `npm run secrets:check`.
7. Push frontend/API changes to `codex/cloudflare-d1` in the connected GitHub repository; this is the Vercel production branch. Storage/scheduler Worker changes require `npx wrangler deploy`; public entrance changes require `npx wrangler deploy --config wrangler.public.jsonc`. Schema changes require a reviewed additive migration, never resetting a populated database.
8. Add the exact HTTPS app origin to Privy's allowed origins. Discord, when configured, needs `<APP_ORIGIN>/api/community/discord/callback` in its developer portal.

`npx tsx scripts/check-cloud.ts` checks public API, storage/scheduler authorization and durable operation, without paid X/AI calls or new transactions. `scheduler_health` in D1 records the latest scheduled HTTP result. `ok` means the tick request completed, not that a payment was made; inspect the executor journal/receipts for payment status.

Local development: `npm run dev`, with `STORAGE_MODE=local`. When cloud cron uses the same executor wallet, keep `AUTOMATION_DISABLED=1` locally.

## Deployment validation

The source passed 76 backend/unit tests, 138 contract tests, 14 main browser scenarios and 5 dedicated automation scenarios before deployment. The public entrance has two additional tests for forwarding, redirects, authentication and private path isolation. The production build and configured-secret scan passed. Live D1 migration copied 62 records across 10 allowlisted stores; the deployed scheduler recorded `ok`. Live public API checks verify the current Monad testnet contract, authentication rejection and private storage rejection without paid provider requests. New-domain X sign-in and a funded mission still require a user session/manual demo; these are not implied by a successful health check.
