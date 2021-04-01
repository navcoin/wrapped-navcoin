const fs = require('fs');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const Wnav = artifacts.require('WNAV');
const config = JSON.parse(fs.readFileSync("../config.json").toString());

const PRIVATE_KEY = config["privateKey"];
const MINTER = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY).address
const MINTER_ROLE = web3.utils.sha3("MINTER_ROLE");

const FEE_ADDRESS = config["ethFeeAddress"];

module.exports = async function (deployer) {
  const instance = await deployProxy(Wnav, ["Wrapped Navcoin", "WNAV"], { deployer });
  var token = await Wnav.deployed()
  console.log('Deployed', instance.address);

  await token.grantRole(MINTER_ROLE, MINTER)
  console.log('Granted '+MINTER_ROLE+' to: '+MINTER);
  console.log('Sanity check: '+await token.hasRole(MINTER_ROLE, MINTER))

  await token.setFeeAddress(FEE_ADDRESS);
  console.log('Fees will be collected in address: '+await token.getFeeAddress())
};
