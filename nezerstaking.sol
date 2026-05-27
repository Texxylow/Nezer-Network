// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import
"@openzeppelin/contracts/token/ERC20/IERC20.sol";

import
"@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract Staking{

using SafeERC20
for IERC20;


IERC20 public token;

uint public totalStaked;

uint public rewardRate=20;


mapping(
address=>uint
)

public staked;


mapping(
address=>uint
)

public rewards;



constructor(
address _token
){

token=
IERC20(
_token
);

}



function fundRewards(
uint amount
)

external{

token
.safeTransferFrom(

msg.sender,

address(this),

amount

);

}



function stake(
uint amount
)

external{

require(
amount>0,
"invalid"
);


token.safeTransferFrom(

msg.sender,

address(this),

amount

);


staked[msg.sender]
+=amount;


totalStaked
+=amount;


rewards[msg.sender]
+=
amount*
rewardRate/
100;

}



function unstake(
uint amount
)

external{

require(

staked[msg.sender]
>=amount,

"low balance"

);


staked[msg.sender]
-=amount;


totalStaked
-=amount;


token.safeTransfer(

msg.sender,

amount

);

}



function claimReward()

external{

uint reward=
rewards[msg.sender];


require(
reward>0,
"none"
);


rewards[msg.sender]
=0;


token.safeTransfer(

msg.sender,

reward

);

}

}