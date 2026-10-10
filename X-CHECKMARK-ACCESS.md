# X blue-checkmark access

Creators can enable **Only X accounts with a blue checkmark** in Create Mission → Details → Who can participate? This works alone, with Discord/NFT conditions (AND), with a community raffle, or with an existing work/reply mission. A blue-only community raffle does not require a post. Reply raffles keep their existing direct-reply, author ID, date and personal-code verification.

Privy's installed `@privy-io/node` Twitter OAuth account schema contains subject, username, name, picture and verification timestamps. These timestamps mean authentication of the linked account, not an X checkmark. They cannot establish checkmark eligibility.

The server obtains the enrolled X ID from the authenticated Privy session, never from an ID, username or verified flag supplied by the browser. It requests `POST https://api.socialdata.tools/twitter/users-by-ids` with one ID. Provider documentation explicitly recommends this endpoint for Blue-checkmark status and warns against the deprecated lookup by usernames.

The parser checks the returned `id_str`, boolean verification evidence, and badge type. Live SocialData responses for @X and @NASA included `verified: true` with `verification_info.type: Business` / `Government`; both are excluded. The live blue-check example returned `verified: true` without a business/government type. Explicit `is_blue_verified` and `verified_type` are also handled if provided. This remains provider-attested data, not an independent certification by Support Me.

Positive and negative profile lookups are cached for 15 minutes; unknown/provider errors for one minute. Concurrent requests for the same ID share one request. Profiles and tweets share the existing persistent daily/total paid-call budget. The existing per-mission X allowance applies, and a creator must have funded at least the X service tier. No new fee or contract deployment is required.

The canonical policy includes `xBlue: true` and is committed through the deployed V6 CommunityGate. The signed admission binds the policy, mission, main reward wallet, X identity and expiry. Reusing the X identity through another wallet cannot obtain a second admission. Checkmark evidence and its actual lookup timestamp are stored privately with admission records. Missing status, wrong ID, 401/402/429, or timeout never authorizes a participant.

Eligibility is fixed at admission using evidence up to 15 minutes old. Later subscription changes do not revoke admission. When combined with dynamic Discord/NFT requirements, their existing final recheck still applies; it does not recheck the X subscription.

## Provider pricing checked October 10, 2026

- One returned profile: $0.0002.
- 100 fresh checks: $0.02; 1,000: $0.20; 10,000: $2.
- One profile plus one reply lookup: $0.0004, excluding AI and a shared original-post lookup.
- Cache reuse sends no provider request.
- Development probes retrieved four profiles in total: published-price estimate $0.0008. No AI calls. One initial request without the configured alias returned 401; subsequent calls used the project's normalization and succeeded.

Sources:
- https://docs.socialdata.tools/getting-started/pricing/
- https://docs.socialdata.tools/reference/get-multiple-user-profiles/
- https://docs.socialdata.tools/reference/get-multiple-user-profiles-by-usernames/

Validation: unit tests cover exact IDs, missing/malformed evidence, blue versus business/government, provider failure, policy commitments and service tiers; an isolated transport test covers concurrent deduplication, cache reuse and the shared budget. Community browser/contract integration covers creation, combined conditions, blocked entries, duplicate identity, static eligibility and payout. Fixtures are available only on the isolated local QA network, never Monad.
