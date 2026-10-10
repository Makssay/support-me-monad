// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "./TokenRewards.t.sol";
import "../contracts/CreationFees.sol";
interface FeeVm {function chainId(uint256)external;}
contract CreationFeesTest {

 Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));SupportMe s;MockEntropy e;address creator=address(0xA);address user=address(0xB);address other=address(0xC);uint256 pk=123456;
 function baseSetup()internal{e=new MockEntropy();s=new SupportMe(address(e),vm.addr(pk),address(0));vm.deal(address(this),100 ether);vm.deal(creator,100 ether);vm.deal(user,1 ether);vm.deal(other,1 ether);}
 function check(bool b)internal pure{require(b,"Assertion failed");}
 function make(SupportMeStorage.Mode mode,uint256 slots)internal{vm.prank(creator);s.createMissionPaid{value:slots*1 ether}(1 ether,uint64(block.timestamp+1 days),1 days,mode,1 hours,"brief",0);}
 function submit()internal{vm.prank(user);s.submitContribution(1,"work");}
 function signature(uint256 id,address who,uint256 x,uint256 post,uint64 end)internal returns(bytes memory){bytes32 digest=keccak256(abi.encode(block.chainid,address(s),id,who,x,post,end));(uint8 v,bytes32 r,bytes32 ss)=vm.sign(pk,keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",digest)));return abi.encodePacked(r,ss,v);}
 function enter(address who,uint256 x,uint256 post)internal{uint64 end=uint64(block.timestamp+1 hours);bytes memory sig=signature(1,who,x,post,end);vm.prank(who);s.submitReply(1,"reply",x,post,end,sig);}


 MockRewardToken token;uint64 expiry;
 function permitToken(address target)internal returns(bytes memory){bytes32 d=keccak256(abi.encode("Support Me reward token",block.chainid,address(s),target,expiry));(uint8 v,bytes32 r,bytes32 ss)=vm.sign(pk,keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",d)));return abi.encodePacked(r,ss,v);}

 CreationFees fees;address treasury=address(0xFEE);
 function setUp()public {baseSetup();token=new MockRewardToken();token.mint(creator,100000000);expiry=uint64(block.timestamp+1 days);fees=new CreationFees(treasury);s=new SupportMe(address(e),vm.addr(pk),address(fees));}
 function testDiscountAndMainnetPrices()public{check(fees.quote(0)==0.2 ether&&fees.quote(1)==0.5 ether&&fees.quote(2)==2 ether);FeeVm(address(vm)).chainId(143);check(fees.quote(0)==20 ether&&fees.quote(1)==50 ether&&fees.quote(2)==200 ether);}
 function testNativeFeeSeparateFromPrizeAndRefund()public{vm.prank(creator);s.createMissionPaid{value:2.2 ether}(1 ether,uint64(block.timestamp+1 hours),300,SupportMeStorage.Mode.CreatorChoice,300,"brief",0);check(address(fees).balance==0.2 ether&&address(s).balance==2 ether);submit();vm.prank(creator);s.approveContribution(1);vm.prank(creator);s.closeMission(1);check(address(s).balance==0&&address(fees).balance==0.2 ether&&creator.balance==98.8 ether&&user.balance==2 ether);}
 function testProtectedFeeSeparateFromReserves()public{vm.prank(creator);s.createMissionV3{value:1.8002 ether}(1 ether,1,uint64(block.timestamp+1 hours),300,SupportMeStorage.Mode.CreatorChoice,300,"brief",0.0002 ether,0.3 ether,1);check(fees.paid(address(s),1)==0.5 ether&&fees.tiers(address(s),1)==1&&address(s).balance==1.3002 ether);vm.warp(block.timestamp+4000);s.closeMission(1);check(address(fees).balance==0.5 ether&&address(s).balance==0);}
 function testIncorrectNativeFundingCannotChargeFee()public{vm.prank(creator);vm.expectRevert(abi.encodeWithSelector(SupportMeStorage.InvalidParameters.selector));s.createMissionPaid{value:1 ether}(1 ether,uint64(block.timestamp+1 hours),300,SupportMeStorage.Mode.CreatorChoice,300,"brief",1);check(s.missionCount()==0&&address(fees).balance==0);}
 function testFeeAtomicWithTokenFundingFailure()public{bytes memory sig=permitToken(address(token));vm.prank(creator);vm.expectRevert(bytes(""));s.createTokenMission{value:0.2 ether}(SupportMeStorage.TokenMission(address(token),1000000,1,uint64(block.timestamp+1 hours),300,SupportMeStorage.Mode.CreatorChoice,300,false,0,0,0),"brief",expiry,sig);check(address(fees).balance==0&&s.missionCount()==0&&fees.paid(address(s),1)==0);}
 function testTokenFeeOnlyUsesMon()public{bytes memory sig=permitToken(address(token));vm.prank(creator);token.approve(address(s),2000000);vm.prank(creator);s.createTokenMission{value:0.5 ether}(SupportMeStorage.TokenMission(address(token),1000000,2,uint64(block.timestamp+1 hours),300,SupportMeStorage.Mode.CreatorChoice,300,false,0,0,1),"brief",expiry,sig);check(address(fees).balance==0.5 ether&&address(s).balance==0&&token.balanceOf(address(s))==2000000);submit();vm.prank(creator);s.approveContribution(1);vm.prank(creator);s.closeMission(1);check(token.balanceOf(user)==1000000&&token.balanceOf(creator)==99000000&&address(fees).balance==0.5 ether);}
 function testAIContestFeeAndPrizeCount()public{AIContestController a=new AIContestController(address(s),vm.addr(pk));vm.prank(creator);a.createContest{value:4 ether}(1 ether,uint64(block.timestamp+1 hours),300,"brief");check(a.prizes(1)==2&&address(fees).balance==2 ether&&address(s).balance==2 ether);vm.prank(creator);a.cancelOrRefund(1);check(creator.balance==98 ether&&address(fees).balance==2 ether&&address(s).balance==0);}
 function testTokenAIContestFee()public{AIContestController a=new AIContestController(address(s),vm.addr(pk));bytes memory sig=permitToken(address(token));vm.prank(creator);token.approve(address(a),2000000);vm.prank(creator);a.createTokenContest{value:2 ether}(address(token),1000000,2,uint64(block.timestamp+1 hours),300,"AI brief",expiry,sig);check(fees.tiers(address(s),1)==2&&address(fees).balance==2 ether&&token.balanceOf(address(s))==2000000);vm.prank(creator);a.cancelOrRefund(1);check(token.balanceOf(creator)==100000000&&address(fees).balance==2 ether);}
 function testFeesCannotBeWithdrawnByParticipant()public{vm.prank(user);vm.expectRevert(bytes(""));fees.withdraw(payable(user),0);}
 function testTreasuryOnlyWithdrawsItsFees()public{vm.prank(creator);s.createMissionPaid{value:1.2 ether}(1 ether,uint64(block.timestamp+1 hours),300,SupportMeStorage.Mode.CreatorChoice,300,"brief",0);vm.prank(treasury);fees.withdraw(payable(treasury),0.2 ether);check(treasury.balance==0.2 ether&&address(s).balance==1 ether);}
}


