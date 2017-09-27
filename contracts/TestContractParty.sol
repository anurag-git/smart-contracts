pragma solidity ^0.4.2;


import './Contract.sol';


contract TestContractParty
{
    function sign(Contract _contract)
    {
        _contract.sign();
    }

    function pay(Contract _contract)
    payable
    {
        _contract.pay.value(msg.value)();
    }

    function terminate(Contract _contract, uint256 _refundPct)
    {
        _contract.terminate(_refundPct);
    }

    function closeOut(Contract _contract, uint32 _closeoutTime)
    {
        _contract.closeOut(_closeoutTime);
    }

    function withdrawDownPayment(Contract _contract)
    {
        _contract.withdrawDownPayment();
    }

    function withdrawTerminationRefund(Contract _contract)
    {
        _contract.withdrawTerminationRefund();
    }

    function withdrawLateFee(Contract _contract)
    {
        _contract.withdrawLateFee();
    }

    function withdrawCloseoutPayment(Contract _contract)
    {
        _contract.withdrawCloseoutPayment();
    }

    function()
    payable
    {
        for (uint i; i < 100; i++) {}
    }
}
