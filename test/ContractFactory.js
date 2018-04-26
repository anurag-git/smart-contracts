import * as Party from "../helpers/Party";
import * as TimeInterval from "../helpers/TimeInterval";
import * as ContractStage from '../helpers/ContractStage';

const ContractFactory = artifacts.require('ContractFactory');
const Contract = artifacts.require('Contract');

contract('ContractFactory', accounts => {
    const defaultAccount = accounts[0];
    const counterpartyAccount = accounts[5];

    const dataHash = '0xc15a0175e131a752d83e216abc4e4ff3377278f83d50c0bec9bc3460e68696d6';

    it('should create a contract', () => {
        const timeBefore = Math.floor(Date.now() / 1000);
        return ContractFactory.deployed()
            .then(ContractFactory => ContractFactory.createContract(
                dataHash,
                1477777777,
                Party.CLIENT,
                counterpartyAccount,
                web3.toWei('1.23456'),
                web3.toWei(0.1),
                1888888888,
                true,
                web3.toWei(0.01),
                TimeInterval.WEEK,
                web3.toWei(0.15),
                Party.CONTRACTOR
            ))
            .then(result => {
                assert.equal(result.logs.length, 1);
                assert.equal(result.logs[0].event, 'ContractCreated');

                const contract = Contract.at(result.logs[0].args.contractAddress);

                return Promise.all([
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
                    contract.advancePaymentRate.call()
                        .then(advancePaymentRate => advancePaymentRate.toString().should.be.equal(web3.toWei(0.1))),
                    contract.periodFrom.call()
                        .then(periodFrom => periodFrom.toNumber().should.be.equal(0)),
                    contract.periodTo.call()
                        .then(periodTo => periodTo.toNumber().should.be.equal(1888888888)),
                    contract.lateFeeRate.call()
                        .then(lateFeeRate => lateFeeRate.toString().should.be.equal(web3.toWei(0.01))),
                    contract.lateFeeInterval.call()
                        .then(lateFeeInterval => lateFeeInterval.toNumber().should.be.equal(TimeInterval.WEEK)),
                    contract.lateFeeMaxRate.call()
                        .then(lateFeeMaxRate => lateFeeMaxRate.toString().should.be.equal(web3.toWei(0.15))),
                    contract.confidealFeePayer.call()
                        .then(confidealFeePayer => confidealFeePayer.toString().should.be.equal(Party.CONTRACTOR)),
                    contract.advancePayment.call()
                        .then(advancePayment => advancePayment.toNumber().should.be.equal(web3.toWei(1.23456) * 0.09)),
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
                    contract.arbitrationClause.call()
                        .then(clause => clause.should.be.equal(true)),
                    contract.appealWindow.call()
                        .then(timeout => timeout.toNumber().should.be.equal(60 * 60 * 24 * 10)),
                    contract.appealsAvailable.call()
                        .then(appeals => appeals.toNumber().should.be.equal(1)),
                ]);
            });
    });
});