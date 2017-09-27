import * as TimeInterval from '../helpers/TimeInterval';
import * as ContractStage from '../helpers/ContractStage';
import * as Party from '../helpers/Party';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
chai.use(chaiAsPromised);
const expect = chai.expect;
chai.should();
import Promise from 'bluebird';
import BigNumber from 'bignumber.js';

Promise.promisifyAll(web3.eth);

const Confideal = artifacts.require('../Confideal.sol');
const Contract = artifacts.require('../Contract.sol');
const TestContractParty = artifacts.require('../TestContractParty.sol');

contract('Contract', accounts => {
    const defaultAccount = accounts[0];
    const counterpartyAccount = accounts[5];

    const dataHash = '0xc15a0175e131a752d83e216abc4e4ff3377278f83d50c0bec9bc3460e68696d6';

    const createContract = (params = {}) => {
        params = {
            hash: dataHash,
            creationTime: 1477777777,
            party: Party.CLIENT,
            counterparty: counterpartyAccount,
            price: '1.23456',
            downPaymentPct: web3.toWei(10),
            periodTo: 1888888888,
            lateFeeRatePct: web3.toWei(1),
            lateFeeInterval: TimeInterval.WEEK,
            lateFeeMaxPct: web3.toWei(15),
            confidealFeePayer: Party.CLIENT,
            ...params,
        };

        return Confideal.deployed()
                .then(confideal => Contract.new(
                        confideal.address,
                        params.hash,
                        params.creationTime,
                        params.party,
                        params.counterparty,
                        web3.toWei(params.price),
                        params.downPaymentPct,
                        params.periodTo,
                        params.lateFeeRatePct,
                        params.lateFeeInterval,
                        params.lateFeeMaxPct,
                        params.confidealFeePayer
                ));
    };

    const contractTotal = web3.toWei(new BigNumber(1.23456).mul(1.01)).toString(10);
    const contractTotal001 = web3.toWei(new BigNumber(0.01).mul(1.01)).toString(10);

    it('should create a new contract as a client', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return createContract({confidealFeePayer: Party.CONTRACTOR})
                .then(contract => Promise.all([
                    contract.dataHash.call()
                            .then(hash => hash.should.be.equal(dataHash)),
                    contract.creationTime.call()
                            .then(creationTime => creationTime.toNumber().should.be.equal(1477777777)),
                    contract.client.call()
                            .then(client => client.should.be.equal(defaultAccount)),
                    contract.contractor.call()
                            .then(contractor => contractor.should.be.equal(counterpartyAccount)),
                    contract.price.call()
                            .then(price => price.toString().should.be.equal(web3.toWei(1.23456))),
                    contract.confidealFee.call()
                            .then(confidealFee => confidealFee.toNumber().should.be.equal(web3.toWei(1.23456) * 0.01)),
                    contract.total.call()
                            .then(total => total.toString().should.be.equal(web3.toWei(1.23456))),
                    contract.downPaymentPct.call()
                            .then(downPaymentPct => downPaymentPct.toString().should.be.equal(web3.toWei(10))),
                    contract.periodFrom.call()
                            .then(periodFrom => periodFrom.toNumber().should.be.equal(0)),
                    contract.periodTo.call()
                            .then(periodTo => periodTo.toNumber().should.be.equal(1888888888)),
                    contract.lateFeeRatePct.call()
                            .then(lateFeeRatePct => lateFeeRatePct.toString().should.be.equal(web3.toWei(1))),
                    contract.lateFeeInterval.call()
                            .then(lateFeeInterval => lateFeeInterval.toNumber().should.be.equal(TimeInterval.WEEK)),
                    contract.lateFeeMaxPct.call()
                            .then(lateFeeMaxPct => lateFeeMaxPct.toString().should.be.equal(web3.toWei(15))),
                    contract.confidealFeePayer.call()
                            .then(confidealFeePayer => confidealFeePayer.toString().should.be.equal(Party.CONTRACTOR)),
                    contract.downPayment.call()
                            .then(downPayment => downPayment.toNumber().should.be.equal(web3.toWei(1.23456) * 0.09)),
                    contract.stage.call()
                            .then(stage => stage.toNumber().should.be.equal(ContractStage.TO_BE_SIGNED)),
                    contract.stageTime.call()
                            .then(stageTime => {
                                stageTime.toNumber().should.be.at.least(timeBefore);
                                stageTime.toNumber().should.be.below(Date.now() / 1000);
                            }),
                    contract.blockchainCreationTime.call()
                            .then(blockchainCreationTime => {
                                blockchainCreationTime.toNumber().should.be.at.least(timeBefore);
                                blockchainCreationTime.toNumber().should.be.below(Date.now() / 1000);
                            }),
                ]));
    });

    it('should create a new contract as a contractor', () => {
        return createContract({
            price: '0.01',
            party: Party.CONTRACTOR,
        })
                .then(contract => Promise.all([
                    contract.client.call()
                            .then(client => client.should.be.equal(counterpartyAccount)),
                    contract.contractor.call()
                            .then(contractor => contractor.should.be.equal(defaultAccount)),
                    contract.confidealFeePayer.call()
                            .then(confidealFeePayer => confidealFeePayer.toString().should.be.equal(Party.CLIENT)),
                    contract.total.call()
                            .then(total => total.toString().should.be.equal(contractTotal001)),
                    contract.downPayment.call()
                            .then(downPayment => downPayment.toNumber().should.be.equal(web3.toWei(0.01) * 0.1)),
                ]));
    });

    describe('while creating', () => {
        it('shouldn’t allow set down payment below 0', () => {
            return expect(
                createContract({downPaymentPct: -1})
            ).to.be.rejected;
        });

        it('shouldn’t allow set down payment above 100%', () => {
            return expect(
                createContract({downPaymentPct: web3.toWei(100.1)})
            ).to.be.rejected;
        });

        it('shouldn’t allow set late fee rate below 0', () => {
            return expect(
                createContract({lateFeeRatePct: -1})
            ).to.be.rejected;
        });

        it('shouldn’t allow set late fee rate above 100%', () => {
            return expect(
                createContract({lateFeeRatePct: web3.toWei(100.1)})
            ).to.be.rejected;
        });

        it('shouldn’t allow set maximal late fee below 0', () => {
            return expect(
                createContract({lateFeeMaxPct: -1})
            ).to.be.rejected;
        });

        it('shouldn’t allow set maximal late fee above 100%', () => {
            return expect(
                createContract({lateFeeMaxPct: web3.toWei(100.1)})
            ).to.be.rejected;
        });

        it('shouldn’t allow a creator to be a counterparty', () => {
            return expect(
                createContract({counterparty: defaultAccount})
            ).to.be.rejected;
        });

        it('shouldn’t allow to set the maximal late fee greater than the closeout payment', () => {
            return expect(
                createContract({lateFeeMaxPct: web3.toWei(91)})
            ).to.be.rejected;
        });

        it('shouldn’t allow to set the maximal late fee greater than the Confideal fee if contractor pays this fee', () => {
            return Promise.all([
                expect(
                    createContract({
                        downPaymentPct: web3.toWei(0.5), // smaller than the Confideal fee
                        lateFeeMaxPct: web3.toWei(99.5),
                        confidealFeePayer: Party.CONTRACTOR,
                    })
                ).to.be.rejected,
                createContract({
                    downPaymentPct: web3.toWei(0.5), // smaller than the Confideal fee
                    lateFeeMaxPct: web3.toWei(99),
                    confidealFeePayer: Party.CONTRACTOR,
                })
                    .then(contract => Promise.all([
                        contract.total.call()
                            .then(total => total.toString().should.be.equal(web3.toWei('1.23456'))),
                        contract.downPayment.call()
                            .then(downPayment => downPayment.toString().should.be.equal('0')),
                    ])),
            ]);
        });
    });

    it('should allow a creator to destroy a contract', () => {
        return createContract()
                .then(contract => contract.destroy()
                        .then(result => {
                            result.logs.should.have.length(1);
                            result.logs[0].event.should.be.equal('Destroy');
                            return web3.eth.getCodeAsync(contract.address)
                                    .then(code => parseInt(code, 16).should.equal(0));
                        }));
    });

    it('shouldn’t allow a non-creator to destroy a contract', () => {
        return createContract()
                .then(contract => expect(contract.destroy({from: accounts[1]})).to.be.rejected);
    });

    it('shouldn’t allow to destroy a signed contract', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => expect(contract.destroy()).to.be.rejected)
                );
    });

    it('should allow a contractor to sign a contract', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(result => {
                            result.logs.should.have.length(1);
                            result.logs[0].event.should.be.equal('Sign');
                            return Promise.all([
                                contract.stage.call()
                                        .then(stage => stage.toNumber().should.be.equal(ContractStage.SIGNED)),
                                contract.stageTime.call()
                                        .then(stageTime => {
                                            stageTime.toNumber().should.be.at.least(timeBefore);
                                            stageTime.toNumber().should.be.below(Date.now() / 1000);
                                        }),
                            ]);
                        })
                );
    });

    it('shouldn’t allow the client to sign a contract', () => {
        return createContract({
            price: '0.01',
            party: Party.CONTRACTOR,
        }).then(contract => expect(contract.sign({from: counterpartyAccount})).to.be.rejected);
    });

    it('shouldn’t allow the creator to sign a contract', () => {
        return createContract()
                .then(contract => expect(contract.sign()).to.be.rejected);
    });

    it('should allow a client to pay a signed contract if he’s the contract creator (he’s also a Confideal fee payer here)', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        let contractorBalance;
        let confidealBalance;
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => web3.eth.getBalanceAsync(counterpartyAccount))
                        .then(balance => contractorBalance = balance.toNumber())

                        .then(() => web3.eth.getBalanceAsync(Confideal.address))
                        .then(balance => confidealBalance = balance.toNumber())

                        .then(() => contract.pay({value: contractTotal}))
                        .then(result => {
                            result.logs.should.have.length(1);
                            result.logs[0].event.should.be.equal('Pay');
                        })

                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.RUNNING)),
                            contract.stageTime.call()
                                    .then(stageTime => {
                                        stageTime.toNumber().should.be.at.least(timeBefore);
                                        stageTime.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.periodFrom.call()
                                    .then(periodFrom => {
                                        periodFrom.toNumber().should.be.at.least(timeBefore);
                                        periodFrom.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.downPaymentSent.call()
                                    .then(downPaymentSent => downPaymentSent.should.be.true),
                            web3.eth.getBalanceAsync(contract.address)
                                    .then(balance => balance.toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.9)),
                            web3.eth.getBalanceAsync(counterpartyAccount)
                                    .then(balance => balance.sub(contractorBalance).toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.1)),
                            web3.eth.getBalanceAsync(Confideal.address)
                                    .then(balance => balance.sub(confidealBalance).toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.01)),
                        ]))
                );
    });

    it('should subtract the Confideal fee from the down payment if contractor is a Confideal fee payer and the down payment is greater than the Confideal fee', () => {
        let contractorBalance;
        let confidealBalance;
        return createContract({confidealFeePayer: Party.CONTRACTOR})
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => web3.eth.getBalanceAsync(counterpartyAccount))
                        .then(balance => contractorBalance = balance.toNumber())

                        .then(() => web3.eth.getBalanceAsync(Confideal.address))
                        .then(balance => confidealBalance = balance.toNumber())

                        .then(() => contract.pay({value: web3.toWei(1.23456)}))
                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.RUNNING)),
                            contract.downPaymentSent.call()
                                    .then(downPaymentSent => downPaymentSent.should.be.true),
                            web3.eth.getBalanceAsync(contract.address)
                                    .then(balance => balance.toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.9)),
                            web3.eth.getBalanceAsync(counterpartyAccount)
                                    .then(balance => balance.sub(contractorBalance).toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.09)),
                            web3.eth.getBalanceAsync(Confideal.address)
                                    .then(balance => balance.sub(confidealBalance).toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.01)),
                        ]))
                );
    });

    it('should subtract the Confideal fee from the down payment and the closeout payment if contractor is a Confideal fee payer and the down payment isn’t greater than the Confideal fee', () => {
        let contractorBalance;
        let confidealBalance;
        return createContract({downPaymentPct: web3.toWei(0.5), confidealFeePayer: Party.CONTRACTOR})
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => web3.eth.getBalanceAsync(counterpartyAccount))
                        .then(balance => contractorBalance = balance.toNumber())

                        .then(() => web3.eth.getBalanceAsync(Confideal.address))
                        .then(balance => confidealBalance = balance.toNumber())

                        .then(() => contract.pay({value: web3.toWei(1.23456)}))
                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.RUNNING)),
                            contract.downPayment.call()
                                    .then(downPayment => downPayment.toString().should.be.equal('0')),
                            contract.downPaymentSent.call()
                                    .then(downPaymentSent => downPaymentSent.should.be.false),
                            web3.eth.getBalanceAsync(contract.address)
                                    .then(balance => balance.toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.99)),
                            web3.eth.getBalanceAsync(counterpartyAccount)
                                    .then(balance => balance.sub(contractorBalance).toNumber()
                                            .should.be.equal(0)),
                            web3.eth.getBalanceAsync(Confideal.address)
                                    .then(balance => balance.sub(confidealBalance).toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.01)),
                        ]))

                        .then(() => contract.closeOut(1888888888, {from: defaultAccount}))
                        .then(() => contract.closeOut(1888888888, {from: counterpartyAccount}))
                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.CLOSED_OUT)),
                            contract.closeoutPayment.call()
                                    .then(closeoutPayment => closeoutPayment.toNumber()
                                            .should.be.equal(web3.toWei(1.23456) * 0.99)),
                            contract.closeoutPaymentSent.call()
                                    .then(closeoutPaymentSent => closeoutPaymentSent.should.be.true),
                            web3.eth.getBalanceAsync(contract.address)
                                    .then(contractBalance => contractBalance.toNumber().should.be.equal(0)),
                        ]))
                );
    });

    it('should allow a client to pay an unsigned contract if he’s not the contract creator', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return createContract({
            party: Party.CONTRACTOR,
        }).then(contract => contract.pay({from: counterpartyAccount, value: contractTotal})
                .then(() => Promise.all([
                    contract.stage.call()
                            .then(stage => stage.toNumber().should.be.equal(ContractStage.RUNNING)),
                    contract.stageTime.call()
                            .then(stageTime => {
                                stageTime.toNumber().should.be.at.least(timeBefore);
                                stageTime.toNumber().should.be.below(Date.now() / 1000);
                            }),
                ]))
        );
    });

    it('shouldn’t allow to pay a greater amount', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => expect(contract.pay({
                            value: web3.toWei(new BigNumber(1.23456).mul(1.01)).add(1).toString(10)
                        })).to.be.rejected)
                );
    });

    it('shouldn’t allow to pay a smaller amount', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => expect(contract.pay({
                            value: web3.toWei(new BigNumber(1.23456).mul(1.01)).sub(1).toString(10)
                        })).to.be.rejected)
                );
    });

    it('shouldn’t allow to pay an unsigned contract', () => {
        return createContract()
                .then(contract => expect(contract.pay({value: contractTotal})).to.be.rejected);
    });

    it('shouldn’t allow to pay an already paid contract', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))
                        .then(() => expect(contract.pay({value: contractTotal})).to.be.rejected)
                );
    });

    it('shouldn’t send a down payment if it equals 0', () => {
        return createContract({
            price: '0.01',
            downPaymentPct: 0,
        }).then(contract => contract.sign({from: counterpartyAccount})
                .then(() => contract.downPayment.call())
                .then(downPayment => downPayment.toNumber().should.be.equal(0))

                .then(() => contract.pay({value: contractTotal001}))

                .then(() => contract.downPaymentSent.call())
                .then(downPaymentSent => downPaymentSent.should.be.false)
        );
    });

    it('shouldn’t allow non-client to pay a contract', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount}).then(() => {
                    expect(contract.pay({
                        value: contractTotal,
                        from: accounts[1],
                    })).to.be.rejected;
                }));
    });

    it('should allow a contractor to withdraw a down payment', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            counterparty: testContractParty.address,
                        }).then(contract => testContractParty.sign(contract.address)
                                .then(() => contract.pay({value: contractTotal001}))
                                .then(() => Promise.all([
                                    contract.downPaymentSent.call()
                                            .then(downPaymentSent => downPaymentSent.should.be.false),
                                    web3.eth.getBalanceAsync(contract.address)
                                            .then(balance => web3.fromWei(balance).toString().should.be.equal('0.01')),
                                ]))

                                .then(() => testContractParty.withdrawDownPayment(contract.address))
                                .then(result => {
                                    result.receipt.logs.should.have.length(1);
                                    result.receipt.logs[0].topics.should.have.length(1);
                                    result.receipt.logs[0].topics[0]
                                            .should.be.equal(web3.sha3('DownPaymentWithdrawal()'));
                                })

                                .then(() => Promise.all([
                                    contract.downPaymentSent.call()
                                            .then(downPaymentSent => downPaymentSent.should.be.true),
                                    web3.eth.getBalanceAsync(contract.address)
                                            .then(balance => web3.fromWei(balance).toString().should.be.equal('0.009')),
                                ]))
                        )
                );
    });

    it('should allow a contractor to withdraw a down payment from terminated contract', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            counterparty: testContractParty.address,
                        }).then(contract => testContractParty.sign(contract.address)
                                .then(() => contract.pay({value: contractTotal001}))
                                .then(() => Promise.all([
                                    contract.downPaymentSent.call()
                                            .then(downPaymentSent => downPaymentSent.should.be.false),
                                    web3.eth.getBalanceAsync(contract.address)
                                            .then(balance => web3.fromWei(balance).toString().should.be.equal('0.01')),
                                ]))
                                .then(() => testContractParty.terminate(contract.address, 100))
                                .then(() => contract.terminate(100))
                                .then(() => testContractParty.withdrawDownPayment(contract.address))
                                .then(() => Promise.all([
                                    contract.downPaymentSent.call()
                                            .then(downPaymentSent => downPaymentSent.should.be.true),
                                    web3.eth.getBalanceAsync(testContractParty.address)
                                            .then(balance => web3.fromWei(balance).toString().should.be.equal('0.001')),
                                ]))
                        )
                );
    });

    it('should allow a contractor to withdraw a down payment from a closed out contract', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            counterparty: testContractParty.address,
                        }).then(contract => testContractParty.sign(contract.address)
                                .then(() => contract.pay({value: contractTotal001}))
                                .then(() => Promise.all([
                                    contract.downPaymentSent.call()
                                            .then(downPaymentSent => downPaymentSent.should.be.false),
                                    web3.eth.getBalanceAsync(contract.address)
                                            .then(balance => web3.fromWei(balance).toString().should.be.equal('0.01')),
                                ]))
                                .then(() => testContractParty.closeOut(contract.address, 123))
                                .then(() => contract.closeOut(123))
                                .then(() => testContractParty.withdrawDownPayment(contract.address))
                                .then(() => Promise.all([
                                    contract.downPaymentSent.call()
                                            .then(downPaymentSent => downPaymentSent.should.be.true),
                                    web3.eth.getBalanceAsync(testContractParty.address)
                                            .then(balance => web3.fromWei(balance).toString().should.be.equal('0.001')),
                                ]))
                        )
                );
    });

    it('shouldn’t allow to withdraw a down payment that is already sent', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))

                        .then(() => contract.downPaymentSent.call())
                        .then(downPaymentSent => downPaymentSent.should.be.true)

                        .then(() => expect(contract.withdrawDownPayment(contract.address, {from: counterpartyAccount}))
                                .to.be.rejected)
                );
    });

    it('shouldn’t allow to withdraw a down payment if it equals 0', () => {
        return createContract({
            price: '0.01',
            downPaymentPct: 0,
        }).then(contract => contract.sign({from: counterpartyAccount})
                .then(() => contract.pay({value: contractTotal001}))

                .then(() => contract.downPaymentSent.call())
                .then(downPaymentSent => downPaymentSent.should.be.false)

                .then(() => expect(contract.withdrawDownPayment(contract.address, {from: counterpartyAccount}))
                        .to.be.rejected)
        );
    });

    it('shouldn’t allow a non-contractor to withdraw a down payment', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            counterparty: testContractParty.address,
                        }).then(contract => testContractParty.sign(contract.address)
                                .then(() => contract.pay({value: contractTotal001}))
                                .then(() => Promise.all([
                                    contract.downPaymentSent.call()
                                            .then(downPaymentSent => downPaymentSent.should.be.false),
                                    web3.eth.getBalanceAsync(contract.address)
                                            .then(balance => web3.fromWei(balance).toNumber().should.be.equal(0.01)),
                                ]))
                                .then(() => expect(contract.withdrawDownPayment(contract.address)).to.be.rejected)
                        )
                );
    });

    it('should allow a client to propose a contract termination', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))

                        .then(() => contract.terminate(123, {from: defaultAccount}))
                        .then(result => {
                            result.logs.should.have.length(1);
                            result.logs[0].event.should.be.equal('TerminationProposition');
                        })

                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.TERMINATION_PROPOSED)),
                            contract.stageTime.call()
                                    .then(stageTime => {
                                        stageTime.toNumber().should.be.at.least(timeBefore);
                                        stageTime.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.terminationRefundPctClient.call()
                                    .then(terminationRefundPctClient => terminationRefundPctClient.toNumber()
                                            .should.be.equal(123)),
                        ]))
                );
    });

    it('should allow a contractor to propose a contract termination', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))

                        .then(() => contract.terminate(234, {from: counterpartyAccount}))
                        .then(result => {
                            result.logs.should.have.length(1);
                            result.logs[0].event.should.be.equal('TerminationProposition');
                        })

                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.TERMINATION_PROPOSED)),
                            contract.stageTime.call()
                                    .then(stageTime => {
                                        stageTime.toNumber().should.be.at.least(timeBefore);
                                        stageTime.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.terminationRefundPctContractor.call()
                                    .then(terminationRefundPctContractor => terminationRefundPctContractor.toNumber()
                                            .should.be.equal(234)),
                        ]))
                );
    });

    it('shouldn’t allow a 3rd party to terminate a contract', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))
                        .then(() => expect(contract.terminate(234, {from: accounts[1]})).to.be.rejected)
                );
    });

    describe('while proposing a termination', () => {
        it('shouldn’t allow set refund below 0', () => {
            return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                    .then(() => contract.pay({value: contractTotal}))
                    .then(() => expect(contract.terminate(-1)).to.be.rejected)
                );
        });

        it('shouldn’t allow set refund above 100%', () => {
            return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                    .then(() => contract.pay({value: contractTotal}))
                    .then(() => expect(contract.terminate(web3.toWei(100.1))).to.be.rejected)
                );
        });

        it('shouldn’t terminate with the first proposition of refund set to 0', () => {
            return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                    .then(() => contract.pay({value: contractTotal}))
                    .then(() => contract.terminate(0))

                    .then(() => contract.stage.call()
                        .then(stage => stage.toNumber().should.be.equal(ContractStage.TERMINATION_PROPOSED)))
                );
        });
    });

    it('should terminate a contract if parties propose the same refund percent', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        let clientBalanceAfterTerminationProposition, contractorBalanceAfterPay;
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))

                        .then(() => web3.eth.getBalanceAsync(counterpartyAccount))
                        .then(balance => contractorBalanceAfterPay = balance)

                        .then(() => contract.terminate(web3.toWei(25), {from: defaultAccount}))

                        .then(() => web3.eth.getBalanceAsync(defaultAccount))
                        .then(balance => clientBalanceAfterTerminationProposition = balance)

                        .then(() => contract.terminate(web3.toWei(25), {from: counterpartyAccount}))
                        .then(result => {
                            result.logs.should.have.length(2);
                            result.logs[0].event.should.be.equal('TerminationProposition');
                            result.logs[1].event.should.be.equal('Terminate');
                        })

                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.TERMINATED)),
                            contract.stageTime.call()
                                    .then(stageTime => {
                                        stageTime.toNumber().should.be.at.least(timeBefore);
                                        stageTime.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.terminationRefund.call()
                                    .then(terminationRefund => web3.fromWei(terminationRefund).toString()
                                            .should.be.equal(new BigNumber(1.23456).mul(0.9).mul(0.25).toString())),
                            contract.terminationRefundSent.call()
                                    .then(terminationRefundSent => terminationRefundSent.should.be.true),
                            contract.terminationPayment.call()
                                    .then(terminationPayment => web3.fromWei(terminationPayment).toString()
                                            .should.be.equal(new BigNumber(1.23456).mul(0.9).mul(0.75).toString())),
                            contract.terminationPaymentSent.call()
                                    .then(terminationPaymentSent => terminationPaymentSent.should.be.true),
                            web3.eth.getBalanceAsync(contract.address)
                                    .then(contractBalance => contractBalance.toNumber().should.be.equal(0)),
                            web3.eth.getBalanceAsync(defaultAccount)
                                    .then(clientBalance => clientBalance.sub(clientBalanceAfterTerminationProposition).toString()
                                            .should.be.equal(web3.toWei(new BigNumber(1.23456)).mul(0.9).mul(0.25).toString())),
                            web3.eth.getBalanceAsync(counterpartyAccount)
                                    .then(contractorBalance => contractorBalance.sub(contractorBalanceAfterPay).toNumber()
                                            .should.be.at.least(web3.toWei(1.2 * 0.9 * 0.75))), // minus gas cost of termination
                        ]))
                );
    });

    it('should allow a client to withdraw a termination refund', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            party: Party.CONTRACTOR,
                            counterparty: testContractParty.address,
                        })
                                .then(contract => testContractParty.pay(contract.address, {value: contractTotal001})
                                        .then(() => contract.terminate(web3.toWei(80)))
                                        .then(() => testContractParty.terminate(contract.address, web3.toWei(80)))
                                        .then(() => Promise.all([
                                            contract.terminationRefund.call()
                                                    .then(terminationRefund => web3.fromWei(terminationRefund).toString()
                                                            .should.be.equal((new BigNumber('0.009')).mul('0.8').toString())),
                                            contract.terminationRefundSent.call()
                                                    .then(terminationRefundSent => terminationRefundSent.should.be.false),
                                            web3.eth.getBalanceAsync(contract.address)
                                                    .then(balance => web3.fromWei(balance).toString()
                                                            .should.be.equal((new BigNumber('0.009')).mul('0.8').toString())),
                                        ]))

                                        .then(() => testContractParty.withdrawTerminationRefund(contract.address))
                                        .then(result => {
                                            result.receipt.logs.should.have.length(1);
                                            result.receipt.logs[0].topics.should.have.length(1);
                                            result.receipt.logs[0].topics[0]
                                                    .should.be.equal(web3.sha3('TerminationRefundWithdrawal()'));
                                        })

                                        .then(() => Promise.all([
                                            contract.terminationRefundSent.call()
                                                    .then(terminationRefundSent => terminationRefundSent.should.be.true),
                                            web3.eth.getBalanceAsync(contract.address)
                                                    .then(balance => web3.fromWei(balance).toString()
                                                            .should.be.equal('0')),
                                        ]))
                                )
                );
    });

    it('shouldn’t allow to withdraw a termination refund that is already sent', () => {
        return createContract({price: '0.01'})
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal001}))
                        .then(() => contract.terminate(web3.toWei(80)))
                        .then(() => contract.terminate(web3.toWei(80), {from: counterpartyAccount}))
                        .then(() => contract.terminationRefundSent.call()
                                .then(terminationRefundSent => terminationRefundSent.should.be.true)
                        )
                        .then(() => expect(contract.withdrawTerminationRefund()).to.be.rejected)
                );
    });

    it('shouldn’t allow to withdraw a termination refund if it equals 0', () => {
        return createContract({
            price: '0.01',
            downPaymentPct: web3.toWei(100), // but why?
            lateFeeRatePct: 0,
        })
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal001}))
                        .then(() => contract.terminate(web3.toWei(80)))
                        .then(() => contract.terminate(web3.toWei(80), {from: counterpartyAccount}))
                        .then(() => Promise.all([
                            contract.terminationRefund.call()
                                    .then(terminationRefund => web3.fromWei(terminationRefund).toString()
                                            .should.be.equal('0')),
                            contract.terminationRefundSent.call()
                                    .then(terminationRefundSent => terminationRefundSent.should.be.false),
                        ]))
                        .then(() => expect(contract.withdrawTerminationRefund()).to.be.rejected)
                );
    });

    it('shouldn’t allow a non-client to withdraw a termination refund', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            party: Party.CONTRACTOR,
                            counterparty: testContractParty.address,
                        })
                                .then(contract => testContractParty.pay(contract.address, {value: contractTotal001})
                                        .then(() => contract.terminate(web3.toWei(100)))
                                        .then(() => testContractParty.terminate(contract.address, web3.toWei(100)))
                                        .then(() => Promise.all([
                                            contract.terminationRefund.call()
                                                    .then(terminationRefund => web3.fromWei(terminationRefund).toString()
                                                            .should.be.equal('0.009')),
                                            contract.terminationRefundSent.call()
                                                    .then(terminationRefundSent => terminationRefundSent.should.be.false),
                                        ]))

                                        .then(() => expect(contract.withdrawTerminationRefund()).to.be.rejected)
                                )
                );
    });

    it('should allow a client to propose a contract closeout', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))

                        .then(() => contract.closeOut(123, {from: defaultAccount}))
                        .then(result => {
                            result.logs.should.have.length(1);
                            result.logs[0].event.should.be.equal('CloseoutProposition');
                        })

                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.CLOSEOUT_PROPOSED)),
                            contract.stageTime.call()
                                    .then(stageTime => {
                                        stageTime.toNumber().should.be.at.least(timeBefore);
                                        stageTime.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.closeoutTimeClient.call()
                                    .then(closeoutTimeClient => closeoutTimeClient.toNumber()
                                            .should.be.equal(123)),
                        ]))
                );
    });

    it('should allow a contractor to propose a contract closeout', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))

                        .then(() => contract.closeOut(234, {from: counterpartyAccount}))
                        .then(result => {
                            result.logs.should.have.length(1);
                            result.logs[0].event.should.be.equal('CloseoutProposition');
                        })

                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.CLOSEOUT_PROPOSED)),
                            contract.stageTime.call()
                                    .then(stageTime => {
                                        stageTime.toNumber().should.be.at.least(timeBefore);
                                        stageTime.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.closeoutTimeContractor.call()
                                    .then(closeoutTimeContractor => closeoutTimeContractor.toNumber()
                                            .should.be.equal(234)),
                        ]))
                );
    });

    it('shouldn’t allow a 3rd party to close out a contract', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))
                        .then(() => expect(contract.closeOut(234, {from: accounts[1]})).to.be.rejected)
                );
    });

    it('should close out a contract if parties propose the same time of closeout', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        let clientBalanceAfterCloseoutProposition, contractorBalanceAfterPay;
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))

                        .then(() => web3.eth.getBalanceAsync(counterpartyAccount))
                        .then(balance => contractorBalanceAfterPay = balance)

                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK * 3, {from: defaultAccount}))

                        .then(() => web3.eth.getBalanceAsync(defaultAccount))
                        .then(balance => clientBalanceAfterCloseoutProposition = balance)

                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK * 3, {from: counterpartyAccount}))
                        .then(result => {
                            result.logs.should.have.length(2);
                            result.logs[0].event.should.be.equal('CloseoutProposition');
                            result.logs[1].event.should.be.equal('Closeout');
                        })

                        .then(() => Promise.all([
                            contract.stage.call()
                                    .then(stage => stage.toNumber().should.be.equal(ContractStage.CLOSED_OUT)),
                            contract.stageTime.call()
                                    .then(stageTime => {
                                        stageTime.toNumber().should.be.at.least(timeBefore);
                                        stageTime.toNumber().should.be.below(Date.now() / 1000);
                                    }),
                            contract.lateFee.call()
                                    .then(lateFee => web3.fromWei(lateFee).toString()
                                            .should.be.equal(new BigNumber(1.23456).mul(0.03).toString())),
                            contract.lateFeeSent.call()
                                    .then(lateFeeSent => lateFeeSent.should.be.true),
                            contract.closeoutPayment.call()
                                    .then(closeoutPayment => web3.fromWei(closeoutPayment).toString()
                                            .should.be.equal(new BigNumber(1.23456).mul(0.87).toString())),
                            contract.closeoutPaymentSent.call()
                                    .then(closeoutPaymentSent => closeoutPaymentSent.should.be.true),
                            web3.eth.getBalanceAsync(contract.address)
                                    .then(contractBalance => contractBalance.toNumber().should.be.equal(0)),
                            web3.eth.getBalanceAsync(defaultAccount)
                                    .then(clientBalance => clientBalance.sub(clientBalanceAfterCloseoutProposition).toString()
                                            .should.be.equal(web3.toWei(new BigNumber(1.23456)).mul(0.03).toString())),
                            web3.eth.getBalanceAsync(counterpartyAccount)
                                    .then(contractorBalance => contractorBalance.sub(contractorBalanceAfterPay).toNumber()
                                            .should.be.at.least(web3.toWei(1.2 * 0.87))), // minus gas cost of closeout
                        ]))
                );
    });

    it('shouldn’t allow the late fee to exceed the maximal late fee', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))
                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK * 16, {from: defaultAccount}))
                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK * 16, {from: counterpartyAccount}))

                        .then(() => contract.lateFee.call()
                                .then(lateFee => web3.fromWei(lateFee).toString()
                                        .should.be.equal(new BigNumber(1.23456).mul(0.15).toString()))
                        )
                );
    });

    it('shouldn’t collect the late fee if a contract is closed out in time', () => {
        return createContract()
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal}))
                        .then(() => contract.closeOut(123, {from: defaultAccount}))
                        .then(() => contract.closeOut(123, {from: counterpartyAccount}))

                        .then(() => contract.lateFee.call()
                                .then(lateFee => web3.fromWei(lateFee).toString()
                                        .should.be.equal('0'))
                        )
                );
    });

    it('should allow a client to withdraw a late fee', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            party: Party.CONTRACTOR,
                            counterparty: testContractParty.address,
                        })
                                .then(contract => testContractParty.pay(contract.address, {value: contractTotal001})
                                        .then(() => testContractParty.closeOut(contract.address,
                                                1888888888 + TimeInterval.WEEK))
                                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK))
                                        .then(() => Promise.all([
                                            contract.lateFee.call()
                                                    .then(lateFee => web3.fromWei(lateFee).toString()
                                                            .should.be.equal('0.0001')),
                                            contract.lateFeeSent.call()
                                                    .then(lateFeeSent => lateFeeSent.should.be.false),
                                            web3.eth.getBalanceAsync(contract.address)
                                                    .then(balance => web3.fromWei(balance).toString()
                                                            .should.be.equal('0.0001')),
                                        ]))

                                        .then(() => testContractParty.withdrawLateFee(contract.address))
                                        .then(result => {
                                            result.receipt.logs.should.have.length(1);
                                            result.receipt.logs[0].topics.should.have.length(1);
                                            result.receipt.logs[0].topics[0]
                                                    .should.be.equal(web3.sha3('LateFeeWithdrawal()'));
                                        })

                                        .then(() => Promise.all([
                                            contract.lateFeeSent.call()
                                                    .then(lateFeeSent => lateFeeSent.should.be.true),
                                            web3.eth.getBalanceAsync(contract.address)
                                                    .then(balance => web3.fromWei(balance).toString()
                                                            .should.be.equal('0')),
                                        ]))
                                )
                );
    });

    it('shouldn’t allow to withdraw a late fee that is already sent', () => {
        return createContract({price: '0.01'})
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal001}))
                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK, {from: defaultAccount}))
                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK, {from: counterpartyAccount}))
                        .then(() => contract.lateFeeSent.call()
                                .then(lateFeeSent => lateFeeSent.should.be.true)
                        )
                        .then(() => expect(contract.withdrawLateFee()).to.be.rejected)
                );
    });

    it('shouldn’t allow to withdraw a late fee if it equals 0', () => {
        return createContract({price: '0.01'})
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal001}))
                        .then(() => contract.closeOut(123, {from: defaultAccount}))
                        .then(() => contract.closeOut(123, {from: counterpartyAccount}))
                        .then(() => Promise.all([
                            contract.lateFee.call()
                                    .then(lateFee => web3.fromWei(lateFee).toString().should.be.equal('0')),
                            contract.lateFeeSent.call()
                                    .then(lateFeeSent => lateFeeSent.should.be.false),
                        ]))
                        .then(() => expect(contract.withdrawLateFee()).to.be.rejected)
                );
    });

    it('shouldn’t allow a non-client to withdraw a late fee', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            party: Party.CONTRACTOR,
                            counterparty: testContractParty.address,
                        })
                                .then(contract => testContractParty.pay(contract.address, {value: contractTotal001})
                                        .then(() => testContractParty.closeOut(contract.address,
                                                1888888888 + TimeInterval.WEEK))
                                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK))
                                        .then(() => Promise.all([
                                            contract.lateFee.call()
                                                    .then(lateFee => web3.fromWei(lateFee).toString()
                                                            .should.be.equal('0.0001')),
                                            contract.lateFeeSent.call()
                                                    .then(lateFeeSent => lateFeeSent.should.be.false),
                                        ]))

                                        .then(() => expect(contract.withdrawLateFee()).to.be.rejected)
                                )
                );
    });

    it('should allow a contractor to withdraw a closeout payment', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            counterparty: testContractParty.address,
                        })
                                .then(contract => testContractParty.sign(contract.address)
                                        .then(() => contract.pay({value: contractTotal001}))
                                        .then(() => testContractParty.withdrawDownPayment(contract.address))
                                        .then(() => testContractParty.closeOut(contract.address,
                                                1888888888 + TimeInterval.WEEK))
                                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK))
                                        .then(() => Promise.all([
                                            contract.closeoutPayment.call()
                                                    .then(closeoutPayment => web3.fromWei(closeoutPayment).toString()
                                                            .should.be.equal('0.0089')),
                                            contract.closeoutPaymentSent.call()
                                                    .then(closeoutPaymentSent => closeoutPaymentSent.should.be.false),
                                            web3.eth.getBalanceAsync(contract.address)
                                                    .then(balance => web3.fromWei(balance).toString()
                                                            .should.be.equal('0.0089')),
                                        ]))

                                        .then(() => testContractParty.withdrawCloseoutPayment(contract.address))
                                        .then(result => {
                                            result.receipt.logs.should.have.length(1);
                                            result.receipt.logs[0].topics.should.have.length(1);
                                            result.receipt.logs[0].topics[0]
                                                    .should.be.equal(web3.sha3('CloseoutPaymentWithdrawal()'));
                                        })

                                        .then(() => Promise.all([
                                            contract.closeoutPaymentSent.call()
                                                    .then(closeoutPaymentSent => closeoutPaymentSent.should.be.true),
                                            web3.eth.getBalanceAsync(contract.address)
                                                    .then(balance => web3.fromWei(balance).toString()
                                                            .should.be.equal('0')),
                                        ]))
                                )
                );
    });

    it('shouldn’t allow to withdraw a closeout payment that is already sent', () => {
        return createContract({price: '0.01'})
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal001}))
                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK, {from: defaultAccount}))
                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK, {from: counterpartyAccount}))
                        .then(() => contract.closeoutPaymentSent.call()
                                .then(closeoutPaymentSent => closeoutPaymentSent.should.be.true)
                        )
                        .then(() => expect(contract.withdrawCloseoutPayment({from: counterpartyAccount})).to.be.rejected)
                );
    });

    it('shouldn’t allow to withdraw a closeout payment if it equals 0', () => {
        return createContract({
            price: '0.01',
            downPaymentPct: web3.toWei(100), // but why?
            lateFeeRatePct: 0,
        })
                .then(contract => contract.sign({from: counterpartyAccount})
                        .then(() => contract.pay({value: contractTotal001}))
                        .then(() => contract.closeOut(123, {from: defaultAccount}))
                        .then(() => contract.closeOut(123, {from: counterpartyAccount}))
                        .then(() => Promise.all([
                            contract.lateFee.call()
                                    .then(closeoutPayment => web3.fromWei(closeoutPayment).toString()
                                            .should.be.equal('0')),
                            contract.closeoutPaymentSent.call()
                                    .then(closeoutPaymentSent => closeoutPaymentSent.should.be.false),
                        ]))
                        .then(() => expect(contract.withdrawCloseoutPayment({from: counterpartyAccount})).to.be.rejected)
                );
    });

    it('shouldn’t allow a non-contractor to withdraw a closeout payment', () => {
        return TestContractParty.new()
                .then(testContractParty => createContract({
                            price: '0.01',
                            counterparty: testContractParty.address,
                        })
                                .then(contract => testContractParty.sign(contract.address)
                                        .then(() => contract.pay({value: contractTotal001}))
                                        .then(() => testContractParty.closeOut(contract.address, 1888888888 + TimeInterval.WEEK))
                                        .then(() => contract.closeOut(1888888888 + TimeInterval.WEEK))
                                        .then(() => Promise.all([
                                            contract.closeoutPayment.call()
                                                    .then(closeoutPayment => web3.fromWei(closeoutPayment).toString()
                                                            .should.be.equal('0.0089')),
                                            contract.closeoutPaymentSent.call()
                                                    .then(closeoutPaymentSent => closeoutPaymentSent.should.be.false),
                                        ]))

                                        .then(() => expect(contract.withdrawCloseoutPayment()).to.be.rejected)
                                )
                );
    });
});