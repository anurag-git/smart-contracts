pragma solidity ^0.4.2;

import './Owned.sol';

contract Confideal is Owned {
  address public beneficiary = msg.sender;

  function setBeneficiary(address _beneficiary) public
  onlyByOwner()
  {
    beneficiary = _beneficiary;
  }

  function fee() public
  payable
  {
  }

  function withdraw() public
  returns (bool success)
  {
    if (msg.sender != beneficiary) {
      throw;
    }
    return beneficiary.call.value(this.balance)();
  }

  function ()
  {
    throw;
  }
}
