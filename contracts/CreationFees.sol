// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
/// Creation fees only. Holds no prize funds or automation reserves.
contract CreationFees {
 address public immutable treasury;
 mapping(address=>mapping(uint256=>uint8)) public tiers;
 mapping(address=>mapping(uint256=>uint256)) public paid;
 mapping(address=>bool) public exempt;
 mapping(address=>mapping(uint256=>bool)) public collected;
 event FeeExemptionChanged(address indexed wallet,bool enabled);
 event CreationFeePaid(address indexed escrow,uint256 indexed missionId,uint8 tier,uint256 amount);
 constructor(address treasury_){require(treasury_!=address(0));treasury=treasury_;}
 function quote(uint8 tier) public view returns(uint256){require(tier<3);uint256 scale=(block.chainid==10143||block.chainid==31337)?100:1;return (tier==0?20 ether:tier==1?50 ether:200 ether)/scale;}
 function setExempt(address wallet,bool enabled) external {require(msg.sender==treasury&&wallet!=address(0),"Treasury only");exempt[wallet]=enabled;emit FeeExemptionChanged(wallet,enabled);}
 function quoteFor(address wallet,uint8 tier) public view returns(uint256){uint256 amount=quote(tier);return exempt[wallet]?0:amount;}
 function collectFor(uint256 id,uint8 tier,address creator) external payable {_collect(id,tier,quoteFor(creator,tier));}
 function collect(uint256 id,uint8 tier) external payable {_collect(id,tier,quote(tier));}
 function _collect(uint256 id,uint8 tier,uint256 amount) private {require(!collected[msg.sender][id]&&msg.value==amount);collected[msg.sender][id]=true;tiers[msg.sender][id]=tier;paid[msg.sender][id]=msg.value;emit CreationFeePaid(msg.sender,id,tier,msg.value);}
 function withdraw(address payable recipient,uint256 amount) external {require(msg.sender==treasury&&recipient!=address(0));(bool ok,)=recipient.call{value:amount}("");require(ok);}
}
