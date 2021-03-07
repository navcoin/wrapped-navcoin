var path = require('path');
var Web3 = require('web3');
const bitcore = require('bitcore-lib');

var HDWalletProvider = require("truffle-hdwallet-provider");

const fs = require('fs');

const config = JSON.parse(fs.readFileSync("config.json").toString());

let PRIVATE_KEY = config["privateKey"];
const PRIVATE_KEY_NAV = config["privateKeyNav"];

if (!PRIVATE_KEY_NAV)
{
  console.log("Generating NAV private key...");
  console.log("Please don't forget to back up config.json!");
  PRIVATE_KEY_NAV = bitcore.HDPrivateKey().toString();
  config["privateKeyNav"] = PRIVATE_KEY_NAV;
}

const XPUBKEY = bitcore.HDPrivateKey(PRIVATE_KEY_NAV).hdPublicKey.toString();

var foundPubKey = false;

for (var i in config["coldStorage"]["keys"])
{
    var key = config["coldStorage"]["keys"][i];
    if (key == XPUBKEY)
    {
        foundPubKey = true;
        break;
    }
}

if (!foundPubKey)
{
    config["coldStorage"]["keys"].push(XPUBKEY);
}

config["publicKeyNav"] = XPUBKEY;

fs.writeFileSync("config.json", JSON.stringify(config, null, 4));

module.exports = {
  compilers: {
    solc: {
      version: "^0.6.0",
    }
  },
  contracts_build_directory: path.join(__dirname, "/dapp/src/contracts"),
  contracts_directory: path.join(__dirname, "/contracts"),
  networks: {
    development: {
      provider: function() {
        return PRIVATE_KEY ? new HDWalletProvider(PRIVATE_KEY, config["networks"]["123"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["123"]["ethProvider"])
      },
      wsprovider: function() {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config["networks"]["123"]["ethWssProvider"])
        if (!PRIVATE_KEY) return webSocketProvider;
        HDWalletProvider.prototype.on = webSocketProvider.on.bind(webSocketProvider)
        return new HDWalletProvider(PRIVATE_KEY, webSocketProvider)
      },
      gas: 6000000,
      gasPrice: 40000000000,
      network_id: "123" // Match any network id
    },
    bscmainnet: {
      provider: function() {
        return PRIVATE_KEY ? new HDWalletProvider(PRIVATE_KEY, config["networks"]["56"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["56"]["ethProvider"])
      },
      wsprovider: function() {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config["networks"]["56"]["ethWssProvider"])
        if (!PRIVATE_KEY) return webSocketProvider;
        HDWalletProvider.prototype.on = webSocketProvider.on.bind(webSocketProvider)
        return new HDWalletProvider(PRIVATE_KEY, webSocketProvider)
      },
      gas: 6000000,
      gasPrice: 40000000000,
      network_id: "56" // Match any network id
    },
    bsctestnet: {
      provider: function() {
        return PRIVATE_KEY ? new HDWalletProvider(PRIVATE_KEY, config["networks"]["97"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["97"]["ethProvider"])
      },
      wsprovider: function() {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config["networks"]["97"]["ethWssProvider"])
        if (!PRIVATE_KEY) return webSocketProvider;
        HDWalletProvider.prototype.on = webSocketProvider.on.bind(webSocketProvider)
        return new HDWalletProvider(PRIVATE_KEY, webSocketProvider)
      },
      gas: 6000000,
      gasPrice: 40000000000,
      network_id: "97" // Match any network id
    },
    ropsten: {
      provider: function() {
        return PRIVATE_KEY ? new HDWalletProvider(PRIVATE_KEY, config["networks"]["3"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["3"]["ethProvider"])
      },
      wsprovider: function() {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config["networks"]["3"]["ethWssProvider"])
        if (!PRIVATE_KEY) return webSocketProvider;
        HDWalletProvider.prototype.on = webSocketProvider.on.bind(webSocketProvider)
        return new HDWalletProvider(PRIVATE_KEY, webSocketProvider)
      },
      network_id: "3",
      gas: 6000000
    }
  },
};
