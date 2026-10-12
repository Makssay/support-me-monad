import { getAddress, parseUnits, ZeroAddress } from 'ethers';
import type { RewardAsset } from '../shared/rewards';

export class TokenTransferError extends Error {}
export const tokenTransferAbi = [
 'function balanceOf(address) view returns(uint256)',
 'function decimals() view returns(uint8)',
 'function transfer(address,uint256) returns(bool)',
];
export function validateTokenTransfer(asset: RewardAsset, chainId: number, sender: string, recipient: string, amount: string, balance: bigint) {
 let token: string, to: string;
 try { token = getAddress(asset.address); to = getAddress(recipient.trim()); }
 catch { throw new TokenTransferError('Enter a valid wallet address.'); }
 if (asset.chainId !== chainId || token === ZeroAddress || asset.source === 'native') throw new TokenTransferError('This token is not available on the selected network.');
 if (to === ZeroAddress || to.toLowerCase() === token.toLowerCase() || to.toLowerCase() === sender.toLowerCase()) throw new TokenTransferError('Choose another recipient wallet.');
 if (!Number.isInteger(asset.decimals) || asset.decimals < 0 || asset.decimals > 255) throw new TokenTransferError('Token decimals could not be verified.');
 if (!/^\d+(?:\.\d+)?$/.test(amount.trim()) || (amount.trim().split('.')[1]?.length ?? 0) > asset.decimals) throw new TokenTransferError('Enter a positive amount within the token precision.');
 let units: bigint;
 try { units = parseUnits(amount.trim(), asset.decimals); } catch { throw new TokenTransferError('Enter a positive amount within the token precision.'); }
 if (units <= 0n) throw new TokenTransferError('Enter a positive amount within the token precision.');
 if (units > balance) throw new TokenTransferError('The amount exceeds your available token balance.');
 return { token, to, units };
}
