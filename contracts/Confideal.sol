pragma solidity 0.4.23;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/ReentrancyGuard.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./Contract.sol";

contract Confideal is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    event FeePayment(address deal, uint256 amount);
    event ArbitrationFeePayment(address deal, address arbiter, uint256 amount, uint256 confidealFee);

    address public beneficiary = msg.sender;
    uint256 public arbitrationFeeRate = 0.10 ether;
    uint256 public minArbitrationFee = 0.30 ether;
    uint256 public confidealArbitrationFeeRate = 0.30 ether;
    uint32 public appealWindow = 864000; // 10 days in seconds
    uint8 public appealsLimit = 1;

    uint256 public confidealFees;

    mapping(address => address) public arbiters;
    mapping(address => uint256) public arbiterFees;

    function setBeneficiary(address _beneficiary)
    public
    onlyOwner
    {
        beneficiary = _beneficiary;
    }

    function fee()
    public
    payable
    {
        confidealFees = confidealFees.add(msg.value);
        emit FeePayment(msg.sender, msg.value);
    }

    function calculateArbitrationFee(address deal)
    public
    view
    returns (uint256)
    {
        return deal.balance.mul(arbitrationFeeRate).div(1 ether);
    }

    function resolveDispute(
        address deal,
        bytes32 resolutionHash,
        uint256 clientShare,
        uint256 contractorShare
    )
    public
    {
        require(msg.sender == arbiters[deal]);
        Contract(deal).resolveDispute(resolutionHash, clientShare, contractorShare);
    }

    function setArbiter(
        address deal,
        address arbiter
    )
    public
    onlyOwner
    {
        arbiters[deal] = arbiter;
    }

    function setMinArbitrationFee(uint256 fee_)
    public
    onlyOwner
    {
        minArbitrationFee = fee_;
    }

    function setConfidealArbitrationFee(uint256 feeRate)
    public
    onlyOwner
    {
        confidealArbitrationFeeRate = feeRate;
    }

    function setAppealWindow(uint32 timeout)
    public
    onlyOwner
    {
        appealWindow = timeout;
    }

    function setAppealsLimit(uint8 limit)
    public
    onlyOwner
    {
        appealsLimit = limit;
    }

    function collectArbitrationFee()
    public
    payable
    {
        uint256 arbitrationFee = calculateArbitrationFee(msg.sender);
        uint256 payment = msg.value;
        require(payment.mul(uint256(1 ether).sub(arbitrationFeeRate)).div(1 ether) == arbitrationFee);

        address arbiter = arbiters[msg.sender];
        require(arbiter != address(0));

        uint256 confidealFee = payment.mul(confidealArbitrationFeeRate).div(1 ether);
        uint256 reward = payment.sub(confidealFee);
        arbiterFees[arbiter] = arbiterFees[arbiter].add(reward);
        confidealFees = confidealFees.add(confidealFee);
        emit ArbitrationFeePayment(msg.sender, arbiter, payment, confidealFee);
    }

    function withdrawArbitrationFee(address deal)
    public
    {
        require(msg.sender == arbiters[deal]);
        Contract(deal).withdrawArbiterPayment();
    }

    function withdrawArbitrationRewards()
    public
    nonReentrant
    {
        uint256 amount = arbiterFees[msg.sender];
        require(amount > 0);

        arbiterFees[msg.sender] = 0;
        require(msg.sender.call.value(amount)());
    }

    function withdraw()
    public
    {
        require(msg.sender == beneficiary);

        uint256 amount = confidealFees;
        require(amount > 0);

        confidealFees = 0;
        require(beneficiary.call.value(amount)());
    }

    function()
    public
    {
        revert();
    }
}
