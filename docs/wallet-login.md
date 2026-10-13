# External wallet + X fallback

The stable Privy release is preserved at Git tag `checkpoint/privy-stable-2026-10-13` (commit `4a60d8b`) and in `.data/privy-stable-2026-10-13.bundle`. The tag is pushed to GitHub. Work on the fallback is isolated on `codex/wallet-x-fallback`.

Preview (temporary deployment-scoped access, valid for 24 hours from deployment): https://support-me-wallet-preview.support-me.workers.dev/ forwards to the immutable deployment https://support-me-monad-hxc0lk63z-makssays-projects.vercel.app/. Production now uses Privy by default with the wallet/X fallback enabled (immutable deployment `support-me-monad-mo8omj9k9-makssays-projects.vercel.app`). The user approved promoting the redesigned fallback after reviewing the preview. The preview uses existing D1 persistence and paid social lookup limits; it disables background automation and does not receive the automation private key. A real X link on the preview persists the binding, so use the intended external wallet rather than a disposable address for a real user's account.

## Activation

The fallback remains disabled unless explicitly configured. Production now enables it; its login tab and server endpoints require `WALLET_AUTH_ENABLED=1`, `SOCIAL_DATA_API_KEY`, and:

```
WALLET_AUTH_X_POST=https://x.com/Makssay_eth/status/2109778998876119439
```

Set `APP_ORIGIN` to the exact HTTPS origin users open (the preview uses `https://support-me-wallet-preview.support-me.workers.dev`). Login messages use EIP-4361 SIWE; a production hostname in a preview signature can trigger wallet domain warnings. Do not disable wallet security checks. Production sets APP_ORIGIN to https://support-me-monad.vercel.app and APP_ORIGIN_ALIASES to https://support-me-monad.support-me.workers.dev. The browser Origin must exactly match one of these approved origins; the signature uses that origin. Unlisted origins are rejected. Use durable `STORAGE_MODE=d1` in hosted deployments. Do not activate an ephemeral filesystem deployment: losing bindings would require users to link again. Keep production on the stable release until the preview passes a real wallet signature and public X reply.

## User flow

1. Choose **Privy not working?**, connect Rabby/MetaMask, sign a domain-bound nonce. The nonce expires after five minutes and cannot be reused.
2. First login only: reply directly to the verification post with the generated code, then paste the reply URL. The code expires after 30 minutes. SocialData checks the parent post, exact code, creation time, and stable X user ID. Failed checks do not grant access.
3. Future logins use a fresh wallet signature. A wallet cannot change its linked X identity; one X identity cannot bind two external wallets.
4. The connected wallet receives rewards and signs NFT/token ownership checks. It pays transaction gas in MON. Privy funds stay in the original wallet.

Opaque sessions last 24 hours, are stored in browser sessionStorage, and are hashed in durable storage. Account changes/disconnection clear the client session. Logout and a new login revoke previous sessions for the wallet. Linking requires a paid SocialData lookup within the existing application budget; successful evidence is cached.

Existing Privy identity and the external identity may share the same stable X ID. Existing raffle identity rules continue to prevent duplicate participation by X ID. This is a second login method, not an asset migration.

## Verification

`npm test` covers nonce replay, incorrect signer/domain, expiry, wrong/nested reply, code matching, immutable bindings, token hashing, logout and persistence.

`npm run test:e2e -- e2e/external-auth.spec.ts e2e/wallet-stability.spec.ts` covers the fallback UI on desktop/mobile, rejection then retry, refresh recovery, account changes and normal Privy wallet stability. It executes a real ERC-20 transfer on isolated Anvil and checks token delivery and gas charged to the external sender. X evidence is mocked in this suite; it does not establish real SocialData end-to-end success.

Real hosted check on 2026-10-13: Rabby wallet `0x2937416b9e66E0Af149f9864d70B5500f1844489` signed the nonce; @RialoFun published https://x.com/RialoFun/status/2109789897485590591 under the configured post. Real SocialData verification accepted the reply and issued the wallet session. Refresh restored the same account without another reply. Remote smoke checks rejected a reused signature and a forged session. Live network switching remains pending: Rabby was on another network and the switch request returned an error, so no hosted transaction or Monad balance is claimed by this login check. Local Anvil transfer verification is described above. Production remains on the stable Privy release.

## Rollback

Disable `WALLET_AUTH_ENABLED` to hide the fallback and reject its sessions. For an exact prior release, deploy `checkpoint/privy-stable-2026-10-13`. Do not reset a working tree with local changes; check out the tag in a separate worktree or deployment instead. The stable Vercel deployment is `support-me-monad-bqjjq2p7z-makssays-projects.vercel.app`.

Follow-up: repeated real Rabby login succeeded without another X reply. Updated the custom login text to SIWE and corrected preview APP_ORIGIN; 125 unit tests, TypeScript and hosted signature/replay/session smoke checks passed. The Rabby alert itself still needs user confirmation after the new message. The earlier refresh succeeded, but a later refresh after wallet network interaction did not restore the session; this intermittent case remains unverified.

Production rollout validation: 12 focused authentication/origin/discovery tests and TypeScript checks passed. The redesigned desktop/mobile flow passed two local browser scenarios before promotion. Hosted smoke checks exercise fresh wallet signatures into pending X proof without paid social lookups or transfers; real X binding was previously verified on preview.

Hosted rollout results: the Cloudflare production entrance returned HTTP 200 for configuration, new art, wallet challenge and signature login into pending X proof. Both approved origins were checked through that entrance and produced exact domain/URI/chain-bound messages. An unlisted origin returned HTTP 400. Direct access to the Vercel domain timed out from the test client, so its transport availability is not marked passed. No public X post, paid lookup, network switch or asset transfer was performed in this rollout smoke check.
