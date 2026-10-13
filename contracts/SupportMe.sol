// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "./SettlementEngine.sol";
contract SupportMe is SupportMeStorage {
 // Set only in the constructor; there is deliberately no upgrade or admin setter.
 address public settlementEngine;
 constructor(address entropy_,address verifier_,address fees_){ require(entropy_!=address(0)&&verifier_!=address(0),InvalidParameters()); entropy=entropy_; verifier=verifier_;creationFees=fees_;communityGate=new CommunityGate(verifier_);settlementEngine=address(new SettlementEngine()); }
 function createMissionPaid(uint256 reward,uint64 deadline,uint32 reviewWindow,Mode mode,uint32 workWindow,string calldata metadata,uint8 feeTier) external payable nonReentrant returns(uint256){return _create(reward,deadline,reviewWindow,mode,workWindow,metadata,msg.value-creationFee(feeTier),feeTier);}
 function _create(uint256 reward,uint64 deadline,uint32 reviewWindow,Mode mode,uint32 workWindow,string calldata metadata,uint256 budget,uint8 feeTier) private returns(uint256 id){
  require(reward>0&&budget>=reward&&budget%reward==0,InvalidParameters()); uint256 slots=budget/reward;
  require(slots<=((mode==Mode.ReplyRaffle||mode==Mode.CommunityRaffle)?20:100),InvalidParameters()); require(deadline>block.timestamp&&deadline<=block.timestamp+90 days,InvalidParameters());
  require(reviewWindow>=((block.chainid==10143||block.chainid==31337)?300:1 days)&&reviewWindow<=7 days,InvalidParameters()); require(workWindow>=((block.chainid==10143||block.chainid==31337)?300:1 hours)&&workWindow<=7 days,InvalidParameters()); _reference(metadata);
  id=++missionCount; missions[id]=Mission(msg.sender,reward,budget,deadline,false,metadata); policies[id]=Policy(mode,deadline+reviewWindow,workWindow,uint16(slots),0,0); emit MissionCreated(id,reward,budget);if(creationFees!=address(0))ICreationFees(creationFees).collectFor{value:creationFee(feeTier)}(id,feeTier,msg.sender);
 }

 function createMissionV3(uint256 reward,uint16 slots,uint64 deadline,uint32 reviewWindow,Mode mode,uint32 workWindow,string calldata metadata,uint256 pythReserve,uint256 executionReserve,uint8 feeTier) external payable nonReentrant returns(uint256 id){
  bool randomMode=mode==Mode.CreatorChoice||mode==Mode.ReplyRaffle||mode==Mode.CommunityRaffle;
  require(randomMode?pythReserve>=IEntropy(entropy).getFeeV2()*2:pythReserve==0,InvalidParameters());
  require(executionReserve>=0.3 ether,InvalidParameters());
  uint256 budget=reward*slots; require(msg.value==budget+pythReserve+executionReserve+creationFee(feeTier),"Incorrect total funding");
  id=_create(reward,deadline,reviewWindow,mode,workWindow,metadata,budget,feeTier);
  automation[id]=Automation(true,pythReserve,executionReserve);emit AutomationFunded(id,pythReserve,executionReserve);
 }

 function createTokenMission(TokenMission calldata f,string calldata metadata,uint64 validUntil,bytes calldata signature) external payable nonReentrant returns(uint256 id){return _createToken(f,metadata,validUntil,signature);}
 function _createToken(TokenMission calldata f,string calldata metadata,uint64 validUntil,bytes calldata signature) private returns(uint256 id){
  require(f.token.code.length>0&&block.timestamp<=validUntil);
  _checkSignature(keccak256(abi.encode("Support Me reward token",block.chainid,address(this),f.token,validUntil)),signature);
  if(f.protectedMode){
   bool randomMode=f.mode==Mode.CreatorChoice||f.mode==Mode.ReplyRaffle||f.mode==Mode.CommunityRaffle;
   require(randomMode?f.pythReserve>=IEntropy(entropy).getFeeV2()*2:f.pythReserve==0,InvalidParameters());
   require(f.executionReserve>=0.3 ether,InvalidParameters());
  }else require(f.pythReserve==0&&f.executionReserve==0);
  require(msg.value==f.pythReserve+f.executionReserve+creationFee(f.feeTier),"Incorrect total funding");
  uint256 budget=f.reward*f.slots;
  id=_create(f.reward,f.deadline,f.reviewWindow,f.mode,f.workWindow,metadata,budget,f.feeTier);rewardToken[id]=f.token;
  uint256 beforeBalance=IRewardToken(f.token).balanceOf(address(this));
  _tokenCall(f.token,abi.encodeCall(IRewardToken.transferFrom,(msg.sender,address(this),budget)));
  require(IRewardToken(f.token).balanceOf(address(this))==beforeBalance+budget);
  if(f.protectedMode){automation[id]=Automation(true,f.pythReserve,f.executionReserve);emit AutomationFunded(id,f.pythReserve,f.executionReserve);}
  emit TokenMissionFunded(id,f.token,budget);
 }
 function createGatedMission(TokenMission calldata f,string calldata metadata,bytes32 policyHash,bool recheck,uint32 recoveryWindow,uint64 tokenValidUntil,bytes calldata tokenSignature) external payable nonReentrant returns(uint256 id){
  require(policyHash!=bytes32(0),InvalidParameters());
  if(f.token!=address(0))id=_createToken(f,metadata,tokenValidUntil,tokenSignature);
  else {
   require(msg.value==f.reward*f.slots+f.pythReserve+f.executionReserve+creationFee(f.feeTier),InvalidParameters());
   if(f.protectedMode){require(f.executionReserve>=0.3 ether,InvalidParameters());bool randomMode=f.mode==Mode.CreatorChoice||f.mode==Mode.ReplyRaffle||f.mode==Mode.CommunityRaffle;require(randomMode?f.pythReserve>=IEntropy(entropy).getFeeV2()*2:f.pythReserve==0,InvalidParameters());}
   else require(f.pythReserve==0&&f.executionReserve==0,InvalidParameters());
   id=_create(f.reward,f.deadline,f.reviewWindow,f.mode,f.workWindow,metadata,f.reward*f.slots,f.feeTier);
   if(f.protectedMode){automation[id]=Automation(true,f.pythReserve,f.executionReserve);emit AutomationFunded(id,f.pythReserve,f.executionReserve);}
  }
  communityGate.setPolicy(id,policyHash,recheck&&(f.mode==Mode.ReplyRaffle||f.mode==Mode.CommunityRaffle),recoveryWindow);
 }

 // Isolated self-call: failed or taxed transfers revert token state before recording a claim.


 function withdrawTokenCredit(address token,address recipient) external nonReentrant {
  _withdrawTokenCredit(token,recipient,tokenCredits[msg.sender][token]);
 }
 function withdrawTokenCreditAmount(address token,address recipient,uint256 amount) external nonReentrant {
  _withdrawTokenCredit(token,recipient,amount);
 }
 function _withdrawTokenCredit(address token,address recipient,uint256 amount) private {
  require(recipient!=address(0)&&recipient!=address(this),InvalidParameters());require(amount>0&&amount<=tokenCredits[msg.sender][token],"No credit");tokenCredits[msg.sender][token]-=amount;
  this.sendTokenExact(token,recipient,amount);emit TokenCreditWithdrawn(msg.sender,token,recipient,amount);
 }
 function topUpAutomation(uint256 id) external payable nonReentrant {
  require(automation[id].enabled&&!missions[id].closed&&!draws[id].requested,InvalidParameters());
  automation[id].pythReserve+=msg.value;
 }



 function reserveSlot(uint256 id) external nonReentrant {
  communityGate.checkAdmission(id,msg.sender); Mission storage m=_open(id); Policy storage p=policies[id]; require(p.mode==Mode.PaidSlot,InvalidParameters());
  require(msg.sender!=m.creator&&!hasSubmitted[id][msg.sender],InvalidParameters()); require(!reservations[id][msg.sender].active&&activeWork[msg.sender]<3,InvalidParameters());
  require(uint256(p.reserved)*m.reward<m.remaining,"No free slots"); uint64 expires=uint64(block.timestamp+p.workWindow); if(expires>m.deadline)expires=m.deadline;
  reservations[id][msg.sender]=Reservation(expires,true); p.reserved++; activeWork[msg.sender]++; emit SlotReserved(id,msg.sender,expires);
  if(!knownHolder[id][msg.sender]){require(slotHolders[id].length<256,InvalidParameters()); knownHolder[id][msg.sender]=true; slotHolders[id].push(msg.sender);}
 }
 function releaseSlot(uint256 id,address contributor) external nonReentrant {
  Reservation storage r=reservations[id][contributor]; require(r.active&&(msg.sender==contributor||block.timestamp>=r.expires),"Slot still active");
  r.active=false; policies[id].reserved--; activeWork[contributor]--; emit SlotReleased(id,contributor);
 }
 function submitContribution(uint256 id,string calldata metadata) external nonReentrant returns(uint256 cid){
  _open(id); Policy storage p=policies[id]; require(p.mode!=Mode.Selected&&p.mode!=Mode.ReplyRaffle&&p.mode!=Mode.CommunityRaffle,"Use mission-specific submission");
  if(p.mode==Mode.PaidSlot){ Reservation storage r=reservations[id][msg.sender]; require(r.active&&block.timestamp<r.expires,InvalidParameters()); r.active=false; }
  cid=_submit(id,metadata,Status.Pending); p.pending++; reputation[msg.sender].submitted++;
 }
 function submitProposal(uint256 id,string calldata metadata) external nonReentrant returns(uint256){ _open(id); require(policies[id].mode==Mode.Selected,InvalidParameters()); return _submit(id,metadata,Status.Proposed); }
 function selectContributor(uint256 cid) external nonReentrant {
  Contribution storage c=contributions[cid]; Mission storage m=_owner(c.missionId); Policy storage p=policies[c.missionId];
  require(!m.closed&&block.timestamp<m.deadline&&c.status==Status.Proposed,InvalidParameters());
  require(uint256(p.reserved)*m.reward<m.remaining&&activeWork[c.contributor]<3,InvalidParameters());
  c.status=Status.Assigned; p.reserved++; activeWork[c.contributor]++; uint64 end=uint64(block.timestamp+p.workWindow); if(end>m.deadline)end=m.deadline;
  deliveryDeadline[cid]=end; emit ContributorSelected(cid,end);
 }
 function deliverWork(uint256 cid,string calldata metadata) external nonReentrant {
  Contribution storage c=contributions[cid]; require(msg.sender==c.contributor&&c.status==Status.Assigned&&!missions[c.missionId].closed&&block.timestamp<deliveryDeadline[cid],InvalidParameters());
  _reference(metadata); c.metadata=metadata; c.status=Status.Pending; policies[c.missionId].pending++; reputation[msg.sender].submitted++; emit ContributionSubmitted(cid,c.missionId,msg.sender);
 }
 function expireAssignment(uint256 cid) external nonReentrant {
  Contribution storage c=contributions[cid]; require(c.status==Status.Assigned&&block.timestamp>=deliveryDeadline[cid],"Assignment still active"); c.status=Status.Expired; policies[c.missionId].reserved--; activeWork[c.contributor]--;
 }
 function _submit(uint256 id,string calldata metadata,Status status) private returns(uint256 cid){
  communityGate.checkAdmission(id,msg.sender); require(msg.sender!=missions[id].creator,"Own mission"); require(!hasSubmitted[id][msg.sender],"Already submitted"); _reference(metadata); require(entries[id].length<256,InvalidParameters());
  hasSubmitted[id][msg.sender]=true; cid=++contributionCount; contributions[cid]=Contribution(id,msg.sender,status,0,metadata); if(status==Status.Proposed)proposalMetadata[cid]=metadata; entries[id].push(cid); emit ContributionSubmitted(cid,id,msg.sender);
 }
 function approveContribution(uint256 cid) external nonReentrant {
  Contribution storage c=contributions[cid]; _owner(c.missionId); require(policies[c.missionId].mode!=Mode.CommunityRaffle&&policies[c.missionId].mode!=Mode.ReplyRaffle&&policies[c.missionId].mode!=Mode.BugBounty,"Use mission-specific approval"); _approve(cid);
 }
 function approveBug(uint256 cid,bytes32 bugKey) external nonReentrant {
  Contribution storage c=contributions[cid]; _owner(c.missionId); require(policies[c.missionId].mode==Mode.BugBounty&&bugKey!=bytes32(0),InvalidParameters()); require(rewardedBugs[c.missionId][bugKey]==0,"Bug already rewarded"); rewardedBugs[c.missionId][bugKey]=cid; _approve(cid);
 }
 function _approve(uint256 cid) private {
  Contribution storage c=contributions[cid]; Mission storage m=missions[c.missionId]; Policy storage p=policies[c.missionId];
  require(!m.closed&&block.timestamp<=p.reviewDeadline,"Review ended"); require(c.status==Status.Pending,"Already reviewed"); require(m.remaining>=m.reward,InvalidParameters());
  p.pending--; if(p.mode==Mode.PaidSlot||p.mode==Mode.Selected){ p.reserved--; activeWork[c.contributor]--; } _reward(cid);
 }

 function rejectContribution(uint256 cid,string calldata reason) external nonReentrant {
  Contribution storage c=contributions[cid]; Mission storage m=_owner(c.missionId); Policy storage p=policies[c.missionId]; require(p.mode!=Mode.ReplyRaffle&&p.mode!=Mode.CommunityRaffle,InvalidParameters()); require(!(automation[c.missionId].enabled&&p.mode==Mode.CreatorChoice),InvalidParameters());
  require(!m.closed&&block.timestamp<=p.reviewDeadline&&(c.status==Status.Pending||c.status==Status.Proposed),InvalidParameters()); require(bytes(reason).length>=10&&bytes(reason).length<=500,"Explain the rejection");
  if(c.status==Status.Pending){ p.pending--; if(p.mode==Mode.PaidSlot||p.mode==Mode.Selected){p.reserved--; activeWork[c.contributor]--;} }
  c.status=Status.Rejected; rejectionReasons[cid]=reason; emit ContributionRejected(cid);
 }
 function expireReview(uint256 cid) external nonReentrant {
  Contribution storage c=contributions[cid]; Policy storage p=policies[c.missionId]; require(!automation[c.missionId].enabled||p.mode==Mode.BugBounty,InvalidParameters()); require(c.status==Status.Pending&&p.mode!=Mode.ReplyRaffle&&p.mode!=Mode.CommunityRaffle&&block.timestamp>p.reviewDeadline,InvalidParameters());
  p.pending--; if(p.mode==Mode.PaidSlot||p.mode==Mode.Selected){p.reserved--; activeWork[c.contributor]--;} c.status=Status.Expired; rejectionReasons[cid]="Creator did not review before the published deadline.";
 }
 function submitReply(uint256 id,string calldata metadata,uint256 xUser,uint256 post,uint64 validUntil,bytes calldata signature) external nonReentrant returns(uint256 cid){
  _open(id); require(policies[id].mode==Mode.ReplyRaffle,InvalidParameters()); require(xUser!=0&&post!=0&&!usedXUsers[id][xUser]&&!usedPosts[id][post],InvalidParameters()); require(block.timestamp<=validUntil,"Verification expired"); require(signature.length==65,InvalidParameters());
  _checkSignature(keccak256(abi.encode(block.chainid,address(this),id,msg.sender,xUser,post,validUntil)),signature);
  usedXUsers[id][xUser]=true; usedPosts[id][post]=true; cid=_submit(id,metadata,Status.Pending); entryXUser[cid]=xUser; entryPost[cid]=post; reputation[msg.sender].submitted++;
 }
 function enterCommunity(uint256 id,string calldata metadata) external nonReentrant returns(uint256 cid){_open(id);require(policies[id].mode==Mode.CommunityRaffle,InvalidParameters());cid=_submit(id,metadata,Status.Pending);reputation[msg.sender].submitted++;}
 function _checkSignature(bytes32 digest,bytes calldata signature) private view {
  bytes32 signed=keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",digest));
  bytes32 r; bytes32 s; uint8 v; assembly ("memory-safe") { r:=calldataload(signature.offset) s:=calldataload(add(signature.offset,32)) v:=byte(0,calldataload(add(signature.offset,64))) }
  require(uint256(s)<=0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0&&(v==27||v==28),InvalidParameters()); require(ecrecover(signed,v,r,s)==verifier,"Invalid verification");
 }
 function raffleEntries(uint256 id) external view returns(uint256[] memory){return entries[id];}
 function reservationHolders(uint256 id) external view returns(address[] memory){return slotHolders[id];}
 function drawFee() external view returns(uint256){return IEntropy(entropy).getFeeV2();}
 function requestDraw(uint256 id) external payable nonReentrant {
  uint256 startGas=gasleft();Mission storage m=missions[id];Policy storage p=policies[id];Draw storage d=draws[id];Automation storage funding=automation[id];
  bool fallbackDraw=funding.enabled&&p.mode==Mode.CreatorChoice;
  require((p.mode==Mode.ReplyRaffle||p.mode==Mode.CommunityRaffle||fallbackDraw)&&!m.closed&&block.timestamp>=(fallbackDraw?p.reviewDeadline+1:m.deadline)&&block.timestamp<recoveryAt(id)&&!recoveries[id].active,InvalidParameters());
  require(!d.requested&&m.remaining>=m.reward,InvalidParameters());communityGate.checkDraw(id);
  uint256 count;for(uint256 i;i<entries[id].length;i++)if(contributions[entries[id][i]].status==Status.Pending){if(communityGate.eligible(id,contributions[entries[id][i]].contributor))count++;else contributions[entries[id][i]].status=Status.NotWinner;}
  require(count>0,InvalidParameters());uint256 fee=IEntropy(entropy).getFeeV2();
  if(funding.enabled){require(msg.value==0&&funding.pythReserve>=fee,"Pyth reserve insufficient");funding.pythReserve-=fee;}
  else require(msg.value==fee,InvalidParameters());
  d.requested=true;d.provider=IEntropy(entropy).getDefaultProvider();uint64 sequence=IEntropy(entropy).requestV2{value:fee}();d.sequence=sequence;requestMission[sequence]=id;emit DrawRequested(id,sequence,keccak256(abi.encode(entries[id])));_reimburse(id,startGas);
 }
 // Exact Pyth IEntropyConsumer callback selector. Only Entropy can supply the seed.
 function _entropyCallback(uint64 sequence,address provider,bytes32 seed) external {
  require(msg.sender==entropy,InvalidParameters()); uint256 id=requestMission[sequence]; Draw storage d=draws[id]; if(id==0||d.ready||missions[id].closed||recoveries[id].active||block.timestamp>=recoveryAt(id)||d.provider!=provider||d.sequence!=sequence)return; d.seed=seed; d.ready=true; emit RandomnessReceived(id,seed);
 }


 /// @notice Withdraw a failed native transfer credit to a chosen receiving address.

 function withdrawCredit(address payable recipient) external nonReentrant { require(recipient!=address(0),InvalidParameters()); uint256 amount=credits[msg.sender]; require(amount>0,"No credit"); credits[msg.sender]=0; (bool ok,)=recipient.call{value:amount}(""); require(ok,InvalidParameters()); emit CreditWithdrawn(msg.sender,recipient,amount); }
 function _open(uint256 id) private view returns(Mission storage m){m=missions[id]; require(m.creator!=address(0),InvalidParameters()); require(!m.closed&&block.timestamp<m.deadline&&m.remaining>=m.reward,InvalidParameters());}
 function _owner(uint256 id) private view returns(Mission storage m){m=missions[id]; require(m.creator!=address(0),InvalidParameters()); require(msg.sender==m.creator,"Creator only");}
 function _reference(string calldata metadata) private pure {require(bytes(metadata).length>0&&bytes(metadata).length<=4096,InvalidParameters());}

 function settleOverdueWork(uint256) external { _delegateSettlement(); }
 function settleDraw(uint256) external { _delegateSettlement(); }
 function closeMission(uint256) external { _delegateSettlement(); }
 function recoverUnavailableDraw(uint256) external { _delegateSettlement(); }
 function _delegateSettlement() private {address target=settlementEngine;assembly ("memory-safe") {let ptr:=mload(0x40) calldatacopy(ptr,0,calldatasize()) let ok:=delegatecall(gas(),target,ptr,calldatasize(),0,0) returndatacopy(ptr,0,returndatasize()) switch ok case 0 {revert(ptr,returndatasize())} default {return(ptr,returndatasize())}}}
}
