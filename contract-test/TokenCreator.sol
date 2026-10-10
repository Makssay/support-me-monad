// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "../contracts/SupportMe.sol";
import "./MockRewardToken.sol";
/// Synthetic QA creator/token only. Never admitted by the public nad.fun lookup.
contract TokenCreator is MockRewardToken {
 SupportMe public ledger;address public owner;
 constructor(address l){ledger=SupportMe(l);owner=msg.sender;}
 function create(uint64 expiry,bytes calldata signature)external payable{require(msg.sender==owner);this.mint(address(this),2246912);this.approve(address(ledger),2246912);ledger.createTokenMission{value:msg.value}(SupportMeStorage.TokenMission(address(this),1123456,2,uint64(block.timestamp+3600),300,SupportMeStorage.Mode.CreatorChoice,300,false,0,0,0),'{"title":"Synthetic QA: token escrow","category":"Memes","creatorName":"Protocol QA","description":"Synthetic token protocol validation, not a user mission.","requirements":"Test only"}',expiry,signature);}
 function finish(uint256 mission,uint256 contribution)external{require(msg.sender==owner);ledger.approveContribution(contribution);ledger.closeMission(mission);}
}


