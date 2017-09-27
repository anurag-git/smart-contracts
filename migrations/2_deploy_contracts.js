const Confideal = artifacts.require('Confideal.sol');

module.exports = function (deployer, network) {
    deployer.deploy(Confideal);
};
