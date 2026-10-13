import {test} from 'node:test';import assert from 'node:assert/strict';
import {walletOrigin} from '../server/wallet-origin';
test('SIWE uses an exact approved origin, never arbitrary request host',()=>{
 const primary='https://support-me-monad.vercel.app',alias='https://support-me-monad.support-me.workers.dev';
 assert.equal(walletOrigin(primary,alias,alias),alias);assert.equal(walletOrigin(primary,alias,primary),primary);assert.equal(walletOrigin(primary,alias),primary);
 for(const origin of ['https://evil.example','null','https://support-me-monad.vercel.app.evil.example'])assert.throws(()=>walletOrigin(primary,alias,origin));
 assert.throws(()=>walletOrigin('http://public.example',''));assert.equal(walletOrigin('http://127.0.0.1:5174',''),'http://127.0.0.1:5174');
});
