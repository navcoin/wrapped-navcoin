const fs = require('fs');

const config = JSON.parse(fs.readFileSync("../config.json").toString());
console.log(JSON.stringify({
  networks:config["networks"],
  publicKeyNav: config["publicKeyNav"],
  feeMint: config["feeMint"],
  coldStorage: config["coldStorage"],
  navConfirmations: config["navConfirmations"],
  ethConfirmations: config["ethConfirmations"],
  defaultNavFee: config[ "defaultNavFee"],
  signers: config["coldStorage"]["keys"]
}));
