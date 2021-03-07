const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const Wnav = artifacts.require('WNAV');

module.exports = async function (deployer) {
  const instance = await deployProxy(Wnav, ["Wrapped Navcoin", "WNAV"], { deployer });
  console.log('Deployed', instance.address);
};
