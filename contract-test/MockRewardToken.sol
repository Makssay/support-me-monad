// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
contract MockRewardToken {
 string public name="QA reward token";string public symbol="QAR";uint8 public decimals=6;uint256 public totalSupply;
 mapping(address=>uint256) public balanceOf;mapping(address=>mapping(address=>uint256))public allowance;
 bool public taxed;bool public paused;bool public fail;bool public noReturn;
 function mint(address to,uint256 amount)external{balanceOf[to]+=amount;totalSupply+=amount;}
 function settings(bool t,bool p,bool f,bool n)external{taxed=t;paused=p;fail=f;noReturn=n;}
 function approve(address spender,uint256 amount)external returns(bool){allowance[msg.sender][spender]=amount;return true;}
 function transfer(address to,uint256 amount)external returns(bool){if(fail)return false;_transfer(msg.sender,to,amount);if(noReturn)assembly{return(0,0)}return true;}
 function transferFrom(address from,address to,uint256 amount)external returns(bool){if(fail)return false;require(allowance[from][msg.sender]>=amount,"Allowance");allowance[from][msg.sender]-=amount;_transfer(from,to,amount);if(noReturn)assembly{return(0,0)}return true;}
 function _transfer(address from,address to,uint256 amount)private{require(!paused&&balanceOf[from]>=amount,"Unavailable");balanceOf[from]-=amount;balanceOf[to]+=taxed?amount*99/100:amount;}
}


