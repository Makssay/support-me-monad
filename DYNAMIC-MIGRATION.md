# Dynamic trial (2026-10-11)

Support Me can select Dynamic without deleting the Privy integration. Production
must remain on Privy until X OAuth and a sponsored Monad Testnet contract call
are verified with a real test user.

## Configuration

- `DYNAMIC_ENVIRONMENT_ID`: public Dynamic environment UUID.
- `DYNAMIC_ALLOWED_ORIGINS`: comma-separated exact JWT audiences. Defaults to
  the two deployed app origins and `http://127.0.0.1:3001`.
- `AUTH_PROVIDER=privy`: safe default during trial. `dynamic` changes the default
  for browsers without an explicit provider preference.
- `DYNAMIC_GAS_SPONSORSHIP=1`: only enable after dashboard configuration. The
  adapter refuses sponsorship if the provider disables client sponsorship. The
  app never falls back to a user-paid transaction after a failed sponsored send.

With the environment configured, `/?auth=dynamic` selects the trial and remembers
the provider in that browser. `/?auth=privy` returns to the original wallet.
No user tokens or private keys are stored in this preference.

## Dashboard prerequisites

1. Configure CORS origins for both deployed URLs and the local test origin.
2. Create/configure an X OAuth 2.0 application. Add the exact callback URL shown
   by Dynamic, enter its Client ID/Secret in Dynamic, and save the provider.
   No OAuth secrets belong in frontend code or Git.
3. Enable embedded EVM MPC wallets with automatic creation.
4. Enable EVM Sponsor Gas for Testnet with client-and-server relay mode. Check
   any plan/billing requirements before paying; access is not yet confirmed.

## Existing users and wallet preservation

Existing Privy membership and public profiles stay in their original store.
New Dynamic IDs are provider/environment-namespaced inside the same membership
registry. X ID uniqueness applies across both providers. An X account that has
already joined through Privy is deliberately rejected as a new Dynamic account;
the UI offers access to the existing Privy wallet instead. This is a safeguard,
not a completed address-preserving migration.

Do not transfer only the balance to a new address and call that migration:
contract rights, pending rewards, creator actions and history remain on the old
address. A future import flow must preserve the key/address and obtain explicit
user action. No existing keys have been exported or imported by this change.

## Server verification

Dynamic sessions are verified with environment-scoped JWKS, pinned algorithms,
issuer, audience, environment ID, subject, expiry and full `user:basic` scope.
The server then fetches the authenticated Dynamic profile; client-submitted
identity fields cannot authorize membership or payout wallets. Only embedded
EVM credentials qualify. External wallets remain eligibility proofs only.

## Validation still needed

- Real X OAuth callback/reload/logout and backup-email linking/login.
- MPC wallet creation/recovery and rejection of email-only new membership.
- A sponsored contract call with an unfunded test wallet; inspect receipt and
  payer, including the first EIP-7702 delegation.
- Cancelled signatures, unavailable relayer, timeout and retry behavior.
- Existing Privy access after the Dynamic trial.

Browser automation tooling failed to initialize (`failed to write kernel assets`,
Windows error 3). Local Playwright regression tests do not replace live OAuth or
real sponsored transaction verification.
