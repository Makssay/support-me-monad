// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
interface ISupportMe {
 function createMissionV2(uint256,uint64,uint32,uint8,uint32,string calldata) external payable returns(uint256);
 function creationFee(uint8) external view returns(uint256);
 function createMissionPaid(uint256,uint64,uint32,uint8,uint32,string calldata,uint8) external payable returns(uint256);
 function rewardToken(uint256) external view returns(address);
 function tokenCredits(address,address) external view returns(uint256);
 function withdrawTokenCredit(address,address) external;
 function withdrawTokenCreditAmount(address,address,uint256) external;
 struct TokenMission {address token;uint256 reward;uint16 slots;uint64 deadline;uint32 reviewWindow;uint8 mode;uint32 workWindow;bool protectedMode;uint256 pythReserve;uint256 executionReserve;uint8 feeTier;}
 function createTokenMission(TokenMission calldata,string calldata,uint64,bytes calldata) external payable returns(uint256);
 function createGatedMission(TokenMission calldata,string calldata,bytes32,bool,uint32,uint64,bytes calldata) external payable returns(uint256);
 function missions(uint256) external view returns(address,uint256,uint256,uint64,bool,string memory);
 function contributions(uint256) external view returns(uint256,address,uint8,uint256,string memory);
 function raffleEntries(uint256) external view returns(uint256[] memory);
 function policies(uint256) external view returns(uint8,uint64,uint32,uint16,uint16,uint16);
 function approveContribution(uint256) external;
 function rejectContribution(uint256,string calldata) external;
 function closeMission(uint256) external;
 function credits(address) external view returns(uint256);
 function withdrawCredit(address payable) external;
}
/// @notice AI selection trusts the disclosed signing service, not the creator. Existing MON escrow handles rewards.
interface IAIToken { function balanceOf(address) external view returns(uint256); function transfer(address,uint256) external returns(bool); function transferFrom(address,address,uint256) external returns(bool); function approve(address,uint256) external returns(bool); }
contract AIContestController {
 ISupportMe public immutable ledger;
 address public immutable verifier;
 mapping(uint256=>address) public organizers;
 mapping(uint256=>bytes32) public policyHashes;
 mapping(uint256=>uint16) public prizes;
 mapping(uint256=>bytes32) public results;
 mapping(address=>uint256) public credits;
 mapping(address=>mapping(address=>uint256)) public tokenCredits;
 mapping(address=>mapping(address=>uint256)) public escrowTokenCredits;
 uint256 private entered;
 event AIContestCreated(uint256 indexed missionId,address indexed organizer,bytes32 policyHash);
 event AIContestSettled(uint256 indexed missionId,bytes32 resultHash,bytes32 entryHash,uint256[] winners);
 modifier nonReentrant(){require(entered==0,"Reentrant");entered=1;_;entered=0;}
 constructor(address ledger_,address verifier_){require(ledger_!=address(0)&&verifier_!=address(0),"Invalid infrastructure");ledger=ISupportMe(ledger_);verifier=verifier_;}
 function createContest(uint256 reward,uint64 deadline,uint32 reviewWindow,string calldata metadata) external payable nonReentrant returns(uint256 id){
  uint256 budget=msg.value-ledger.creationFee(2);require(reward>0&&budget>=reward&&budget%reward==0&&budget/reward<=20,"Invalid prizes");
  id=ledger.createMissionPaid{value:msg.value}(reward,deadline,reviewWindow,0,1 days,metadata,2);
  organizers[id]=msg.sender;policyHashes[id]=keccak256(bytes(metadata));prizes[id]=uint16(budget/reward);
  emit AIContestCreated(id,msg.sender,policyHashes[id]);
 }
 function createTokenContest(address token,uint256 reward,uint16 slots,uint64 deadline,uint32 reviewWindow,string calldata metadata,uint64 validUntil,bytes calldata signature) external payable nonReentrant returns(uint256 id){
  require(reward>0&&slots>0&&slots<=20,"Invalid prizes");uint256 budget=reward*slots;
  uint256 beforeBalance=IAIToken(token).balanceOf(address(this));
  _tokenCall(token,abi.encodeCall(IAIToken.transferFrom,(msg.sender,address(this),budget)));
  require(IAIToken(token).balanceOf(address(this))==beforeBalance+budget,"Transfer tax unsupported");
  _tokenCall(token,abi.encodeCall(IAIToken.approve,(address(ledger),0)));
  _tokenCall(token,abi.encodeCall(IAIToken.approve,(address(ledger),budget)));
  require(msg.value==ledger.creationFee(2),"Incorrect creation fee");id=ledger.createTokenMission{value:msg.value}(ISupportMe.TokenMission(token,reward,slots,deadline,reviewWindow,0,1 days,false,0,0,2),metadata,validUntil,signature);
  organizers[id]=msg.sender;policyHashes[id]=keccak256(bytes(metadata));prizes[id]=slots;emit AIContestCreated(id,msg.sender,policyHashes[id]);
 }
 function createGatedContest(ISupportMe.TokenMission calldata f,string calldata metadata,bytes32 admissionHash,uint32 recoveryWindow,uint64 validUntil,bytes calldata signature) external payable nonReentrant returns(uint256 id){
  require(f.mode==0&&!f.protectedMode&&f.pythReserve==0&&f.executionReserve==0&&f.feeTier==2&&f.reward>0&&f.slots>0&&f.slots<=20,"Invalid AI contest");
  if(f.token!=address(0)){uint256 budget=f.reward*f.slots;uint256 beforeBalance=IAIToken(f.token).balanceOf(address(this));_tokenCall(f.token,abi.encodeCall(IAIToken.transferFrom,(msg.sender,address(this),budget)));require(IAIToken(f.token).balanceOf(address(this))==beforeBalance+budget,"Transfer tax unsupported");_tokenCall(f.token,abi.encodeCall(IAIToken.approve,(address(ledger),0)));_tokenCall(f.token,abi.encodeCall(IAIToken.approve,(address(ledger),budget)));}
  id=ledger.createGatedMission{value:msg.value}(f,metadata,admissionHash,false,recoveryWindow,validUntil,signature);organizers[id]=msg.sender;policyHashes[id]=keccak256(bytes(metadata));prizes[id]=f.slots;emit AIContestCreated(id,msg.sender,policyHashes[id]);
 }
 function _tokenCall(address token,bytes memory data) private { (bool ok,bytes memory result)=token.call(data);require(ok&&(result.length==0||(result.length==32&&abi.decode(result,(bool)))),"Token transfer failed"); }
 function sendTokenExact(address token,address recipient,uint256 amount) external {
  require(msg.sender==address(this),"Controller only");uint256 beforeRecipient=IAIToken(token).balanceOf(recipient);uint256 beforeController=IAIToken(token).balanceOf(address(this));
  _tokenCall(token,abi.encodeCall(IAIToken.transfer,(recipient,amount)));
  require(IAIToken(token).balanceOf(recipient)==beforeRecipient+amount&&IAIToken(token).balanceOf(address(this))+amount==beforeController,"Transfer tax unsupported");
 }
 function withdrawTokenCredit(address token,address recipient) external nonReentrant {
  require(recipient!=address(0)&&recipient!=address(this),"Invalid recipient");uint256 amount=tokenCredits[msg.sender][token];require(amount>0,"No credit");tokenCredits[msg.sender][token]=0;
  uint256 escrowAmount=escrowTokenCredits[msg.sender][token];escrowTokenCredits[msg.sender][token]=0;
  if(escrowAmount>0)ledger.withdrawTokenCreditAmount(token,recipient,escrowAmount);
  if(amount>escrowAmount)this.sendTokenExact(token,recipient,amount-escrowAmount);
 }
 function settleContest(uint256 id,uint256[] calldata winners,bytes32 resultHash,uint64 validUntil,bytes calldata signature) external nonReentrant {
  require(organizers[id]!=address(0)&&results[id]==bytes32(0)&&resultHash!=bytes32(0),"Unknown or settled contest");
  (address owner,uint256 reward,uint256 remaining,uint64 deadline,bool closed,)=ledger.missions(id);
  require(owner==address(this)&&!closed&&block.timestamp>=deadline&&block.timestamp<=validUntil,"Settlement unavailable");
  (,uint64 reviewDeadline,,,,)=ledger.policies(id);
  require(validUntil<=reviewDeadline,"Authorization exceeds review window");
  uint256[] memory entries=ledger.raffleEntries(id);require(winners.length<=prizes[id]&&winners.length<=entries.length,"Too many winners");
  bytes32 digest=keccak256(abi.encode(block.chainid,address(this),id,policyHashes[id],keccak256(abi.encode(entries)),keccak256(abi.encode(winners)),resultHash,validUntil));
  _verify(digest,signature);results[id]=resultHash;
  require(remaining>=reward*winners.length,"Budget mismatch");
  for(uint256 i;i<winners.length;i++){
   (uint256 missionId,address contributor,uint8 status,,)=ledger.contributions(winners[i]);
   require(missionId==id&&status==0&&contributor!=organizers[id],"Invalid winner");
   for(uint256 j;j<i;j++)require(winners[j]!=winners[i],"Duplicate winner");
   ledger.approveContribution(winners[i]);
  }
  for(uint256 i;i<entries.length;i++){
   (, ,uint8 status,,)=ledger.contributions(entries[i]);
   if(status==0)ledger.rejectContribution(entries[i],"AI: not selected.");
  }
  _refund(id);emit AIContestSettled(id,resultHash,keccak256(abi.encode(entries)),winners);
 }
 function cancelOrRefund(uint256 id) external nonReentrant {
  (,uint64 reviewDeadline,,,,)=ledger.policies(id);
  require(organizers[id]!=address(0)&&(msg.sender==organizers[id]||block.timestamp>reviewDeadline)&&results[id]==bytes32(0),"Organizer only or settled");
  // Escrow itself prevents refunds of pending work before the review deadline.
  _refund(id);
 }
 function _refund(uint256 id) private {
  (, ,uint256 remaining, , ,)=ledger.missions(id);
  address token=ledger.rewardToken(id);
  if(token!=address(0)){
   uint256 beforeTokenCredit=ledger.tokenCredits(address(this),token);ledger.closeMission(id);
   uint256 newTokenCredit=ledger.tokenCredits(address(this),token)-beforeTokenCredit;
   if(newTokenCredit>0){escrowTokenCredits[organizers[id]][token]+=newTokenCredit;tokenCredits[organizers[id]][token]+=newTokenCredit;}
   uint256 held=remaining-newTokenCredit;
   if(held>0){try this.sendTokenExact{gas:200000}(token,organizers[id],held){}catch{tokenCredits[organizers[id]][token]+=held;}}
   return;
  }
  uint256 beforeCredit=ledger.credits(address(this));
  ledger.closeMission(id);
  uint256 newCredit=ledger.credits(address(this))-beforeCredit;
  uint256 amount=remaining-newCredit;
  if(newCredit>0){ledger.withdrawCredit(payable(address(this)));amount+=newCredit;}
  if(amount>0){(bool ok,)=payable(organizers[id]).call{value:amount,gas:50000}("");if(!ok)credits[organizers[id]]+=amount;}
 }
 function withdrawCredit(address payable recipient) external nonReentrant {require(recipient!=address(0),"Invalid recipient");uint256 amount=credits[msg.sender];require(amount>0,"No credit");credits[msg.sender]=0;(bool ok,)=recipient.call{value:amount}("");require(ok,"Transfer failed");}
 function _verify(bytes32 digest,bytes calldata signature) private view {
  require(signature.length==65,"Invalid signature");bytes32 r;bytes32 s;uint8 v;
  assembly ("memory-safe") {r:=calldataload(signature.offset) s:=calldataload(add(signature.offset,32)) v:=byte(0,calldataload(add(signature.offset,64)))}
  require(uint256(s)<=0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0&&(v==27||v==28),"Invalid signature");
  require(ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",digest)),v,r,s)==verifier,"Invalid verification");
 }
 receive() external payable {require(msg.sender==address(ledger),"Escrow only");}
}
