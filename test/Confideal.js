import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
chai.use(chaiAsPromised);
const expect = chai.expect;
chai.should();
import Promise from 'bluebird';

Promise.promisifyAll(web3.eth);

const Confideal = artifacts.require('../Confideal.sol');

contract('Confideal', accounts => {
    const deployAccount = accounts[0];

    it('should allow the contract owner to transfer ownership', () => {
        return Confideal.deployed().then(confideal => expect(
                confideal.setOwner(accounts[1])
                        .then(() => confideal.setOwner(deployAccount, {from: accounts[1]}))
        ).to.be.fulfilled);
    });

    it('shouldn’t allow the contract owner to transfer ownership to empty address', () => {
        return Confideal.deployed().then(confideal => expect(
                confideal.setOwner('0x0')
        ).to.be.rejected);
    });

    it('shouldn’t allow non-owner to change an owner', () => {
        return Confideal.deployed().then(confideal => expect(
                confideal.setOwner(accounts[1], {from: accounts[1]})
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
                web3.eth.sendTransactionAsync({from: accounts[0], to: confideal.address, value: 123456789})
        ).to.be.rejected);
    });
});