import {getAddress,parseEther,ZeroAddress} from 'ethers';
import {TokenTransferError} from './token-transfer';

export function validateNativeTransfer(sender:string,recipient:string,amount:string,balance:bigint){
 let to:string;
 try{to=getAddress(recipient.trim());}catch{throw new TokenTransferError('Enter a valid wallet address.');}
 if(to===ZeroAddress||to.toLowerCase()===sender.toLowerCase())throw new TokenTransferError('Choose another recipient wallet.');
 if(!/^\d+(?:\.\d+)?$/.test(amount.trim())||(amount.trim().split('.')[1]?.length??0)>18)throw new TokenTransferError('Enter a positive MON amount with up to 18 decimals.');
 let units:bigint;try{units=parseEther(amount.trim());}catch{throw new TokenTransferError('Enter a positive MON amount with up to 18 decimals.');}
 if(units<=0n)throw new TokenTransferError('Enter a positive MON amount with up to 18 decimals.');
 if(units>balance)throw new TokenTransferError('The amount exceeds your available MON balance.');
 return {to,units};
}
