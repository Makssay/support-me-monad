import test from 'node:test';
import assert from 'node:assert/strict';
import {requireServiceEntitlement} from '../server/service-entitlement';

const registry=(tier:bigint,collected:boolean,paid=0n)=>({tiers:async()=>tier,collected:async()=>collected,paid:async()=>paid});
test('fee-exempt missions retain the verification tier registered at creation',async()=>{
 await requireServiceEntitlement(9,registry(1n,true),'escrow',1,1);
 await requireServiceEntitlement(9,registry(2n,true),'escrow',1,2);
 await requireServiceEntitlement(9,registry(1n,true,50n),'escrow',1,1);
});
test('exemptions do not grant unselected services or unregistered missions',async()=>{
 await assert.rejects(requireServiceEntitlement(9,registry(0n,true),'escrow',1,1),/did not include/);
 await assert.rejects(requireServiceEntitlement(9,registry(1n,true),'escrow',1,2),/did not include/);
 await assert.rejects(requireServiceEntitlement(9,registry(1n,false),'escrow',1,1),/did not include/);
 await assert.rejects(requireServiceEntitlement(9,undefined,'escrow',1,1),/did not include/);
});
test('legacy deployments retain their paid service requirement without collection flag',async()=>{
 const legacy={...registry(1n,true,50n),collected:async()=>{throw Error('Unsupported legacy method');}};
 await requireServiceEntitlement(8,legacy,'escrow',1,1);
 await assert.rejects(requireServiceEntitlement(8,registry(1n,true),'escrow',1,1),/did not include/);
 await requireServiceEntitlement(4,undefined,'escrow',1,1);
});
test('registry failures propagate rather than grant verification access',async()=>{
 const unavailable={...registry(1n,true),collected:async()=>{throw Error('RPC unavailable');}};
 await assert.rejects(requireServiceEntitlement(9,unavailable,'escrow',1,1),/RPC unavailable/);
});
