// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
interface ICommunityLedger {
 function missions(uint256) external view returns(address,uint256,uint256,uint64,bool,string memory);
 function raffleEntries(uint256) external view returns(uint256[] memory);
 function contributions(uint256) external view returns(uint256,address,uint8,uint256,string memory);
 function entropy() external view returns(address);
}
interface ICommunityEntropy {function getFeeV2() external view returns(uint256);function getDefaultProvider() external view returns(address);function requestV2() external payable returns(uint64);}
/// @notice Immutable community policies; external evidence trusts the disclosed verifier.
contract CommunityGate {
 address public immutable ledger;address public immutable verifier;
 struct Policy {bytes32 hash;bool recheck;uint32 recoveryWindow;bool finalized;uint16 eligibleCount;}
 mapping(uint256=>Policy) public policies;
 mapping(uint256=>mapping(address=>bool)) public admitted;
 mapping(uint256=>mapping(bytes32=>address)) public identityOwner;
 mapping(uint256=>mapping(address=>bool)) private excluded;
 mapping(bytes32=>bytes32) public snapshotSeeds;mapping(bytes32=>bool) public snapshotReady;mapping(bytes32=>bool) public snapshotRequested;
 mapping(uint64=>bytes32) private sequences;mapping(bytes32=>address) private snapshotProvider;
 event PolicyFixed(uint256 indexed missionId,bytes32 policyHash,bool recheck,uint32 recoveryWindow);
 event Admitted(uint256 indexed missionId,address indexed wallet);
 event Finalized(uint256 indexed missionId,bytes32 entryHash,uint16 eligibleCount);
 event SnapshotRequested(bytes32 indexed snapshotHash,uint64 sequence);
 event SnapshotReady(bytes32 indexed snapshotHash,bytes32 seed);
 constructor(address verifier_){ledger=msg.sender;verifier=verifier_;}
 function setPolicy(uint256 id,bytes32 hash,bool recheck,uint32 recoveryWindow) external {
  require(msg.sender==ledger&&hash!=bytes32(0)&&policies[id].hash==bytes32(0),"Immutable policy");
  require(recoveryWindow==1 days||((block.chainid==10143||block.chainid==31337)&&recoveryWindow==300),"Invalid recovery window");
  policies[id]=Policy(hash,recheck,recoveryWindow,false,0);emit PolicyFixed(id,hash,recheck,recoveryWindow);
 }
 function authorize(uint256 id,address wallet,bytes32[] calldata identities,uint64 validUntil,bytes calldata signature) external {
  Policy storage p=policies[id];(,,,uint64 deadline,bool closed,)=ICommunityLedger(ledger).missions(id);
  require(p.hash!=bytes32(0)&&!closed&&block.timestamp<deadline&&block.timestamp<=validUntil&&validUntil<=deadline,"Admission expired");
  require(identities.length>0&&identities.length<=4,"Invalid identities");
  _verify(keccak256(abi.encode("Support Me community admission",block.chainid,address(this),ledger,id,p.hash,wallet,keccak256(abi.encode(identities)),validUntil)),signature);
  for(uint256 i;i<identities.length;i++){require(identities[i]!=bytes32(0),"Invalid identity");address owner=identityOwner[id][identities[i]];require(owner==address(0)||owner==wallet,"Identity already entered");identityOwner[id][identities[i]]=wallet;}
  admitted[id][wallet]=true;emit Admitted(id,wallet);
 }
 function checkAdmission(uint256 id,address wallet) external view {require(policies[id].hash==bytes32(0)||admitted[id][wallet],"Verify community eligibility first");}
 function finalize(uint256 id,uint256[] calldata rejected,uint64 validUntil,bytes calldata signature) external {
  Policy storage p=policies[id];(,,,uint64 deadline,bool closed,)=ICommunityLedger(ledger).missions(id);
  require(p.hash!=bytes32(0)&&p.recheck&&!p.finalized&&!closed&&block.timestamp>=deadline&&block.timestamp<=deadline+p.recoveryWindow&&block.timestamp<=validUntil,"Final check unavailable");
  uint256[] memory entries=ICommunityLedger(ledger).raffleEntries(id);bytes32 entryHash=keccak256(abi.encode(entries));
  _verify(keccak256(abi.encode("Support Me community final check",block.chainid,address(this),ledger,id,p.hash,entryHash,keccak256(abi.encode(rejected)),validUntil)),signature);
  require(rejected.length<=entries.length,"Invalid excluded list");
  for(uint256 i;i<rejected.length;i++){bool found;for(uint256 j;j<entries.length;j++)if(entries[j]==rejected[i])found=true;require(found,"Unknown entry");for(uint256 j;j<i;j++)require(rejected[j]!=rejected[i],"Duplicate entry");(,address who,,,)=ICommunityLedger(ledger).contributions(rejected[i]);excluded[id][who]=true;}
  p.finalized=true;p.eligibleCount=uint16(entries.length-rejected.length);emit Finalized(id,entryHash,p.eligibleCount);
 }
 function checkDraw(uint256 id) external view {Policy storage p=policies[id];require(!p.recheck||p.finalized,"Community final check pending");}
 function eligible(uint256 id,address wallet) external view returns(bool){return !excluded[id][wallet];}
 function refundable(uint256 id) external view returns(bool){Policy storage p=policies[id];(,,,uint64 deadline,,)=ICommunityLedger(ledger).missions(id);return p.recheck&&((!p.finalized&&block.timestamp>deadline+p.recoveryWindow)||(p.finalized&&p.eligibleCount==0));}
 function requestSnapshot(bytes32 hash,uint64 validUntil,bytes calldata signature) external payable {
  require(!snapshotRequested[hash]&&hash!=bytes32(0)&&block.timestamp<=validUntil,"Snapshot unavailable");
  _verify(keccak256(abi.encode("Support Me holder tie draw",block.chainid,address(this),hash,validUntil)),signature);
  address entropy=ICommunityLedger(ledger).entropy();require(msg.value==ICommunityEntropy(entropy).getFeeV2(),"Incorrect Pyth fee");snapshotRequested[hash]=true;snapshotProvider[hash]=ICommunityEntropy(entropy).getDefaultProvider();
  uint64 seq=ICommunityEntropy(entropy).requestV2{value:msg.value}();sequences[seq]=hash;emit SnapshotRequested(hash,seq);
 }
 function _entropyCallback(uint64 seq,address provider,bytes32 seed) external {
  require(msg.sender==ICommunityLedger(ledger).entropy(),"Entropy only");bytes32 hash=sequences[seq];if(hash==bytes32(0)||snapshotReady[hash]||snapshotProvider[hash]!=provider)return;snapshotSeeds[hash]=seed;snapshotReady[hash]=true;emit SnapshotReady(hash,seed);
 }
 function _verify(bytes32 digest,bytes calldata signature) private view {
  require(signature.length==65,"Invalid signature");bytes32 r;bytes32 s;uint8 v;assembly("memory-safe"){r:=calldataload(signature.offset) s:=calldataload(add(signature.offset,32)) v:=byte(0,calldataload(add(signature.offset,64)))}
  require(uint256(s)<=0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0&&(v==27||v==28),"Invalid signature");
  require(ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",digest)),v,r,s)==verifier,"Invalid verification");
 }
}
