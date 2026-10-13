# Platform fee exemptions (escrow V9)

The mainnet launch allowlist is `fee-exemptions.json`. It currently contains the organizer address `0xf337687dD73c1A13EFE39393a000f55a95B1ac54`.

Only the immutable CreationFees treasury can call `setExempt(wallet, enabled)`. Exemptions affect platform creation fees only. Prize funding, Pyth funding, execution reserves and network gas remain required. The escrow passes the actual caller to the fee collector; no Twitter identifier or tx.origin is used. Zero-value collections have a separate replay guard and still record the selected verification tier.

V9 exposes `creationFeeFor(wallet, tier)` for an explicit quote; `creationFee(tier)` quotes the caller. The UI uses the V9 quote and refreshes it before publication; old deployments retain their original fixed fees. Exemptions apply to the direct creator wallet. The disabled AI constructor remains unavailable and receives no forwarded end-user exemption.

`scripts/deploy.ts` loads the allowlist, requires the deployment signer to be the treasury when it is nonempty, and confirms each exemption before publishing the new escrow deployment record. It still requires `--new` to replace an existing deployment. Do not replace a live escrow merely to activate an exemption: existing missions and balances remain on their original contracts. Mainnet deployment requires the separately reviewed mainnet deployment configuration; the existing deployment helper remains testnet guarded.

These changes are source preparation, not an update to an already deployed immutable contract. No exemption has been activated on the current hosted testnet contract by this change.

Validation: all 143 Foundry contract tests pass, including five exemption tests; TypeScript check passes. Compiled escrow runtime is 22,131 bytes, below the EIP-170 limit. No deployment was performed for this change.
