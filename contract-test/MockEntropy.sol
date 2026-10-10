// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
interface Consumer { function _entropyCallback(uint64,address,bytes32) external; }
/// @notice Test-only deterministic transport. Never deployed as production Entropy.
contract MockEntropy {
 uint256 public fee=0.0001 ether;function setFee(uint256 value)external{fee=value;}
 uint64 public sequence; mapping(uint64=>address) public consumers;
 function getFeeV2() external view returns(uint256){return fee;}
 function getDefaultProvider() external pure returns(address){return address(0x123);}
 function requestV2() external payable returns(uint64){require(msg.value==fee);consumers[++sequence]=msg.sender;return sequence;}
 function fulfill(uint64 seq,bytes32 seed) external {Consumer(consumers[seq])._entropyCallback(seq,address(0x123),seed);}
}


