// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "./SupportMeStorage.sol";
/// @notice Immutable settlement code; used only through the escrow delegatecall entry points.
contract SettlementEngine is SupportMeStorage {
 function settleOverdueWork(uint256 id) external nonReentrant {
  uint256 startGas=gasleft();Mission storage m=missions[id];Policy storage p=policies[id];
  require(automation[id].enabled&&!m.closed&&block.timestamp>p.reviewDeadline&&(p.mode==Mode.PaidSlot||p.mode==Mode.Selected),InvalidParameters());
  uint256[] storage all=entries[id];
  uint256 end=workCursor[id]+BATCH;if(end>all.length)end=all.length;
  for(uint256 i=workCursor[id];i<end;i++){Contribution storage c=contributions[all[i]];
   if(c.status==Status.Pending){p.pending--;p.reserved--;activeWork[c.contributor]--;_reward(all[i]);}
   else if(c.status==Status.Assigned){c.status=Status.Expired;p.reserved--;activeWork[c.contributor]--;}
  }
  workCursor[id]=end;
  address[] storage holders=slotHolders[id];uint256 holderEnd=holderCursor[id]+BATCH;if(holderEnd>holders.length)holderEnd=holders.length;
  for(uint256 i=holderCursor[id];i<holderEnd;i++){Reservation storage r=reservations[id][holders[i]];if(r.active){r.active=false;p.reserved--;activeWork[holders[i]]--;}}
  holderCursor[id]=holderEnd;
  if(end<all.length||holderEnd<holders.length){_reimburse(id,startGas);return;}
  _reimburse(id,startGas);m.closed=true;uint256 refund=m.remaining;m.remaining=0;bool transferred=refund==0||_payReward(id,m.creator,refund);_refundAutomation(id);emit MissionClosed(id,refund,transferred);
 }
 function settleDraw(uint256 id) external nonReentrant {
  uint256 startGas=gasleft();Draw storage d=draws[id]; Mission storage m=missions[id]; require(d.ready&&!d.settled&&!m.closed,"Draw not ready or settled");
  Progress storage progress=drawProgress[id];uint256[] storage pool=candidates[id];
  if(!progress.scanned){uint256 end=progress.scan+32;if(end>entries[id].length)end=entries[id].length;for(uint256 k=progress.scan;k<end;k++)if(contributions[entries[id][k]].status==Status.Pending)pool.push(entries[id][k]);progress.scan=end;progress.scanned=end==entries[id].length;if(!progress.scanned){_reimburse(id,startGas);return;}}
  uint256 count=progress.paid+m.remaining/m.reward;if(count>pool.length)count=pool.length;uint256 endPaid=progress.paid+BATCH;if(endPaid>count)endPaid=count;
  for(uint256 i=progress.paid;i<endPaid;i++){ uint256 range=pool.length-i; uint256 threshold; unchecked{threshold=(0-range)%range;} uint256 random=uint256(keccak256(abi.encode(d.seed,id,i))); uint256 attempt;
   while(random<threshold){random=uint256(keccak256(abi.encode(d.seed,id,i,++attempt)));} uint256 j=i+random%range; (pool[i],pool[j])=(pool[j],pool[i]); if(policies[id].mode==Mode.CreatorChoice)policies[id].pending--;randomReward[pool[i]]=true;_reward(pool[i]); }
  progress.paid=endPaid;if(endPaid<count){_reimburse(id,startGas);return;}
  uint256 cleanup=progress.cleanup<count?count:progress.cleanup;uint256 endCleanup=cleanup+32;if(endCleanup>pool.length)endCleanup=pool.length;
  for(uint256 i=cleanup;i<endCleanup;i++){contributions[pool[i]].status=Status.NotWinner;if(policies[id].mode==Mode.CreatorChoice)policies[id].pending--;}
  progress.cleanup=endCleanup;if(endCleanup<pool.length){_reimburse(id,startGas);return;}d.settled=true;
  _reimburse(id,startGas);
  m.closed=true; uint256 refund=m.remaining; m.remaining=0; bool transferred=refund==0||_payReward(id,m.creator,refund); _refundAutomation(id);emit MissionClosed(id,refund,transferred); emit DrawSettled(id);
 }
 function closeMission(uint256 id) external nonReentrant {
  uint256 startGas=gasleft();
  Mission storage m=missions[id];require(m.creator!=address(0),InvalidParameters());require(automation[id].enabled||msg.sender==m.creator,"Creator only"); Policy storage p=policies[id]; require(!m.closed,"Mission closed");require(!recoveries[id].active&&!draws[id].requested,InvalidParameters());
  if(automation[id].enabled&&(p.mode==Mode.PaidSlot||p.mode==Mode.Selected))require(p.pending==0&&p.reserved==0,InvalidParameters());
  if(automation[id].enabled){require(communityGate.refundable(id)||m.remaining==0||(block.timestamp>p.reviewDeadline&&p.pending==0&&p.reserved==0),InvalidParameters());}
  if(automation[id].enabled&&p.mode==Mode.CreatorChoice&&m.remaining==0){for(uint256 i;i<entries[id].length;i++)if(contributions[entries[id][i]].status==Status.Pending){contributions[entries[id][i]].status=Status.NotWinner;p.pending--;}}
  if(p.mode==Mode.ReplyRaffle||p.mode==Mode.CommunityRaffle)require(entries[id].length==0||(!draws[id].requested&&communityGate.refundable(id)),InvalidParameters());
  else { require(p.pending==0||block.timestamp>p.reviewDeadline,InvalidParameters()); require(p.reserved==0||block.timestamp>p.reviewDeadline,InvalidParameters()); }
  _reimburse(id,startGas);m.closed=true; uint256 refund=m.remaining; m.remaining=0; bool transferred=refund==0||_payReward(id,m.creator,refund);_refundAutomation(id); emit MissionClosed(id,refund,transferred);
 }
 function recoverUnavailableDraw(uint256 id) external nonReentrant {
  uint256 startGas=gasleft();Mission storage m=missions[id];Policy storage p=policies[id];Draw storage d=draws[id];Recovery storage r=recoveries[id];
  require(m.creator!=address(0)&&!m.closed&&!d.ready&&block.timestamp>=recoveryAt(id),InvalidParameters());
  require(p.mode==Mode.ReplyRaffle||p.mode==Mode.CommunityRaffle||(p.mode==Mode.CreatorChoice&&automation[id].enabled),InvalidParameters());
  // An infrastructure outage must not be treated as a completed contest.
  // No eligibility provider is needed to refund the original funder.
  if(!r.active){r.active=true;emit RecoveryStarted(id);}
  uint256 end=r.cursor+32;if(end>entries[id].length)end=entries[id].length;
  for(uint256 i=r.cursor;i<end;i++){Contribution storage c=contributions[entries[id][i]];
   if(c.status==Status.Pending){c.status=Status.NotWinner;if(p.mode==Mode.CreatorChoice)p.pending--;}
  }
  r.cursor=end;r.payoutCursor=end;r.eligible=entries[id].length;r.scanned=end==entries[id].length;
  _reimburse(id,startGas);if(!r.scanned)return;
  m.closed=true;uint256 refund=m.remaining;m.remaining=0;
  bool transferred=refund==0||_payReward(id,m.creator,refund);_refundAutomation(id);
  emit MissionClosed(id,refund,transferred);emit RecoveryCompleted(id,0,0);
 }
}
