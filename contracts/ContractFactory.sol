pragma solidity 0.4.23;

import "./Contract.sol";

contract ContractFactory {
    string constant public version = "1.3.0";

    address public confideal;

    event ContractCreated(address contractAddress);

    function ContractFactory(address _confideal)
    public
    {
        confideal = _confideal;
    }

    function setConfideal(address _confideal)
    public
    {
        confideal = _confideal;
    }

    function createContract(
        bytes32 _dataHash,
        uint32 _creationTime,
        Contract.Party _party,
        address _counterparty,
        uint256 _price,
        uint256 _advancePaymentPct,
        uint32 _periodTo, //timestamp
        bool _arbitrationClause,
        uint256 _lateFeeRatePct,
        uint32 _lateFeeInterval,
        uint256 _lateFeeMaxPct,
        Contract.Party _confidealFeePayer
    )
    public
    {
        Contract _contract = new Contract(
            confideal,
            _dataHash,
            _creationTime,
            msg.sender,
            _party,
            _counterparty,
            _price,
            _advancePaymentPct,
            _periodTo,
            _arbitrationClause,
            _lateFeeRatePct,
            _lateFeeInterval,
            _lateFeeMaxPct,
            _confidealFeePayer
        );

        emit ContractCreated(_contract);
    }
}
