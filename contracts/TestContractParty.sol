pragma solidity 0.4.23;


import "./Contract.sol";


contract TestContractParty
{
    function sign(Contract _contract)
    public
    {
        _contract.sign();
    }

    function pay(Contract _contract)
    payable
    public
    {
        _contract.pay.value(msg.value)();
    }

    function terminate(Contract _contract, uint256 _refundPct)
    public
    {
        _contract.terminate(_refundPct);
    }

    function closeOut(Contract _contract, uint32 _closeoutTime)
    public
    {
        _contract.closeOut(_closeoutTime);
    }

    function withdrawAdvancePayment(Contract _contract)
    public
    {
        _contract.withdrawAdvancePayment();
    }

    function withdrawTerminationRefund(Contract _contract)
    public
    {
        _contract.withdrawTerminationRefund();
    }

    function withdrawLateFee(Contract _contract)
    public
    {
        _contract.withdrawLateFee();
    }

    function withdrawCloseoutPayment(Contract _contract)
    public
    {
        _contract.withdrawCloseoutPayment();
    }

    function()
    payable
    public
    {
        for (uint i; i < 100; i++) {}
    }
}
