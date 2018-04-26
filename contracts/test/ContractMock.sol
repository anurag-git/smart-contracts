pragma solidity 0.4.23;

import "../Confideal.sol";

contract ContractMock {
    bytes32 public resolutionHash;
    uint256 public clientAsset;
    uint256 public contractorAsset;

    Confideal private confideal;

    function ContractMock(
        Confideal _confideal
    )
    public
    {
        confideal = _confideal;
    }

    function resolveDispute(
        bytes32 _resolutionHash,
        uint256 _clientAsset,
        uint256 _contractorAsset
    )
    public
    {
        resolutionHash = _resolutionHash;
        clientAsset = _clientAsset;
        contractorAsset = _contractorAsset;
    }

    function withdrawArbiterPayment()
    public
    {
        uint256 arbitrationFee = confideal.calculateArbitrationFee(this);
        confideal.collectArbitrationFee.value(arbitrationFee)();
    }

    function pay()
    payable
    public
    {
    }
}