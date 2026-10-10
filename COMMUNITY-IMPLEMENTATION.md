# Community missions — implementation, 10 October 2026

The original discussion is preserved in COMMUNITY-EVENTS-PLAN.md. This document describes what is implemented, including the decisions made for the MVP.

## Available features

- Community access is separate from mission category, work verification and payment mode. Existing creator choice, paid reports, selected contributor, bugs, reply raffle and AI contests can use community access.
- Discord: server membership, a server role, or an organizer Discord-ID list. Authorization uses `identify guilds.members.read`; no bot installation is required for these checks. Official reference: https://docs.discord.com/developers/resources/user#get-current-user-guild-member
- Wallets: organizer address list, ERC-721 ownership, ERC-1155 ownership of one token ID, or a strict top-N ERC-721 holder snapshot. Discord and wallet requirements combine with AND.
- Community raffle: no work or reply is submitted. An eligible participant joins, and Pyth chooses equal-prize winners. Raffle rewards do not increase the work-quality Signal Score.
- Wallet signatures prove control of the temporary eligibility wallet. It is never linked to Privy, saved as a login wallet, or used as the reward recipient. Account-change events during this operation cannot replace the payout identity. The MVP requires an injected wallet extension; WalletConnect and ERC-1271 signatures are not included.
- TXT/CSV: one column named `address` or `discord_id`, one identity per line, maximum 500 KB and 10,000 unique entries. Discord IDs stay strings, preserving precision. Duplicates are counted; invalid rows block publication. Full lists stay in ignored server storage. A canonical hash is fixed onchain at creation.
- An organizer-uploaded list proves only organizer selection and participant control. It does not certify NFT ownership, top rank, server membership or a Discord role.
- Contract admission is mandatory before reservation, proposal, submission or community raffle entry. A verified identity cannot be admitted to a second payout wallet in the same mission.

## Raffle checks and failure handling

Work missions fix access at admission; later eligibility changes do not revoke accepted work. Static uploaded lists and top-holder snapshots also stay fixed.

For raffles with live Discord membership/role or current NFT ownership, there is a second complete-list check after entry closes, before requesting Pyth randomness. Participants must keep satisfying the requirement until this check completes. This is a current check, not historical Discord membership at the deadline. NFT balances are read at one explicit block for the whole final batch.

A known negative check excludes the entry. Missing OAuth permission, timeout or unavailable RPC pauses the entire check; it never silently excludes an unknown participant. There are no new entries during recovery. The recovery window is 24 hours, or 5 minutes in quick test mode. If the full check cannot finish in time, or no participant remains eligible, the unfinished raffle can be cancelled and remaining prize/technical reserves refunded to the creator. Creation fees remain non-refundable. Already paid work is unaffected.

The server executor attempts final checks, draws and settlement while it is online and funded. Any account can trigger the same signed final check and settlement. Gas for the extra CommunityGate final-check transaction is currently paid by its caller; it is not reimbursed from the escrow execution reserve. Escrow draw/settlement reimbursement rules remain unchanged.

## Strict top-N snapshots

The MVP reads standard ERC-721 Transfer events from deployment to a single block two blocks behind the tip. It records the block number/hash and complete indexed holder balances. Limits: 2,000 log ranges of 100 blocks, 50,000 events, 10,000 holders, top N from 1 to 1,000, three snapshot preparations per hour per IP, one scan at a time. `HOLDER_SNAPSHOT_MAX_RANGES` can lower the range limit. An archive-capable RPC and compatible event history are required. ERC-2309 batch-minted collections are rejected. OpenSea is not used as a source of historical truth.

Addresses above the cutoff qualify. If a cutoff balance is tied, a separate Pyth request selects the remaining addresses, without replacement, deterministically from its returned seed. The same snapshot hash cannot request a replacement seed. The Pyth fee is shown and paid immediately, independently of eventual mission publication. The selected list is fixed when the mission is funded. There may be fewer than N eligible addresses if the collection has fewer holders; N eligible wallets never promises N participants or N distinct people.

## Fees

Existing fixed tiers remain: 20 / 50 / 200 MON, divided by 100 on testnet. Discord, ordinary NFT ownership and imported lists use the base tier; a holder snapshot needs at least tier 1; AI needs tier 2. Combinations use the highest tier. Creation fees, reward tokens, MON for gas/automation, and Pyth fees are displayed separately. There are no paid X API or OpenRouter calls for community access itself.

## Local tests and configuration

```text
npm install
npm run build
npm start
npm test
npm run contract:test
npm run test:e2e -- e2e/community.spec.ts
npm run test:automation
```

The local browser suite launches its own Anvil, API and Vite instances. Discord fixtures work only when LOCAL_E2E=1, the RPC is loopback and COMMUNITY_FIXTURES=1. They cannot unlock access on Monad Testnet or mainnet. User requested local Discord verification for now; live OAuth has not been tested.

For real Discord OAuth later, configure server-only `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `APP_ORIGIN`. Register `APP_ORIGIN/api/community/discord/callback` in Discord Developer Portal. OAuth states are short-lived, bound to a browser HttpOnly cookie and the authenticated account; tokens are AES-GCM encrypted at rest. Back up the ignored `.data/community-encryption-key` and community store securely together. Losing private policies/proofs prevents further verification, with the onchain raffle recovery/refund path remaining available.

## Testnet deployment

- Escrow V6: `0x0248b335E26569043E88eb96f69Af96861C28C0a`
- CommunityGate: `0x1d9d21680827E9C5fE85AABB9a9fB668240C21B6`
- AI controller: `0xDc4b38CfAc0FB32cB3D0f280F3b6CD1A0a7B20D3`
- Creation fee vault: `0xe4a8a041A9C3cc44A27fE85A4498BA921827A175`

All four contracts have exact source/runtime matches on Sourcify. Monadscan source replication hit the explorer's daily submission limit; Sourcify verification succeeded. Old immutable deployments are preserved under deployment-history; their missions/funds are not migrated into V6.

`community-monad-proof.json` records synthetic live testnet QA: unauthorized submission blocked, identity-bound admission, distinct temporary/payout wallets, exact 0.01 MON payout, and closure. The new holder-tie Pyth callback has been tested locally; a separate live request was not run because its ~0.12816 MON fee exceeded the available executor balance. `npx tsx scripts/community-monad-qa.ts --pyth` can run that optional probe after funding the testnet executor. No mainnet actions, live Discord calls, paid Social Data calls or paid AI calls were used in this feature's QA.

## Demo

1. Create Mission → choose Community raffle → enable 5-minute stages.
2. Details → Who can participate? → Organizer wallet list → upload TXT/CSV with a second wallet address.
3. Publish and fund; creator pays creation fee, prizes and technical MON reserves.
4. Sign in as another participant. Verify with the listed temporary wallet; reward account stays unchanged.
5. Join the raffle. For dynamic rules, keep the membership/NFT condition until the final check completes.
6. After the deadline, the server requests randomness and settles; manual buttons remain available. Local Anvil uses the mock callback in its browser test; live testnet uses Pyth's callback.
7. Open the payout receipt and participant profile. Random rewards appear as rewards/history, not merit-based Signal Score.

The admission verifier and private server records are trusted. Identity reuse checks reduce repeated entries; they cannot prove one human per Discord account or NFT wallet, or prevent a creator from owning other eligible identities. No independent jury or additional tokens/NFT system were introduced.

## Validation results

- 87 Solidity tests passed, including 11 community contract tests.
- 66 application/unit tests passed.
- 13 main browser scenarios passed; the final community/Russian UI subset was repeated successfully after the last UI changes.
- 4 automatic-executor scenarios passed, including community cancellation/refund when all roles are lost and when Discord remains unavailable beyond the recovery window.
- Production TypeScript/Vite build passed. Existing dependency chunk-size and annotation warnings remain.
- Production browser smoke passed on six pages at both 320 px and 390 px, including the real payout, profile earnings, Russian UI, no horizontal overflow, no browser runtime errors, and no exposed `.env`.
- Configured-secret scan passed; `.env` and private `.data` storage are ignored.
- The testnet executor has approximately 0.04811 MON remaining. Refill `0x2937416b9e66E0Af149f9864d70B5500f1844489` in Monad Testnet before relying on further automated execution or the optional live Pyth tie callback probe.
