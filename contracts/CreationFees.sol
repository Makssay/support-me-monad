// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
/// Creation fees only. Holds no prize funds or automation reserves.
contract CreationFees {
 address public immutable treasury;
 mapping(address=>mapping(uint256=>uint8)) public tiers;
 mapping(address=>mapping(uint256=>uint256)) public paid;
 event CreationFeePaid(address indexed escrow,uint256 indexed missionId,uint8 tier,uint256 amount);
 constructor(address treasury_){require(treasury_!=address(0));treasury=treasury_;}
 function quote(uint8 tier) public view returns(uint256){require(tier<3);uint256 scale=(block.chainid==10143||block.chainid==31337)?100:1;return (tier==0?20 ether:tier==1?50 ether:200 ether)/scale;}
 function collect(uint256 id,uint8 tier) external payable {require(paid[msg.sender][id]==0&&msg.value==quote(tier));tiers[msg.sender][id]=tier;paid[msg.sender][id]=msg.value;emit CreationFeePaid(msg.sender,id,tier,msg.value);}
 function withdraw(address payable recipient,uint256 amount) external {require(msg.sender==treasury&&recipient!=address(0));(bool ok,)=recipient.call{value:amount}("");require(ok);}
}
