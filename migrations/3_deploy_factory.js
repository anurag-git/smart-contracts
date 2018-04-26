const Confideal = artifacts.require('./Confideal.sol');
const ContractFactory = artifacts.require('./ContractFactory.sol');

module.exports = (deployer) => {
    deployer.deploy(ContractFactory, Confideal.address);
};
