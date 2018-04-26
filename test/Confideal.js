import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
chai.use(chaiAsPromised);
const expect = chai.expect;
chai.should();
import Promise from 'bluebird';
import BigNumber from 'bignumber.js';

Promise.promisifyAll(web3.eth);

const Confideal = artifacts.require('../Confideal.sol');
const ContractMock = artifacts.require('../ContractMock.sol');

contract('Confideal', accounts => {
    const deployAccount = accounts[0];
    const contractAddress = '0x22FC9A94D295Ad2a237eeE2621Cc424981dC1b77'
    const resolutionHash = '0xc15a0175e131a752d83e216abc4e4ff3377278f8';

    it('should allow the contract owner to transfer ownership', () => {
        return Confideal.deployed().then(confideal => expect(
                confideal.transferOwnership(accounts[1])
                        .then(() => confideal.transferOwnership(deployAccount, {from: accounts[1]}))
        ).to.be.fulfilled);
    });

    it('shouldn’t allow the contract owner to transfer ownership to empty address', () => {
        return Confideal.deployed().then(confideal => expect(
                confideal.transferOwnership('0x0')
        ).to.be.rejected);
    });

    it('shouldn’t allow non-owner to change an owner', () => {
        return Confideal.deployed().then(confideal => expect(
                confideal.transferOwnership(accounts[1], {from: accounts[1]})
        ).to.be.rejected);
    });

    it('should set the contract owner as a beneficiary by default', () => {
        return Confideal.deployed().then(confideal => confideal.beneficiary.call()
                .then(beneficiary => beneficiary.should.be.equal(deployAccount)));
    });

    it('should allow the contract owner to change a beneficiary', () => {
        return Confideal.deployed().then(confideal => confideal.setBeneficiary(accounts[1])
                .then(() => confideal.beneficiary.call())
                .then(beneficiary => beneficiary.should.be.equal(accounts[1]))
                .then(() => confideal.setBeneficiary(deployAccount)));
    });

    it('shouldn’t allow non-owner to change a beneficiary', () => {
        return Confideal.deployed().then(confideal => expect(
                confideal.setBeneficiary(accounts[1], {from: accounts[1]})
        ).to.be.rejected);
    });

    it('should allow beneficiary to withdraw funds', () => {
        return Confideal.deployed().then(confideal => web3.eth.getBalanceAsync(deployAccount)
                .then(balanceBefore => {
                    return confideal.fee({from: accounts[5], value: web3.toWei(1)})
                            .then(() => confideal.withdraw())
                            .then(() => web3.eth.getBalanceAsync(deployAccount))
                            .then(balance => balance.toString()
                                    .should.be.at.least(balanceBefore.add(web3.toWei('0.99')).toString())); // minus gas
                }));
    });

    it('shouldn’t allow non-beneficiary to withdraw funds', () => {
        return Confideal.deployed().then(confideal => confideal.fee({from: accounts[5], value: web3.toWei(1)})
                .then(() => expect(confideal.withdraw({from: accounts[1]})).to.be.rejected));
    });

    it('shouldn’t accept incoming ETH transfers', () => {
        return Confideal.deployed().then(confideal => expect(
            confideal.sendTransaction({from: accounts[0], to: confideal.address, value: 123456789})
        ).to.be.rejected);
    });

    it('shouldn’t allow non-owner to update arbiters list', () => {
        return Confideal.deployed()
            .then(confideal => expect(
                confideal.setArbiter(contractAddress, accounts[1],
                    { from: accounts[1] })).to.be.rejected);
    });

    it('should allow owner to update arbiters list', () => {
        return Confideal.deployed()
            .then(confideal => confideal.setArbiter(contractAddress, accounts[1], { from: deployAccount })
                .then(() => confideal.arbiters.call(contractAddress)
                    .then(addr => addr.should.be.equal(accounts[1])))
            );
    });

    it('shouldn’t allow to resolve dispute from unassigned arbiter', () => {
        return Confideal.deployed()
            .then(confideal => expect(
                confideal.resolveDispute(contractAddress,
                    resolutionHash, web3.toWei('0.33'), web3.toWei('0.67'), { from: accounts[1] })).to.be.rejected);
    });

    it('should allow to resolve dispute from assigned arbiter', () => {
        return Confideal.deployed()
            .then(confideal => ContractMock.new(confideal.address)
                .then(mock => confideal.setArbiter(mock.address, accounts[1], { from: deployAccount })
                    .then(() => expect(confideal.resolveDispute(mock.address,
                        resolutionHash, web3.toWei('0.33'), web3.toWei('0.67'), { from: accounts[1] })).to.be.not.rejected))
            );
    });

    it('should calculate arbitration fee properly', () => {
        const dealPrice = 1500;
        const newFee = 0.1 * 1500; // 10% of deal price
        return Confideal.deployed().then(confideal => ContractMock.new(confideal.address)
            .then(mock => mock.pay({ value: dealPrice })
                .then(() => confideal.calculateArbitrationFee.call(mock.address)
                    .then(fee => fee.toNumber().should.be.equal(newFee))))
        );
    });

    it('should allow to set confideal arbitration fee only from owner account', () => {
        const feeRate = web3.toWei('0.30');
        return Confideal.deployed()
            .then(confideal => 
                expect(confideal.setConfidealArbitrationFee(feeRate, { from: accounts[1] })).to.be.rejected
        );
    });

    it('should set confideal arbitration fee properly', () => {
        const feeRate = web3.toWei('0.30');
        return Confideal.deployed()
            .then(confideal => confideal.setConfidealArbitrationFee(feeRate, { from: deployAccount })
                .then(() => confideal.confidealArbitrationFeeRate.call()
                    .then(rate => rate.toString().should.be.equal(feeRate)))
        );
    });

    it('should allow to set timeout after resolution only from owner account', () => {
        const timeout = 60 * 60 * 24 * 9;
        return Confideal.deployed()
            .then(confideal => 
                expect(confideal.setAppealWindow(timeout, { from: accounts[1] })).to.be.rejected
        );
    });

    it('should set timeout after resolution properly', () => {
        const newTimeout = 60 * 60 * 24 * 9;
        return Confideal.deployed()
            .then(confideal => confideal.setAppealWindow(newTimeout, { from: deployAccount })
                .then(() => confideal.appealWindow.call()
                    .then(timeout => timeout.toNumber().should.be.equal(newTimeout)))
        );
    });

    it('shouldn’t collect arbitration fee with incorrect payment', () => {
        const dealPrice = 1500;
        return Confideal.deployed().then(confideal => ContractMock.new(confideal.address)
            .then(mock => mock.pay({ value: dealPrice })
                .then(() => expect(
                    confideal.collectArbitrationFee(mock.address, { value: dealPrice })).to.be.rejected))
        );
    });

    it('shouldn’t collect arbitration fee without arbiter assigned', () => {
        const dealPrice = 1500;
        return Confideal.deployed().then(confideal => ContractMock.new(confideal.address)
            .then(mock => mock.pay({ value: dealPrice })
                .then(() => expect(
                    confideal.collectArbitrationFee(mock.address, { value: dealPrice * 0.1 })).to.be.rejected))
        );
    });

    it('should collect arbitration fee properly', () => {
        const dealPrice = 1500;
        const newReward = 1500 * 0.1 * (1 - 0.3); // 10% of deal price minus 30% confideal fee
        return Confideal.deployed().then(confideal => ContractMock.new(confideal.address)
            .then(mock => mock.pay({ value: dealPrice })
                .then(() => confideal.setArbiter(mock.address, accounts[1], { from: deployAccount }))
                .then(() => mock.withdrawArbiterPayment())
                .then(() => confideal.arbiterFees.call(accounts[1])
                    .then(reward => reward.toNumber().should.be.equal(newReward)))
            )
        );
    });

    it('shouldn’t allow to withdraw arbitration fee from unassigned arbiter', () => {
        return Confideal.deployed().then(confideal => ContractMock.new(confideal.address)
            .then(mock => expect(
                confideal.withdrawArbitrationFee(mock.address, { from: accounts[1] })).to.be.rejected)
        );
    });

    it('should allow to withdraw arbitration fee from assigned arbiter', () => {
        return Confideal.deployed().then(confideal => ContractMock.new(confideal.address)
            .then(mock => confideal.setArbiter(mock.address, accounts[1], { from: deployAccount })
                .then(() => expect(
                    confideal.withdrawArbitrationFee(mock.address, { from: accounts[1] })).to.be.not.rejected))
        );
    });

    it('shouldn’t allow to withdraw arbitration rewards with 0 rewards', () => {
        return Confideal.deployed()
            .then(confideal => expect(
                    confideal.withdrawArbitrationRewards({ from: accounts[3] })).to.be.rejected
        );
    });

    it('should reset arbiter rewards after withdraw', () => {
        return Confideal.deployed()
            .then(confideal => confideal.withdrawArbitrationRewards({ from: accounts[1] })
                .then(() => confideal.arbiterFees.call(accounts[1])
                    .then(reward => reward.toNumber().should.be.equal(0)))
        );
    });

    it('should set min arbitration fee properly', () => {
        const newFee = web3.toWei('0.33');
        return Confideal.deployed()
            .then(confideal => confideal.setMinArbitrationFee(newFee, { from: deployAccount })
                .then(() => confideal.minArbitrationFee.call()
                    .then(fee => fee.toString().should.be.equal(newFee)))
        );
    });

    it('should set appeals limit properly', () => {
        const newLimit = 13;
        return Confideal.deployed()
            .then(confideal => confideal.setAppealsLimit(newLimit, { from: deployAccount })
                .then(() => confideal.appealsLimit.call()
                    .then(limit => limit.toNumber().should.be.equal(newLimit)))
        );
    });
});