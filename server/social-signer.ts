import { jsonStore, checkpoint, cloudStorage } from './persistence';
import fs from 'node:fs';
import { Wallet } from 'ethers';
// Dedicated eligibility signer, never the funded deployment wallet. No onchain signing.
export function socialSigner() {
 if(cloudStorage){if(!process.env.SOCIAL_VERIFIER_PRIVATE_KEY)throw new Error('Eligibility signer is unavailable.');const wallet=new Wallet(process.env.SOCIAL_VERIFIER_PRIVATE_KEY);const sign=wallet.signMessage.bind(wallet);wallet.signMessage=async message=>{await checkpoint();return sign(message);};return wallet;}
 const file = '.data/social-verifier.json'; fs.mkdirSync('.data', { recursive: true });
 if (!fs.existsSync(file)) { const wallet = Wallet.createRandom(); fs.writeFileSync(file, JSON.stringify({ privateKey: wallet.privateKey }), { mode: 0o600 }); }
 const data = JSON.parse(fs.readFileSync(file, 'utf8')); return new Wallet(data.privateKey);
}
