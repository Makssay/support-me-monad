// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "./CommunityGate.sol";
interface IEntropy { function getFeeV2() external view returns(uint256); function getDefaultProvider() external view returns(address); function requestV2() external payable returns(uint64); }
interface IRewardToken { function balanceOf(address) external view returns(uint256); function transfer(address,uint256) external returns(bool); function transferFrom(address,address,uint256) external returns(bool); }
/// @notice MON and verified ERC20 escrow. Social admission trusts the disclosed verifier; raffle selection uses Pyth. No admin withdrawal.
interface ICreationFees {function quote(uint8) external view returns(uint256);function collectFor(uint256,uint8,address) external payable;function quoteFor(address,uint8) external view returns(uint256);}
abstract contract SupportMeStorage {
 struct TokenMission {address token;uint256 reward;uint16 slots;uint64 deadline;uint32 reviewWindow;Mode mode;uint32 workWindow;bool protectedMode;uint256 pythReserve;uint256 executionReserve;uint8 feeTier;}

 CommunityGate public communityGate;
 address public creationFees;
 function creationFee(uint8 tier) public view returns(uint256){return creationFeeFor(msg.sender,tier);}
 function creationFeeFor(address creator,uint8 tier) public view returns(uint256){return creationFees==address(0)?0:ICreationFees(creationFees).quoteFor(creator,tier);}
 error InvalidParameters();
 enum Status { Pending, Accepted, Rejected, Proposed, Assigned, Expired, NotWinner }
 enum Mode { CreatorChoice, PaidSlot, Selected, BugBounty, ReplyRaffle, CommunityRaffle }
 struct Mission { address creator; uint256 reward; uint256 remaining; uint64 deadline; bool closed; string metadata; }
 struct Contribution { uint256 missionId; address contributor; Status status; uint256 paid; string metadata; }
 struct Reputation { uint256 submitted; uint256 accepted; uint256 earned; }
 struct Policy { Mode mode; uint64 reviewDeadline; uint32 workWindow; uint16 slots; uint16 reserved; uint16 pending; }
 struct Reservation { uint64 expires; bool active; }
 struct Draw { uint64 sequence; address provider; bytes32 seed; bool requested; bool ready; bool settled; }
 address public entropy; address public verifier;
 uint256 public missionCount; uint256 public contributionCount; uint256 internal entered;
 mapping(uint256=>Mission) public missions; mapping(uint256=>Contribution) public contributions; mapping(uint256=>Policy) public policies;
 mapping(uint256=>mapping(address=>bool)) public hasSubmitted; mapping(address=>Reputation) public reputation; mapping(address=>uint256) public credits;
 mapping(uint256=>mapping(address=>Reservation)) public reservations; mapping(address=>uint256) public activeWork;
 mapping(uint256=>uint64) public deliveryDeadline; mapping(uint256=>string) public rejectionReasons;
 mapping(uint256=>string) public proposalMetadata;
 mapping(uint256=>address[]) internal slotHolders; mapping(uint256=>mapping(address=>bool)) internal knownHolder;
 mapping(uint256=>mapping(bytes32=>uint256)) public rewardedBugs;
 mapping(uint256=>mapping(uint256=>bool)) public usedXUsers; mapping(uint256=>mapping(uint256=>bool)) public usedPosts;
 mapping(uint256=>uint256[]) internal entries; mapping(uint256=>bool) public randomReward; mapping(uint256=>uint256) public entryXUser; mapping(uint256=>uint256) public entryPost;
 struct Automation { bool enabled; uint256 pythReserve; uint256 executionReserve; }
 mapping(uint256=>Automation) public automation;
 mapping(uint256=>address) public rewardToken;
 mapping(address=>mapping(address=>uint256)) public tokenEarned;
 mapping(address=>mapping(address=>uint256)) public tokenCredits;
 event TokenMissionFunded(uint256 indexed missionId,address indexed token,uint256 amount);
 event TokenCreditWithdrawn(address indexed owner,address indexed token,address indexed recipient,uint256 amount);
 mapping(uint256=>Draw) public draws; mapping(uint64=>uint256) internal requestMission;
 // Every recovery deadline is fixed at creation, not chosen by an executor.
 uint256 public constant RECOVERY_DELAY=7 days;
 uint256 internal constant BATCH=8;
 struct Progress {uint256 scan;uint256 paid;uint256 cleanup;bool scanned;}
 mapping(uint256=>Progress) public drawProgress;
 mapping(uint256=>uint256[]) internal candidates;
 mapping(uint256=>uint256) public workCursor;
 mapping(uint256=>uint256) public holderCursor;
 struct Recovery {bool active;bool scanned;uint256 cursor;uint256 eligible;uint256 share;uint256 payoutCursor;}
 mapping(uint256=>Recovery) public recoveries;
 event RecoveryStarted(uint256 indexed missionId);
 event RecoveryCompleted(uint256 indexed missionId,uint256 eligible,uint256 share);
 function recoveryAt(uint256 id) public view returns(uint256){return uint256(policies[id].reviewDeadline)+RECOVERY_DELAY;}
 event MissionCreated(uint256 indexed missionId,uint256 reward,uint256 budget);
 event ContributionSubmitted(uint256 indexed contributionId,uint256 indexed missionId,address indexed contributor);
 event ContributionAccepted(uint256 indexed contributionId,uint256 indexed missionId,address indexed contributor,uint256 amount,bool transferred);
 event ContributionRejected(uint256 indexed contributionId); event MissionClosed(uint256 indexed missionId,uint256 refund,bool transferred);
 event SlotReserved(uint256 indexed missionId,address indexed contributor,uint64 expires); event SlotReleased(uint256 indexed missionId,address indexed contributor);
 event ContributorSelected(uint256 indexed contributionId,uint64 deliverBy);
 event DrawRequested(uint256 indexed missionId,uint64 sequence,bytes32 participantHash); event RandomnessReceived(uint256 indexed missionId,bytes32 seed); event DrawSettled(uint256 indexed missionId);
 event AutomationFunded(uint256 indexed missionId,uint256 pythReserve,uint256 executionReserve);
 event AutomationRefunded(uint256 indexed missionId,uint256 amount);
 event ExecutorReimbursed(uint256 indexed missionId,address indexed executor,uint256 amount);
 event CreditWithdrawn(address indexed owner,address indexed recipient,uint256 amount);
 modifier nonReentrant(){ require(entered==0,InvalidParameters()); entered=1; _; entered=0; }

 function _tokenCall(address token,bytes memory data) internal { (bool ok,bytes memory result)=token.call(data);require(ok&&(result.length==0||(result.length==32&&abi.decode(result,(bool))))); }
 function sendTokenExact(address token,address recipient,uint256 amount) external {
  require(msg.sender==address(this));
  uint256 beforeRecipient=IRewardToken(token).balanceOf(recipient);uint256 beforeEscrow=IRewardToken(token).balanceOf(address(this));
  _tokenCall(token,abi.encodeCall(IRewardToken.transfer,(recipient,amount)));
  require(IRewardToken(token).balanceOf(recipient)==beforeRecipient+amount&&IRewardToken(token).balanceOf(address(this))+amount==beforeEscrow);
 }
 function _payReward(uint256 id,address recipient,uint256 amount) internal returns(bool){
  address token=rewardToken[id];if(token==address(0))return _pay(recipient,amount);
  try this.sendTokenExact{gas:200000}(token,recipient,amount){return true;}catch{tokenCredits[recipient][token]+=amount;return false;}
 }
 function _reimburse(uint256 id,uint256 startGas) internal {
  Automation storage a=automation[id];if(!a.enabled)return;
  uint256 cost=(startGas-gasleft()+45000)*tx.gasprice;
  if(cost>0.15 ether)cost=0.15 ether;if(cost>a.executionReserve)cost=a.executionReserve;
  a.executionReserve-=cost;if(cost>0){_pay(msg.sender,cost);emit ExecutorReimbursed(id,msg.sender,cost);}
 }
 function _refundAutomation(uint256 id) internal {
  Automation storage a=automation[id];uint256 amount=a.pythReserve+a.executionReserve;a.pythReserve=0;a.executionReserve=0;
  if(amount>0){_pay(missions[id].creator,amount);emit AutomationRefunded(id,amount);}
 }
 function _reward(uint256 cid) internal {
  Contribution storage c=contributions[cid]; Mission storage m=missions[c.missionId]; c.status=Status.Accepted; c.paid=m.reward; m.remaining-=m.reward;
  reputation[c.contributor].accepted++; if(rewardToken[c.missionId]==address(0))reputation[c.contributor].earned+=m.reward;else tokenEarned[c.contributor][rewardToken[c.missionId]]+=m.reward; bool transferred=_payReward(c.missionId,c.contributor,m.reward); emit ContributionAccepted(cid,c.missionId,c.contributor,m.reward,transferred);
 }
 function _pay(address recipient,uint256 amount) internal returns(bool ok){(ok,)=payable(recipient).call{value:amount,gas:50000}("");if(!ok)credits[recipient]+=amount;}
}

