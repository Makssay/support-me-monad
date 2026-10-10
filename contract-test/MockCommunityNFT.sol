// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
contract MockCommunityNFT {
 mapping(address=>uint256) public balanceOf;mapping(uint256=>address) public ownerOf;
 event Transfer(address indexed from,address indexed to,uint256 indexed tokenId);
 function supportsInterface(bytes4 id)external pure returns(bool){return id==0x80ac58cd||id==0x01ffc9a7;}
 function mint(address to,uint256 id)external{require(ownerOf[id]==address(0));ownerOf[id]=to;balanceOf[to]++;emit Transfer(address(0),to,id);}
 function transferFrom(address from,address to,uint256 id)external{require(msg.sender==from&&ownerOf[id]==from);ownerOf[id]=to;balanceOf[from]--;balanceOf[to]++;emit Transfer(from,to,id);}
}


