pragma solidity ^0.4.2;

contract Owned
{
  address private owner = msg.sender;

  modifier onlyByOwner()
  {
    if (msg.sender != owner) {
      throw;
    }
    _;
  }

  function setOwner(address _newOwner) public
  onlyByOwner
  {
    if (_newOwner == address(0)) {
      throw;
    }
    owner = _newOwner;
  }
}
