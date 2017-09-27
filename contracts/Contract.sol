pragma solidity ^0.4.2;

import './Confideal.sol';

contract Contract {
    string constant public version = '1.2.0';

    event Destroy();
    event Sign();
    event Pay();
    event DownPaymentWithdrawal();
    event CloseoutProposition();
    event Closeout();
    event LateFeeWithdrawal();
    event CloseoutPaymentWithdrawal();
    event TerminationProposition();
    event Terminate();
    event TerminationRefundWithdrawal();
    event TerminationPaymentWithdrawal();

    enum Stage {
    ToBeSigned,
    Signed,
    Running,
    CloseoutProposed,
    ClosedOut,
    Terminated,
    TerminationProposed
    }

    enum Party {
    Client,
    Contractor
    }

    Stage public stage = Stage.ToBeSigned;
    uint32 public stageTime = uint32(now);

    address public creator = msg.sender;
    uint32 public creationTime; // timestamp
    uint32 public blockchainCreationTime = uint32(now);

    address public client;
    address public contractor;

    bytes32 public dataHash;

    uint256 public price; // in weis
    uint256 public confidealFee; // in weis
    uint256 public total; // in weis
    uint256 public downPaymentPct; // in weis
    uint256 public terminationRefundPctClient; // in weis
    uint256 public terminationRefundPctContractor; // in weis

    bool public hasClientTerminationProposition;
    bool public hasContractorTerminationProposition;

    uint32 public periodFrom; // timestamp
    uint32 public periodTo; // timestamp
    uint32 public closeoutTimeClient; // timestamp
    uint32 public closeoutTimeContractor; // timestamp

    uint256 public lateFeeRatePct; // in weis
    uint32 public lateFeeInterval;
    uint256 public lateFeeMaxPct; // in weis

    uint256 public downPayment; // in weis
    bool public downPaymentSent = false;

    uint256 public terminationRefund; // in weis
    bool public terminationRefundSent = false;
    uint256 public terminationPayment; // in weis
    bool public terminationPaymentSent = false;

    uint256 public closeoutPayment; // in weis
    bool public closeoutPaymentSent = false;

    uint256 public lateFee; // in weis
    bool public lateFeeSent = false;

    Party public confidealFeePayer;

    Confideal private confideal;

    bool private mutex = false;

    modifier exclusive()
    {
        if (mutex) {
            throw;
        }
        mutex = true;
        _;
        mutex = false;
    }

    modifier atStage(Stage _stage)
    {
        if (stage != _stage) throw;
        _;
    }

    function Contract(
    Confideal _confideal,
    bytes32 _dataHash,
    uint32 _creationTime,
    Party _party,
    address _counterparty,
    uint256 _price,
    uint256 _downPaymentPct,
    uint32 _periodTo, //timestamp

    uint256 _lateFeeRatePct,
    uint32 _lateFeeInterval,
    uint256 _lateFeeMaxPct,
    Party _confidealFeePayer
    )
    {
        blockchainCreationTime = uint32(now);

        if (_counterparty == msg.sender) {
            throw;
        }

        checkPct(_downPaymentPct);
        checkPct(_lateFeeRatePct);
        checkPct(_lateFeeMaxPct);

        confideal = _confideal;

        dataHash = _dataHash;
        creationTime = _creationTime;
        client = _party == Party.Client ? msg.sender : _counterparty;
        contractor = _party == Party.Contractor ? msg.sender : _counterparty;
        price = _price;
        downPaymentPct = _downPaymentPct;
        periodTo = _periodTo;

        confidealFeePayer = _confidealFeePayer;

        downPayment = _price * _downPaymentPct / 100 ether;
        confidealFee = _price / 100;
        if (_confidealFeePayer == Party.Client) {
            total = _price + confidealFee;
        } else {
            total = _price;
            if (downPayment < confidealFee) {
                downPayment = 0;
            } else {
                downPayment = downPayment - confidealFee;
            }
        }

        if (_lateFeeRatePct > 0) {
            if (_lateFeeMaxPct > 100 ether - _downPaymentPct) {
                throw;
            }
            if (_confidealFeePayer == Party.Contractor && _lateFeeMaxPct > 100 ether - confidealFee * 100 ether / _price) {
                throw;
            }
            lateFeeRatePct = _lateFeeRatePct;
            lateFeeInterval = _lateFeeInterval;
            lateFeeMaxPct = _lateFeeMaxPct;
        }
    }

    function destroy() public
    atStage(Stage.ToBeSigned)
    {
        if (msg.sender != creator) {
            throw;
        }
        Destroy();
        selfdestruct(creator);
    }

    function sign() public
    atStage(Stage.ToBeSigned)
    {
        if (msg.sender == creator || msg.sender != contractor) {
            throw;
        }
        Sign();
        stage = Stage.Signed;
        stageTime = uint32(now);
    }

    function pay() public
    payable
    exclusive
    {
        if (msg.sender != creator && stage != Stage.ToBeSigned) {
            throw;
        }
        if (msg.sender == creator && stage != Stage.Signed) {
            throw;
        }
        if (msg.sender != client) {
            throw;
        }
        if (msg.value != total) {
            throw;
        }
        Pay();
        stage = Stage.Running;
        stageTime = uint32(now);
        periodFrom = uint32(now);

        confideal.fee.value(confidealFee)();

        if (downPayment > 0) {
            downPaymentSent = contractor.send(downPayment);
        }
    }

    function withdrawDownPayment() public
    exclusive
    {
        if (msg.sender != contractor) {
            throw;
        }
        if (stage != Stage.Running
        && stage != Stage.Terminated
        && stage != Stage.ClosedOut) {
            throw;
        }
        if (downPayment == 0 || downPaymentSent) {
            throw;
        }
        downPaymentSent = transferFunds(contractor, downPayment);
        if (downPaymentSent) {
            DownPaymentWithdrawal();
        }
    }

    function terminate(uint256 _refundPct) public
    exclusive
    {
        if (stage != Stage.Running
                && stage != Stage.TerminationProposed) {
            throw;
        }

        checkPct(_refundPct);

        if (msg.sender == client) {
            if (!hasClientTerminationProposition || terminationRefundPctClient != _refundPct) {
                hasClientTerminationProposition = true;
                terminationRefundPctClient = _refundPct;
                TerminationProposition();
                stage = Stage.TerminationProposed;
                stageTime = uint32(now);
            }
        } else if (msg.sender == contractor) {
            if (!hasContractorTerminationProposition || terminationRefundPctContractor != _refundPct) {
                hasContractorTerminationProposition = true;
                terminationRefundPctContractor = _refundPct;
                TerminationProposition();
                stage = Stage.TerminationProposed;
                stageTime = uint32(now);
            }
        } else {
            throw;
        }

        if (hasClientTerminationProposition && hasContractorTerminationProposition
        && terminationRefundPctClient == terminationRefundPctContractor) {
            if (msg.sender != client && msg.sender != contractor) {
                throw;
            }
            var availableAmount = total - confidealFee - downPayment;
            terminationRefund = availableAmount * terminationRefundPctClient / 100 ether;
            terminationPayment = availableAmount - terminationRefund;
            Terminate();
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

    function withdrawTerminationRefund() public
    atStage(Stage.Terminated)
    exclusive
    {
        if (msg.sender != client) {
            throw;
        }
        if (terminationRefund == 0 || terminationRefundSent) {
            throw;
        }
        terminationRefundSent = transferFunds(client, terminationRefund);
        if (terminationRefundSent) {
            TerminationRefundWithdrawal();
        }
    }

    function withdrawTerminationPayment() public
    atStage(Stage.Terminated)
    exclusive
    {
        if (msg.sender != contractor) {
            throw;
        }
        if (terminationPayment == 0 || terminationPaymentSent) {
            throw;
        }
        terminationPaymentSent = transferFunds(contractor, terminationPayment);
        if (terminationPaymentSent) {
            TerminationPaymentWithdrawal();
        }
    }

    function closeOut(uint32 _time) public
    exclusive
    {
        if (stage != Stage.Running
                && stage != Stage.CloseoutProposed) {
            throw;
        }

        if (msg.sender == client) {
            if (closeoutTimeClient != _time) {
                closeoutTimeClient = _time;
                CloseoutProposition();
                stage = Stage.CloseoutProposed;
                stageTime = uint32(now);
            }
        } else if (msg.sender == contractor) {
            if (closeoutTimeContractor != _time) {
                closeoutTimeContractor = _time;
                CloseoutProposition();
                stage = Stage.CloseoutProposed;
                stageTime = uint32(now);
            }
        } else {
            throw;
        }

        if (closeoutTimeClient == closeoutTimeContractor) {
            if (confidealFeePayer == Party.Contractor && downPayment < confidealFee) {
                closeoutPayment = price - confidealFee;
            } else {
                closeoutPayment = price - downPayment;
            }
            Closeout();
            stage = Stage.ClosedOut;
            stageTime = uint32(now);

            if (lateFeeRatePct > 0 && closeoutTimeClient > periodTo) {
                uint256 lateFeePct = lateFeeRatePct * ((closeoutTimeClient - periodTo) / lateFeeInterval);
                if (lateFeePct > lateFeeMaxPct) {
                    lateFeePct = lateFeeMaxPct;
                }
                lateFee = price * lateFeePct / 100 ether;
                closeoutPayment -= lateFee;

                if (lateFee > 0) {
                    lateFeeSent = client.send(lateFee);
                }
            }

            if (closeoutPayment > 0) {
                closeoutPaymentSent = contractor.send(closeoutPayment);
            }
        }
    }

    function withdrawLateFee() public
    atStage(Stage.ClosedOut)
    exclusive
    {
        if (msg.sender != client) {
            throw;
        }
        if (lateFee == 0 || lateFeeSent) {
            throw;
        }
        lateFeeSent = transferFunds(client, lateFee);
        if (lateFeeSent) {
            LateFeeWithdrawal();
        }
    }

    function withdrawCloseoutPayment() public
    atStage(Stage.ClosedOut)
    exclusive
    {
        if (msg.sender != contractor) {
            throw;
        }
        if (closeoutPayment == 0 || closeoutPaymentSent) {
            throw;
        }
        closeoutPaymentSent = transferFunds(contractor, closeoutPayment);
        if (closeoutPaymentSent) {
            CloseoutPaymentWithdrawal();
        }
    }

    function transferFunds(address _recipient, uint256 _amount) private
    returns (bool success)
    {
        return _recipient.call.value(_amount)();
    }

    function ()
    {
        throw;
    }

    function checkPct(uint256 _value) private
    {
        if (_value < 0 || _value > 100 ether) {
            throw;
        }
    }
}
