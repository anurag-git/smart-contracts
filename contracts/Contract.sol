pragma solidity 0.4.23;

import "zeppelin-solidity/contracts/ReentrancyGuard.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./Confideal.sol";

contract Contract is ReentrancyGuard {
    using SafeMath for uint256;

    string constant public version = "1.3.0";

    event Destroy();
    event Sign();
    event Pay();
    event AdvancePaymentWithdrawal();
    event CloseoutProposition();
    event Closeout();
    event LateFeeWithdrawal();
    event CloseoutPaymentWithdrawal();
    event TerminationProposition();
    event Terminate();
    event TerminationRefundWithdrawal();
    event TerminationPaymentWithdrawal();
    event Arbitration();
    event DisputeResolution();
    event ClientAssetWithdrawal();
    event ContractorAssetWithdrawal();
    event ArbiterPaymentWithdrawal();

    enum Stage {
        ToBeSigned,
        Signed,
        Running,
        CloseoutProposed,
        ClosedOut,
        Terminated,
        TerminationProposed,
        Arbitration,
        Resolved
    }

    enum Party {
        Client,
        Contractor
    }

    Stage public stage = Stage.ToBeSigned;
    uint32 public stageTime = uint32(now);

    address public creator;
    uint32 public creationTime; // timestamp
    uint32 public blockchainCreationTime = uint32(now);

    address public client;
    address public contractor;

    bytes32 public dataHash;

    uint256 public price; // in weis
    uint256 public confidealFee; // in weis
    uint256 public total; // in weis
    uint256 public advancePaymentRate; // in weis
    uint256 public terminationRefundClientRate; // in weis
    uint256 public terminationRefundContractorRate; // in weis

    bool public hasClientTerminationProposition;
    bool public hasContractorTerminationProposition;

    uint32 public periodFrom; // timestamp
    uint32 public periodTo; // timestamp
    uint32 public closeoutTimeClient; // timestamp
    uint32 public closeoutTimeContractor; // timestamp

    uint256 public lateFeeRate; // in weis
    uint32 public lateFeeInterval;
    uint256 public lateFeeMaxRate; // in weis

    uint256 public advancePayment; // in weis
    bool public advancePaymentSent = false;

    uint256 public terminationRefund; // in weis
    bool public terminationRefundSent = false;
    uint256 public terminationPayment; // in weis
    bool public terminationPaymentSent = false;

    uint256 public closeoutPayment; // in weis
    bool public closeoutPaymentSent = false;

    uint256 public lateFee; // in weis
    bool public lateFeeSent = false;

    Party public confidealFeePayer;

    bool public arbitrationClause = true;
    bytes32 public resolutionHash;
    uint256 public clientAsset;
    uint256 public contractorAsset;
    uint256 public arbitrationFee;
    uint32 public appealWindow;
    uint8 public appealsAvailable;
    bool public arbitrationFeeSent = false;
    bool public clientAssetSent = false;
    bool public contractorAssetSent = false;

    Confideal private confideal;

    modifier atStage(Stage _stage)
    {
        require(stage == _stage);
        _;
    }

    modifier whenAppealWindowIsClosed()
    {
        require(stage == Stage.Resolved);
        require(now - stageTime >= appealWindow);
        _;
    }

    function Contract(
        address _confideal,
        bytes32 _dataHash,
        uint32 _creationTime,
        address _creator,
        Party _party,
        address _counterparty,
        uint256 _price,
        uint256 _advancePaymentRate,
        uint32 _periodTo, //timestamp
        bool _arbitrationClause,

        uint256 _lateFeeRate,
        uint32 _lateFeeInterval,
        uint256 _lateFeeMaxRate,
        Party _confidealFeePayer
    )
    public
    {
        require(_counterparty != _creator);

        blockchainCreationTime = uint32(now);

        checkRate(_advancePaymentRate);
        checkRate(_lateFeeRate);
        checkRate(_lateFeeMaxRate);

        confideal = Confideal(_confideal);

        dataHash = _dataHash;
        creationTime = _creationTime;
        creator = _creator;
        client = _party == Party.Client ? _creator : _counterparty;
        contractor = _party == Party.Contractor ? _creator : _counterparty;
        price = _price;
        advancePaymentRate = _advancePaymentRate;
        periodTo = _periodTo;

        confidealFeePayer = _confidealFeePayer;

        advancePayment = _price.mul(_advancePaymentRate).div(1 ether);
        confidealFee = _price.div(100);
        if (_confidealFeePayer == Party.Client) {
            total = _price.add(confidealFee);
        } else {
            total = _price;
            if (advancePayment < confidealFee) {
                advancePayment = 0;
            } else {
                advancePayment = advancePayment.sub(confidealFee);
            }
        }

        if (_lateFeeRate > 0) {
            require(_lateFeeMaxRate.add(_advancePaymentRate) <= 1 ether);
            require(_confidealFeePayer == Party.Client || _lateFeeMaxRate <= uint256(1 ether).sub(confidealFee.mul(1 ether).div(_price)));

            lateFeeRate = _lateFeeRate;
            lateFeeInterval = _lateFeeInterval;
            lateFeeMaxRate = _lateFeeMaxRate;
        }

        arbitrationClause = _arbitrationClause;
        if (arbitrationClause) {
            require(total.sub(confidealFee).sub(advancePayment) > confideal.minArbitrationFee());

            appealWindow = confideal.appealWindow();
            appealsAvailable = confideal.appealsLimit();
        }
    }

    function destroy()
    public
    atStage(Stage.ToBeSigned)
    {
        require(msg.sender == creator);

        emit Destroy();
        selfdestruct(creator);
    }

    function sign()
    public
    atStage(Stage.ToBeSigned)
    {
        require(msg.sender == contractor && msg.sender != creator);

        emit Sign();
        stage = Stage.Signed;
        stageTime = uint32(now);
    }

    function pay()
    public
    payable
    nonReentrant
    {
        if (msg.sender == creator) {
            require(stage == Stage.Signed);
        } else {
            require(stage == Stage.ToBeSigned);
        }
        require(msg.sender == client);
        require(msg.value == total);

        emit Pay();
        stage = Stage.Running;
        stageTime = uint32(now);
        periodFrom = uint32(now);

        confideal.fee.value(confidealFee)();

        if (advancePayment > 0) {
            advancePaymentSent = contractor.send(advancePayment);
        }
    }

    function withdrawAdvancePayment()
    public
    nonReentrant
    {
        require(msg.sender == contractor);
        require(stage == Stage.Running || stage == Stage.Terminated || stage == Stage.ClosedOut);
        require(advancePayment > 0 && !advancePaymentSent);

        advancePaymentSent = transferFunds(contractor, advancePayment);
        if (advancePaymentSent) {
            emit AdvancePaymentWithdrawal();
        }
    }

    function terminate(uint256 _refundRate)
    public
    nonReentrant
    {
        require(stage == Stage.Running || stage == Stage.TerminationProposed);
        require(msg.sender == client || msg.sender == contractor);

        checkRate(_refundRate);

        if (msg.sender == client) {
            if (!hasClientTerminationProposition || terminationRefundClientRate != _refundRate) {
                hasClientTerminationProposition = true;
                terminationRefundClientRate = _refundRate;
                emit TerminationProposition();
                stage = Stage.TerminationProposed;
                stageTime = uint32(now);
            }
        } else if (!hasContractorTerminationProposition || terminationRefundContractorRate != _refundRate) {
            hasContractorTerminationProposition = true;
            terminationRefundContractorRate = _refundRate;
            emit TerminationProposition();
            stage = Stage.TerminationProposed;
            stageTime = uint32(now);
        }

        if (hasClientTerminationProposition && hasContractorTerminationProposition
                && terminationRefundClientRate == terminationRefundContractorRate) {
            uint256 availableAmount = total.sub(confidealFee).sub(advancePayment);
            terminationRefund = availableAmount.mul(terminationRefundClientRate).div(1 ether);
            terminationPayment = availableAmount.sub(terminationRefund);
            emit Terminate();
            stage = Stage.Terminated;
            stageTime = uint32(now);
            if (terminationRefund > 0) {
                terminationRefundSent = client.send(terminationRefund);
            }
            if (terminationPayment > 0) {
                terminationPaymentSent = contractor.send(terminationPayment);
            }
        }
    }

    function withdrawTerminationRefund()
    public
    atStage(Stage.Terminated)
    nonReentrant
    {
        require(msg.sender == client);
        require(terminationRefund > 0 && !terminationRefundSent);

        terminationRefundSent = transferFunds(client, terminationRefund);
        if (terminationRefundSent) {
            emit TerminationRefundWithdrawal();
        }
    }

    function withdrawTerminationPayment()
    public
    atStage(Stage.Terminated)
    nonReentrant
    {
        require(msg.sender == contractor);
        require(terminationPayment > 0 && !terminationPaymentSent);

        terminationPaymentSent = transferFunds(contractor, terminationPayment);
        if (terminationPaymentSent) {
            emit TerminationPaymentWithdrawal();
        }
    }

    function closeOut(uint32 _time)
    public
    nonReentrant
    {
        require(msg.sender == client || msg.sender == contractor);
        require(stage == Stage.Running || stage == Stage.CloseoutProposed);

        if (msg.sender == client) {
            if (closeoutTimeClient != _time) {
                closeoutTimeClient = _time;
                emit CloseoutProposition();
                stage = Stage.CloseoutProposed;
                stageTime = uint32(now);
            }
        } else if (closeoutTimeContractor != _time) {
            closeoutTimeContractor = _time;
            emit CloseoutProposition();
            stage = Stage.CloseoutProposed;
            stageTime = uint32(now);
        }

        if (closeoutTimeClient == closeoutTimeContractor) {
            if (confidealFeePayer == Party.Contractor && advancePayment < confidealFee) {
                closeoutPayment = price.sub(confidealFee);
            } else {
                closeoutPayment = price.sub(advancePayment);
            }
            emit Closeout();
            stage = Stage.ClosedOut;
            stageTime = uint32(now);

            if (lateFeeRate > 0 && closeoutTimeClient > periodTo) {
                uint256 _lateFeeRate = lateFeeRate.mul((closeoutTimeClient - periodTo) / lateFeeInterval);
                if (_lateFeeRate > lateFeeMaxRate) {
                    _lateFeeRate = lateFeeMaxRate;
                }
                lateFee = price.mul(_lateFeeRate).div(1 ether);
                closeoutPayment = closeoutPayment.sub(lateFee);

                if (lateFee > 0) {
                    lateFeeSent = client.send(lateFee);
                }
            }

            if (closeoutPayment > 0) {
                closeoutPaymentSent = contractor.send(closeoutPayment);
            }
        }
    }

    function withdrawLateFee()
    public
    atStage(Stage.ClosedOut)
    nonReentrant
    {
        require(msg.sender == client);
        require(lateFee > 0 && !lateFeeSent);

        lateFeeSent = transferFunds(client, lateFee);
        if (lateFeeSent) {
            emit LateFeeWithdrawal();
        }
    }

    function withdrawCloseoutPayment()
    public
    atStage(Stage.ClosedOut)
    nonReentrant
    {
        require(msg.sender == contractor);
        require(closeoutPayment > 0 && !closeoutPaymentSent);

        closeoutPaymentSent = transferFunds(contractor, closeoutPayment);
        if (closeoutPaymentSent) {
            emit CloseoutPaymentWithdrawal();
        }
    }

    function resolveDispute(
        bytes32 _resolutionHash,
        uint256 _clientShare,
        uint256 _contractorShare
    )
    public
    atStage(Stage.Arbitration)
    {
        require(msg.sender == address(confideal));
        require(_clientShare.add(_contractorShare) == 1 ether);

        arbitrationFee = confideal.calculateArbitrationFee(this);
        uint256 amount = address(this).balance.sub(arbitrationFee);

        resolutionHash = _resolutionHash;
        clientAsset = amount.mul(_clientShare).div(1 ether);
        contractorAsset = amount.mul(_contractorShare).div(1 ether);

        emit DisputeResolution();
        stage = Stage.Resolved;
        stageTime = uint32(now);
    }

    function transferFunds(address _recipient, uint256 _amount) private
    returns (bool success)
    {
        return _recipient.call.value(_amount)();
    }

    function arbitration()
    public
    {
        require(msg.sender == client || msg.sender == contractor);
        require(arbitrationClause);
        require(stage == Stage.Running
            || stage == Stage.CloseoutProposed
            || stage == Stage.TerminationProposed
            || stage == Stage.Resolved);

        if (stage == Stage.Resolved) {
            require(appealsAvailable > 0);
            require(now - stageTime < appealWindow);
            appealsAvailable--;
        }

        emit Arbitration();
        stage = Stage.Arbitration;
        stageTime = uint32(now);
    }

    function withdrawClientAsset()
    public
    whenAppealWindowIsClosed
    nonReentrant
    {
        require(msg.sender == client && !clientAssetSent);

        withdrawArbiterPayment();
        clientAssetSent = transferFunds(client, clientAsset);
        if (clientAssetSent) {
            emit ClientAssetWithdrawal();
        }
    }

    function withdrawContractorAsset()
    public
    whenAppealWindowIsClosed
    nonReentrant
    {
        require(msg.sender == contractor && !contractorAssetSent);

        withdrawArbiterPayment();
        contractorAssetSent = transferFunds(contractor, contractorAsset);
        if (contractorAssetSent) {
            emit ContractorAssetWithdrawal();
        }
    }

    function withdrawArbiterPayment()
    public
    whenAppealWindowIsClosed
    {
        require(msg.sender == client || msg.sender == contractor || msg.sender == address(confideal));

        if (!arbitrationFeeSent) {
            confideal.collectArbitrationFee.value(arbitrationFee)();
            arbitrationFeeSent = true;
            emit ArbiterPaymentWithdrawal();
        }
    }

    function()
    public
    {
        revert();
    }

    function checkRate(uint256 _value)
    private
    pure
    {
        require(_value >= 0 && _value <= 1 ether);
    }
}
