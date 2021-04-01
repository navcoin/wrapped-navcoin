var path = require('path');
var Web3 = require('web3');
const bitcore = require('bitcore-lib');
const web3 = new Web3();

var HDWalletProvider = require("truffle-hdwallet-provider");

const fs = require('fs');

const config = JSON.parse(fs.readFileSync("config.json").toString());

let PRIVATE_KEY = config["privateKey"];
let PRIVATE_KEY_DEPLOYER = config["privateKeyDeploy"];
let PRIVATE_KEY_NAV = config["privateKeyNav"];

if (!PRIVATE_KEY_NAV || !PRIVATE_KEY)
{
  if (!PRIVATE_KEY_NAV)
  {
    console.log("Generating NAV private key...");
    PRIVATE_KEY_NAV = bitcore.HDPrivateKey().toString();
    config["privateKeyNav"] = PRIVATE_KEY_NAV;
  }

  console.log("Please don't forget to back up config.json!\n");
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
        return PRIVATE_KEY_DEPLOYER ? new HDWalletProvider(PRIVATE_KEY_DEPLOYER, config["networks"]["123"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["123"]["ethProvider"])
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
        return PRIVATE_KEY_DEPLOYER ? new HDWalletProvider(PRIVATE_KEY_DEPLOYER, config["networks"]["56"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["56"]["ethProvider"])
      },
      wsprovider: function() {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config["networks"]["56"]["ethWssProvider"], {
          clientConfig: {
            maxReceivedFrameSize: 100000000,
            maxReceivedMessageSize: 100000000,
          }
        })
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
        return PRIVATE_KEY_DEPLOYER ? new HDWalletProvider(PRIVATE_KEY_DEPLOYER, config["networks"]["97"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["97"]["ethProvider"])
      },
      wsprovider: function() {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config["networks"]["97"]["ethWssProvider"], {
          clientConfig: {
            maxReceivedFrameSize: 100000000,
            maxReceivedMessageSize: 100000000,
          }
        })
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
        return PRIVATE_KEY_DEPLOYER ? new HDWalletProvider(PRIVATE_KEY_DEPLOYER, config["networks"]["3"]["ethProvider"]) : new Web3.providers.HttpProvider(config["networks"]["3"]["ethProvider"])
      },
      wsprovider: function() {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config["networks"]["3"]["ethWssProvider"], {
          clientConfig: {
            maxReceivedFrameSize: 100000000,
            maxReceivedMessageSize: 100000000,
          }
        })
        if (!PRIVATE_KEY) return webSocketProvider;
        HDWalletProvider.prototype.on = webSocketProvider.on.bind(webSocketProvider)
        return new HDWalletProvider(PRIVATE_KEY, webSocketProvider)
      },
      network_id: "3",
      gas: 6000000
    }
  },
};
