// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "../contracts/SupportMe.sol";
import "../contracts/AIContestController.sol";
import "./MockEntropy.sol";
interface AIVm {function deal(address,uint256)external;function prank(address)external;function expectRevert(bytes calldata)external;function warp(uint256)external;function addr(uint256)external returns(address);function sign(uint256,bytes32)external returns(uint8,bytes32,bytes32);}
contract AIRejectOrganizer {
 AIContestController a;constructor(AIContestController controller){a=controller;}
 function create(uint64 end)external payable returns(uint256){return a.createContest{value:msg.value}(1 ether,end,1 days,"brief");}
 function close(uint256 id)external{a.cancelOrRefund(id);}
 function withdraw(address payable recipient)external{a.withdrawCredit(recipient);}
 receive()external payable{revert();}
}
contract AIContestTest {
 AIVm constant vm=AIVm(address(uint160(uint256(keccak256("hevm cheat code")))));SupportMe s;AIContestController a;address creator=address(10);address user=address(11);address other=address(12);uint256 pk=9876;uint64 end;
 function setUp()public{s=new SupportMe(address(new MockEntropy()),vm.addr(pk),address(0));a=new AIContestController(address(s),vm.addr(pk));vm.deal(creator,100 ether);vm.deal(user,1 ether);vm.deal(other,1 ether);end=uint64(block.timestamp+1 days);vm.prank(creator);a.createContest{value:2 ether}(1 ether,end,1 days,"frozen brief");vm.prank(user);s.submitContribution(1,"good work");vm.prank(other);s.submitContribution(1,"other work");}
 function winners()internal pure returns(uint256[]memory w){w=new uint256[](1);w[0]=1;}
 function sig(uint256[]memory w,bytes32 result,uint64 until)internal returns(bytes memory){bytes32 d=keccak256(abi.encode(block.chainid,address(a),uint256(1),a.policyHashes(1),keccak256(abi.encode(s.raffleEntries(1))),keccak256(abi.encode(w)),result,until));(uint8 v,bytes32 r,bytes32 ss)=vm.sign(pk,keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",d)));return abi.encodePacked(r,ss,v);}
 function testCreatorCannotOverrideOrRefundPending()public{vm.prank(creator);vm.expectRevert(bytes("Creator only"));s.approveContribution(1);vm.prank(creator);vm.expectRevert(bytes("Creator only"));s.rejectContribution(1,"I want my own winner");vm.prank(creator);vm.expectRevert(abi.encodeWithSelector(SupportMeStorage.InvalidParameters.selector));a.cancelOrRefund(1);}
 function testSignedSettlementPaysAndRefundsNoReplay()public{uint256[]memory w=winners();bytes32 result=keccak256("ranking");bytes memory signature=sig(w,result,end+1 days);vm.warp(end);a.settleContest(1,w,result,end+1 days,signature);require(user.balance==2 ether&&creator.balance==99 ether&&address(s).balance==0,"Conservation");(,SupportMeStorage.Status st,,)=status(2);require(st==SupportMeStorage.Status.Rejected);vm.expectRevert(bytes("Unknown or settled contest"));a.settleContest(1,w,result,end+1 days,signature);}
 function status(uint256 id)internal view returns(uint256,SupportMeStorage.Status,uint256,string memory){(uint256 mission,,SupportMeStorage.Status st,uint256 paid,string memory text)=s.contributions(id);return(mission,st,paid,text);}
 function testCannotSettleBeforeDeadline()public{uint256[]memory w=winners();bytes memory signature=sig(w,keccak256("ranking"),end+1 days);vm.expectRevert(bytes("Settlement unavailable"));a.settleContest(1,w,keccak256("ranking"),end+1 days,signature);}
 function testWinnersBoundToSignature()public{uint256[]memory w=winners();bytes memory signature=sig(w,keccak256("ranking"),end+1 days);w[0]=2;vm.warp(end);vm.expectRevert(bytes("Invalid verification"));a.settleContest(1,w,keccak256("ranking"),end+1 days,signature);}
 function testEntryListBoundToSignature()public{uint256[]memory w=winners();bytes memory signature=sig(w,keccak256("ranking"),end+1 days);vm.prank(address(15));s.submitContribution(1,"late work");vm.warp(end);vm.expectRevert(bytes("Invalid verification"));a.settleContest(1,w,keccak256("ranking"),end+1 days,signature);}
 function testDuplicateWinnerRevertsAtomically()public{uint256[]memory w=new uint256[](2);w[0]=1;w[1]=1;bytes memory signature=sig(w,keccak256("ranking"),end+1 days);vm.warp(end);vm.expectRevert(bytes("Invalid winner"));a.settleContest(1,w,keccak256("ranking"),end+1 days,signature);require(user.balance==1 ether&&a.results(1)==bytes32(0));}
 function testOrganizerCannotWin()public{vm.prank(creator);s.submitContribution(1,"own work");uint256[]memory w=winners();w[0]=3;bytes memory signature=sig(w,keccak256("ranking"),end+1 days);vm.warp(end);vm.expectRevert(bytes("Invalid winner"));a.settleContest(1,w,keccak256("ranking"),end+1 days,signature);}
 function testNoEligibleWinnersRefundsAll()public{uint256[]memory w=new uint256[](0);bytes memory signature=sig(w,keccak256("ranking"),end+1 days);vm.warp(end);a.settleContest(1,w,keccak256("ranking"),end+1 days,signature);require(creator.balance==100 ether&&address(s).balance==0);}
 function testServiceFailureRefundAfterReviewTimeout()public{vm.warp(end+1 days+1);vm.prank(creator);a.cancelOrRefund(1);require(creator.balance==100 ether&&address(s).balance==0);}
 function testAuthorizationCannotOutlivePolicy()public{uint256[]memory w=winners();bytes memory signature=sig(w,keccak256("ranking"),end+2 days);vm.warp(end);vm.expectRevert(bytes("Authorization exceeds review window"));a.settleContest(1,w,keccak256("ranking"),end+2 days,signature);}
 function testMaximumEntryListSettlesWithinBoundedGas()public{for(uint256 i=2;i<256;i++){vm.prank(address(uint160(1000+i)));s.submitContribution(1,"work");}uint256[]memory w=winners();bytes memory signature=sig(w,keccak256("ranking"),end+1 days);vm.warp(end);uint256 beforeGas=gasleft();a.settleContest(1,w,keccak256("ranking"),end+1 days,signature);require(beforeGas-gasleft()<25000000,"Settlement gas excessive");require(user.balance==2 ether&&address(s).balance==0);}
 function testOrganizerRefundFailureRemainsClaimable()public{AIRejectOrganizer r=new AIRejectOrganizer(a);vm.deal(address(this),1 ether);uint256 id=r.create{value:1 ether}(end);r.close(id);require(a.credits(address(r))==1 ether&&address(s).balance==2 ether);r.withdraw(payable(user));require(a.credits(address(r))==0&&user.balance==2 ether);vm.expectRevert(bytes("No credit"));r.withdraw(payable(user));}
 function testAnyoneCanRefundAfterAIServiceTimeout()public{vm.warp(end+1 days+1);vm.prank(other);a.cancelOrRefund(1);require(creator.balance==100 ether&&address(s).balance==0);}
}


