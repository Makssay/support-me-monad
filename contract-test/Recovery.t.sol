// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "./SupportMe.t.sol";
contract RecoveryTest is SupportMeTest {
 function closed() internal view returns(bool){(,,,,bool done,)=s.missions(1);return done;}
 function finishRecovery() internal {for(uint256 i;i<80&&!closed();i++)s.recoverUnavailableDraw(1);check(closed());}
 function testMissingCallbackRefundsCreatorWithoutRewardingParticipants() public {
  make(SupportMeStorage.Mode.ReplyRaffle,1);enter(user,1,11);enter(other,2,12);vm.warp(block.timestamp+1 days);s.requestDraw{value:0.0001 ether}(1);
  vm.expectRevert(abi.encodeWithSelector(SupportMeStorage.InvalidParameters.selector));s.recoverUnavailableDraw(1);
  vm.warp(s.recoveryAt(1));s.recoverUnavailableDraw(1);check(closed()&&s.credits(user)==0&&s.credits(other)==0&&creator.balance==100 ether);
  e.fulfill(1,bytes32(uint256(42)));(,,,,bool ready,)=s.draws(1);check(!ready);
  check(address(s).balance==0);
  vm.expectRevert(abi.encodeWithSelector(SupportMeStorage.InvalidParameters.selector));s.recoverUnavailableDraw(1);
 }
 function testNoRequestNoFeeStillRecovers() public {
  protectedMission(SupportMeStorage.Mode.CreatorChoice,1);submit();vm.prank(other);s.submitContribution(1,"work");e.setFee(100 ether);
  vm.warp(s.recoveryAt(1));finishRecovery();check(s.credits(user)==0&&s.credits(other)==0&&creator.balance==100 ether);
 }
 function testLateSeedCannotPreventFixedRecovery() public {
  make(SupportMeStorage.Mode.ReplyRaffle,1);enter(user,1,11);vm.warp(block.timestamp+1 days);s.requestDraw{value:0.0001 ether}(1);
  vm.warp(s.recoveryAt(1));e.fulfill(1,bytes32(uint256(42)));(,,,,bool ready,)=s.draws(1);check(!ready);finishRecovery();check(s.credits(user)==0&&creator.balance==100 ether);
 }
 function testTimelySeedCannotBeReplacedByRecovery() public {
  make(SupportMeStorage.Mode.ReplyRaffle,1);enter(user,1,11);vm.warp(block.timestamp+1 days);s.requestDraw{value:0.0001 ether}(1);e.fulfill(1,bytes32(uint256(42)));
  vm.warp(s.recoveryAt(1));vm.expectRevert(abi.encodeWithSelector(SupportMeStorage.InvalidParameters.selector));s.recoverUnavailableDraw(1);s.settleDraw(1);check(closed()&&user.balance==2 ether);
 }
 function testMaximumEntrantsDrawBatchesStayBelowGasBudget() public {
  make(SupportMeStorage.Mode.ReplyRaffle,20);for(uint256 i;i<256;i++)enter(address(uint160(100+i)),100+i,1000+i);
  vm.warp(block.timestamp+1 days);s.requestDraw{value:0.0001 ether}(1);e.fulfill(1,bytes32(uint256(42)));
  uint256 batches;while(!closed()&&batches++<80){uint256 before=gasleft();s.settleDraw(1);check(before-gasleft()<4000000);}
  check(closed());uint256 accepted;for(uint256 i=1;i<=256;i++){(,,SupportMeStorage.Status status,uint256 paid,)=s.contributions(i);if(status==SupportMeStorage.Status.Accepted){accepted++;check(paid==1 ether);}else check(status==SupportMeStorage.Status.NotWinner);}check(accepted==20&&address(s).balance==0);
 }
 function testMaximumEntrantsRecoveryConservesEveryWei() public {
  make(SupportMeStorage.Mode.ReplyRaffle,1);for(uint256 i;i<256;i++)enter(address(uint160(100+i)),100+i,1000+i);
  vm.warp(s.recoveryAt(1));finishRecovery();uint256 sum;for(uint256 i;i<256;i++)sum+=s.credits(address(uint160(100+i)));check(sum==0&&address(s).balance==0&&creator.balance==100 ether);for(uint256 i=1;i<=256;i++){(,,SupportMeStorage.Status status,uint256 paid,)=s.contributions(i);check(status==SupportMeStorage.Status.NotWinner&&paid==0);}
 }
 function testLargePaidWorkSettlesInBatchesAndCannotBeRefunded() public {
  protectedMission(SupportMeStorage.Mode.PaidSlot,50);for(uint256 i;i<50;i++){address who=address(uint160(100+i));vm.prank(who);s.reserveSlot(1);vm.prank(who);s.submitContribution(1,"work");}
  vm.warp(block.timestamp+601);s.settleOverdueWork(1);check(!closed());vm.prank(creator);vm.expectRevert(abi.encodeWithSelector(SupportMeStorage.InvalidParameters.selector));s.closeMission(1);
  for(uint256 i;i<10&&!closed();i++)s.settleOverdueWork(1);check(closed());for(uint256 i;i<50;i++)check(address(uint160(100+i)).balance==1 ether&&s.activeWork(address(uint160(100+i)))==0);check(address(s).balance==0);
 }
 function testNoRefundBetweenDrawBatches() public {
  protectedMission(SupportMeStorage.Mode.CreatorChoice,20);for(uint256 i;i<40;i++){vm.prank(address(uint160(100+i)));s.submitContribution(1,"work");}
  vm.warp(block.timestamp+601);s.requestDraw(1);e.fulfill(1,bytes32(uint256(42)));s.settleDraw(1);vm.prank(creator);vm.expectRevert(abi.encodeWithSelector(SupportMeStorage.InvalidParameters.selector));s.closeMission(1);
  for(uint256 i;i<20&&!closed();i++)s.settleDraw(1);check(closed()&&address(s).balance==0);
 }
 function testEmptyRecoveryReturnsBudget() public {make(SupportMeStorage.Mode.ReplyRaffle,1);vm.warp(s.recoveryAt(1));finishRecovery();check(creator.balance==100 ether&&address(s).balance==0);}
 function testOracleRefundPreservesAlreadyApprovedRewards() public {
  protectedMission(SupportMeStorage.Mode.CreatorChoice,2);submit();vm.prank(other);s.submitContribution(1,"work");
  vm.prank(creator);s.approveContribution(1);vm.warp(s.recoveryAt(1));finishRecovery();
  check(user.balance==2 ether&&other.balance==1 ether&&creator.balance==99 ether&&address(s).balance==0);
  (,,SupportMeStorage.Status status,uint256 paid,)=s.contributions(2);check(status==SupportMeStorage.Status.NotWinner&&paid==0);
 }
}
