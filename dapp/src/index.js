import MetaMaskOnboarding from '@metamask/onboarding'
import ElectrumClient from '@codewarriorr/electrum-client-js'
import Bitcore from 'bitcore-lib'
import QRCode from 'qrcode'
import $ from 'jquery'
import * as toastr from 'toastr';
import css from './/../node_modules/toastr/build/toastr.css';
import moment from 'moment';
import * as Mutex from 'async-mutex';

let NAVETH = 0
let NAVBTC = 0
let ETHBTC = 0
let FETCH_PRICE_FREQUENCY = 900
let lastPriceCheck = 0

var mutex = new Mutex.Mutex();

toastr.options = {
  "closeButton": false,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-top-right",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "3000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}

const Web3 = require("web3");
const forwarderOrigin = 'http://localhost:9010'

let config

$.ajax({
  dataType: "json",
  url: "settings.json",
  data: "",
  async: false,
  success: function(data) {
    config = data;
  }
});

const XPUBKEY = config["publicKeyNav"];
const electrumConfig = config["networks"];
const FEEMINT = config["feeMint"];
let DEFAULT_TX_FEE = config["defaultNavFee"];

console.log("Default withdrawal fee "+DEFAULT_TX_FEE);

const isMetamaskInstalled = () => {
  if (window.ethereum) {
    window.Web3 = new Web3(window.ethereum);
  }

  const { ethereum } = window

  return Boolean(ethereum && ethereum.isMetaMask)
}

const isBinanceInstalled = () => {
  console.log("checking binance chain installed? "+JSON.stringify(window.BinanceChain))

  if (window.BinanceChain) {
    console.log("binance chain instalado")
    window.Web3 = new Web3(window.BinanceChain);
  }

  const ethereum = window.BinanceChain

  return Boolean(ethereum && ethereum.isMetaMask)
}

let client = new ElectrumClient(
  electrumConfig[56]["electrum_host"],
  electrumConfig[56]["electrum_port"],
  "wss"
)

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

const checkmark = '<span class="checkmark"><div class="checkmark_stem"></div><div class="checkmark_kick"></div></span>';

const networkNames = { '1': 'Ethereum Mainnet', '3': 'Ethereum Ropsten', '97': 'Binance Smart Chain Testnet', '56': 'Binance Smart Chain Mainnet' };

// Dapp Status Section
const networkDiv = document.getElementById('network')
const chainIdDiv = document.getElementById('chainId')
const navAddress = document.getElementById('navAddress')
const connectDiv = document.getElementById('connectDiv')
const registerDiv = document.getElementById('registerDiv')
const depositAddressQR = document.getElementById('depositAddressQR')
const contentDiv = document.getElementById('contentDiv')
const withdrawBtn = document.getElementById('withdrawBtn')
const swapBtn = document.getElementById('swapBtn')
const withdrawAmount = document.getElementById('withdrawAmount')
const withdrawModal = document.getElementById('withdrawModal')
const withdrawAmountLabel = document.getElementById('withdrawAmountLabel')
const withdrawFeeLabel = document.getElementById('withdrawFeeLabel')
const historyDiv = document.getElementById('historyDiv')
const networkName = document.getElementById('networkName')

const pendingLoader = document.getElementById('pendingLoader')
const pendingDiv = document.getElementById('pendingDiv')
const pendingSpan = document.getElementById('pendingSpan')
const estimatedGas = document.getElementById('estimatedGas')
const estimatedGasDiv = document.getElementById('estimatedGasDiv')

const onboardButton = document.getElementById('connectButton')
const requestPermissionsButton = document.getElementById('requestPermissions')
const wnavBalance = document.getElementById('wnavBalance')
const wnavBalanceWithdraw = document.getElementById('wnavBalance2')
const addTokenLink = document.getElementById('addTokenLink')
const historyTbl = document.getElementById('historyTbl')
const navSupply = document.getElementById('navSupply')
const wnavSupply = document.getElementById('wnavSupply')
const pendingWithdrawalSupply = document.getElementById('pendingWithdrawalSupply')
const contractAddressSpan = document.getElementById('contractAddressSpan');
const footerSpan = document.getElementById('footerSpan');
const availableNetworks = document.getElementById('availableNetworks');

let contractData = {}
let contractAddress = ""
let contract = undefined
let globalNetworkId = 56
let navNetwork = 'mainnet'
let navAddressStr = ''
let navAddressObj
let scriptHash
let wBal = 0
let gasSize = 107552;
let gasPrice = 0;
let gasCost = 0;
let lastNavBlock = -1;
let lastEthBlock = -1;
let coldStorageScriptHash
let coldStorageScript
let blockLoop = 0;
let cacheNavTx = {};
let history = [];
let processedNav = {};
let processedNavCold = {};
let burns = {};
let totalBurntValue = 0;

function dumpError(err) {
  if (typeof err === 'object') {
    if (err.message) {
      console.log('\nMessage: ' + err.message)
    }
    if (err.stack) {
      console.log('\nStacktrace:')
      console.log('====================')
      console.log(err.stack);
    }
  } else {
    console.log('dumpError :: argument is not an object');
  }
}

const initialize = async () => {

  let onboarding
  try {
    onboarding = new MetaMaskOnboarding({ forwarderOrigin })
  } catch (error) {
    console.error(error)
  }

  let accounts
  let piggybankContract
  let accountButtonsInitialized = false

  const accountButtons = [
  ]

  const isMetaMaskConnected = () => accounts && accounts.length > 0

  const onClickInstall = () => {
    onboardButton.innerText = 'Onboarding in progress'
    onboardButton.disabled = true
    connectDiv.classList.remove('d-none')
    onboarding.startOnboarding()
  }

  withdrawAmount.onkeyup = () => {
    withdrawFeeLabel.innerHTML = parseInt(DEFAULT_TX_FEE)/100000000
    withdrawAmountLabel.innerHTML = parseFloat(withdrawAmount.value)-(parseInt(DEFAULT_TX_FEE)/100000000)
  }

  const onClickConnect = async () => {
    try {
      const newAccounts = await ethereum.request({
        method: 'eth_requestAccounts',
      })
      handleNewAccounts(newAccounts)
    } catch (error) {
      console.error(error)
    }
  }

  const onClickRegister = async () => {
    try {
      if (isMetaMaskConnected() && contract && contract.methods && contract.methods.register)
      {
        requestPermissionsButton.innerText = 'Registering... please wait!'
        requestPermissionsButton.disabled = true

        contract.methods.register().send({from:accounts[0], nonce: await window.Web3.eth.getTransactionCount(accounts[0])}).on("txHash", (hash) => {
          requestPermissionsButton.innerText = 'Registering... please wait!'
          requestPermissionsButton.disabled = true
        }).on("error", (error) => {
          requestPermissionsButton.innerText = 'Something failed! Try again to register'
          requestPermissionsButton.disabled = false
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  const NewNavBlockHeader = async (event) => {
    lastNavBlock = event[0].height;
    console.log("New NAV block: "+ lastNavBlock);
  }

  const NewBlockHeader = async () => {
    gasPrice = await window.Web3.eth.getGasPrice()/1000000000;

    var block = await window.Web3.eth.getBlock('latest')

    if (!block) return;

    lastEthBlock = block.number;

    if (NAVBTC > 0 && ETHBTC > 0)
      NAVETH = NAVBTC / ETHBTC;

    if (!electrumConfig[globalNetworkId])
    {
      connectDiv.classList.add('d-none')
      registerDiv.classList.add('d-none')
      contentDiv.classList.add('d-none')
      footerSpan.classList.add('d-none')
      warningDiv.classList.remove('d-none')
      return;
    }

    if (lastPriceCheck < Math.floor(Date.now() / 1000))
    {
      $.getJSON("https://api.binance.com/api/v3/klines?symbol=NAVBTC&interval=15m&limit=2", (data) => {
        NAVBTC = data[0][4];
      });

      $.getJSON("https://api.binance.com/api/v3/klines?symbol="+electrumConfig[globalNetworkId]["baseCurrency"]+"BTC&interval=15m&limit=2", (data) => {
        ETHBTC = data[0][4];
      });

      lastPriceCheck = Math.floor(Date.now() / 1000) + FETCH_PRICE_FREQUENCY;

      console.log("Last NAV"+electrumConfig[globalNetworkId]["baseCurrency"]+" price: "+NAVETH);
    }

    estimatedGasDiv.classList.remove('d-none')

    var mintCost = (gasSize*gasPrice)/100000000;

    gasCost = FEEMINT * (NAVETH / mintCost);

    if (gasCost > 0)
      estimatedGas.innerHTML = parseFloat(parseInt(gasCost * 100)/100);

    if (contract)
    {
      DEFAULT_TX_FEE = await contract.methods.getMinFee().call();
      withdrawFeeLabel.innerHTML = parseInt(DEFAULT_TX_FEE)/100000000
      withdrawAmountLabel.innerHTML = withdrawAmount.value?(parseFloat(withdrawAmount.value)-(parseInt(DEFAULT_TX_FEE)/100000000)):0
      GetHistory()
    }

    CheckRegistered()
    UpdateBalance()
  }

  const CheckRegistered = () => {
    try {
      if (isMetaMaskConnected() && contract && contract.methods)
      {
        contract.methods.isRegistered(window.Web3.utils.toChecksumAddress(accounts[0])).call().then((result, err) => {
          if (err){
            connectDiv.classList.add('d-none')
            registerDiv.classList.remove('d-none')
            contentDiv.classList.add('d-none')
            footerSpan.classList.add('d-none')
            addTokenLink.classList.add('d-none')
          } else if (result) {
            connectDiv.classList.add('d-none')
            registerDiv.classList.add('d-none')
            contentDiv.classList.remove('d-none')
            footerSpan.classList.remove('d-none')
            addTokenLink.classList.remove('d-none')
          } else if (!result) {
            connectDiv.classList.add('d-none')
            registerDiv.classList.remove('d-none')
            contentDiv.classList.add('d-none')
            footerSpan.classList.add('d-none')
            addTokenLink.classList.remove('d-none')
          }
        });
      }
    }
    catch(e)
    {
    }
  }

  const updateButtons = () => {
    if (!isMetamaskInstalled()) {
      onboardButton.innerText = 'Click here to install MetaMask!'
      onboardButton.onclick = onClickInstall
      onboardButton.disabled = false
      connectDiv.classList.remove('d-none')
      registerDiv.classList.add('d-none')
      contentDiv.classList.add('d-none')
      footerSpan.classList.add('d-none')
      addTokenLink.classList.add('d-none')
      requestPermissionsButton.disable = true
    } else if (isMetaMaskConnected()) {
      onboardButton.innerText = 'Connected'
      onboardButton.disabled = true
      connectDiv.classList.add('d-none')
      registerDiv.classList.remove('d-none')
      contentDiv.classList.add('d-none')
      footerSpan.classList.add('d-none')
      addTokenLink.classList.remove('d-none')
      requestPermissionsButton.onclick = onClickRegister
      addTokenLink.onclick = addTokenMetamask
      requestPermissionsButton.disable = false
      if (onboarding) {
        onboarding.stopOnboarding()
      }
    } else {
      onboardButton.innerText = 'Connect'
      onboardButton.onclick = onClickConnect
      onboardButton.disabled = false
      connectDiv.classList.remove('d-none')
      registerDiv.classList.add('d-none')
      contentDiv.classList.add('d-none')
      footerSpan.classList.add('d-none')
      addTokenLink.classList.add('d-none')
      requestPermissionsButton.disable = true
    }

    window.Web3.eth.subscribe('newBlockHeaders' , NewBlockHeader);

    swapBtn.onclick = async () => {
      try {
        if (isMetaMaskConnected() && contract && contract.methods && contract.methods.register)
        {
          if (withdrawAmount.value > wBal || withdrawAmount.value <= 0)
          {
            toastr.error("Amount is incorrect.", "Error!")
          }
          else if (withdrawAddress.value == "" || !Bitcore.Address.isValid(withdrawAddress.value, navNetwork))
          {
            toastr.error("The withdrawal NAV address is incorrect.", "Error!")
          }
          else {
            contract.methods.burnWithNote(withdrawAmount.value*100000000, withdrawAddress.value).send({from:accounts[0], nonce: await window.Web3.eth.getTransactionCount(accounts[0])}).on("txHash", (hash) => {
              toastr.success("Swap has been initiated!", "Ok!")
            })
          }
        }
      } catch (error) {
        console.error(error)
      }
      withdrawAmount.value= ""
      withdrawAddress.value = ""
      withdrawFeeLabel.innerHTML = 0
    }

    CheckRegistered();
  }

  const UpdateBalance = async () => {
    console.log('updating')
    try {
      if (isMetaMaskConnected() && contract && contract.methods)
      {
        contract.methods.balanceOf(window.Web3.utils.toChecksumAddress(accounts[0])).call().then((result, err) => {
          if (err){
            wBal = 0
            wnavBalance.innerHTML = 0
            wnavBalanceWithdraw.innerHTML = 0
          } else if (result) {
            wBal = result/100000000
            wnavBalance.innerHTML = (result/100000000).toLocaleString()
            wnavBalanceWithdraw.innerHTML = result/100000000
          } else if (!result) {
            wBal = 0
            wnavBalance.innerHTML = 0
            wnavBalanceWithdraw.innerHTML = 0
          }
        });
        contract.methods.totalSupply().call().then((result, err) => {
          if (err){
            wnavSupply.innerHTML = 0
          } else if (result) {
            wnavSupply.innerHTML = (result/100000000).toLocaleString()
          } else if (!result) {
            wnavSupply.innerHTML = 0
          }
        });

      }

      if (client && lastNavBlock != -1 && gasCost != 0)
      {
        const navcoldsupply = await client.blockchain_scripthash_listunspent(coldStorageScriptHash)

        var bal = 0;

        for (var i = 0; i < navcoldsupply.length; i++)
        {
          var txout = navcoldsupply[i];
          bal += txout.value;
        }

        if (bal > 0)
          navSupply.innerHTML = (bal/100000000).toLocaleString()
        else
          navSupply.innerHTML = 0

        const scripthashStatus = await client.blockchain_scripthash_listunspent(scriptHash)
        var pendingBalance = 0;

        for (var i = 0; i < scripthashStatus.length; i++)
        {
          var txout = scripthashStatus[i];
          if (txout.height == 0)
          {
            //continue;
          }
          if (lastNavBlock - txout.height < config["navConfirmations"])
          {
            //continue;
          }
          //if (txout.value < gasCost) continue;
          await contract.methods.existsMint(txout.tx_hash+":"+txout.tx_pos).call().then((result, err) => {
            if (!err && !result){
              pendingBalance += txout.value;
            }
          });
        }

        pendingSpan.innerHTML = pendingBalance/100000000;

        if (pendingBalance > 0)
        {
          pendingDiv.classList.remove('d-none')
        }
        else
        {
          pendingDiv.classList.add('d-none')
        }

        pendingLoader.classList.add('d-none')

        await client.server_ping()
      }
    }
    catch(e)
    {
      console.log('error '+e)
      wnavBalance.innerHTML = 0
      wnavBalanceWithdraw.innerHTML = 0
      wBal = 0
    }
  }

  const UpdateNavDepositAddress = () => {
    navAddressObj = Bitcore.HDPublicKey(XPUBKEY).deriveChild(window.Web3.utils.toChecksumAddress(accounts[0]) + globalNetworkId + (String(globalNetworkId).length % 2 ? '0' : '') + contractAddress.substr(2)).publicKey.toAddress(navNetwork)
    navAddressStr = navAddressObj.toString()
    navAddress.innerHTML = navAddressStr
    scriptHash =  Buffer.from(Bitcore.crypto.Hash.sha256(Bitcore.Script.buildPublicKeyHashOut(navAddressObj).toBuffer()).reverse()).toString("hex")
    QRCode.toCanvas(depositAddressQR, navAddressStr, function (error) {
    })
  }

  const initializeAccountButtons = () => {

    if (accountButtonsInitialized) {
      return
    }
    accountButtonsInitialized = true
  }

  function handleNewAccounts (newAccounts) {
    accounts = newAccounts

    estimatedGasDiv.classList.add('d-none')
    footerSpan.classList.add('d-none')
    contentDiv.classList.add('d-none')

    RestartSubscriptions()

    UpdateNavDepositAddress()

    if (isMetaMaskConnected()) {
      initializeAccountButtons()
    }
    updateButtons()
  }

  function handleNewChain (chainId) {
    estimatedGasDiv.classList.add('d-none')
    footerSpan.classList.add('d-none')
    contentDiv.classList.add('d-none')
  }

  const addTokenMetamask = async function () {
    if (contractData.networks && contractData.networks[globalNetworkId])
    {
      try {
        // wasAdded is a boolean. Like any RPC method, an error may be thrown.
        const wasAdded = await ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20', // Initially only supports ERC20, but eventually more!
            options: {
              address: window.Web3.utils.toChecksumAddress(contractData.networks[globalNetworkId].address), // The address that the token is at.
              symbol: "wNAV", // A ticker symbol or shorthand, up to 5 chars.
              decimals: 8, // The number of decimals in the token
              image: "https://raw.githubusercontent.com/navcoin/navcoin-core/master/src/qt/res/icons/mininav.svg", // A string url of the token logo
            },
          },
        });
      } catch (error) {
        dumpError(error);
      }
    }
  }

  async function handleNewNetwork (networkId) {
    estimatedGasDiv.classList.add('d-none')
    contentDiv.classList.add('d-none')
    footerSpan.classList.add('d-none')

    console.log("New network id "+networkId);

    globalNetworkId = networkId
    if (networkId == 1 || networkId == 56) {
      navNetwork = 'mainnet'
    } else {
      navNetwork = 'testnet'
    }

    if (networkId == 56) blockLoop = 6139248;
    if (networkId == 97) blockLoop = 0;

    history = [];
    processedNav = {};
    processedNavCold = {};
    burns = {};
    totalBurntValue = 0;

    networkName.innerHTML = networkNames[globalNetworkId];

    $.getJSON("https://api.binance.com/api/v3/klines?symbol=NAVBTC&interval=15m&limit=2", (data) => {
      NAVBTC = data[0][4];
      if (ETHBTC > 0)
        NewBlockHeader();
    });

    $.getJSON("https://api.binance.com/api/v3/klines?symbol="+electrumConfig[globalNetworkId]["baseCurrency"]+"BTC&interval=15m&limit=2", (data) => {
      ETHBTC = data[0][4];
      if (NAVBTC > 0)
        NewBlockHeader();
    });

    if (contractData.networks && contractData.networks[networkId])
    {
      contractAddress = window.Web3.utils.toChecksumAddress(contractData.networks[networkId].address);
      contract = new window.Web3.eth.Contract(contractData.abi, contractAddress);
      contractAddressSpan.innerHTML = contractAddress;

      UpdateBalance()
    }
    else
    {
      contract = undefined
      connectDiv.classList.add('d-none')
      registerDiv.classList.add('d-none')
      contentDiv.classList.add('d-none')
      footerSpan.classList.add('d-none')
      warningDiv.classList.remove('d-none')
      return;
    }

    var coldAddresses = [];

    for (var i in config["coldStorage"]["keys"]) {
      var obj = config["coldStorage"]["keys"][i];

      const childPath = "0x" + globalNetworkId + (String(globalNetworkId).length % 2 ? '0' : '') + contractAddress.substr(2) + "c01d";
      var navObj = Bitcore.HDPublicKey(obj).deriveChild(childPath).publicKey

      coldAddresses.push(navObj);
    }


    var multisigScript = Bitcore.Script.buildMultisigOut(coldAddresses, config["coldStorage"]["requiredSigs"])
    coldStorageScript = new Bitcore.Script.fromAddresses(electrumConfig[globalNetworkId]["stakingPoolAddress"], multisigScript)
    coldStorageScriptHash =  Buffer.from(Bitcore.crypto.Hash.sha256(coldStorageScript.toBuffer()).reverse()).toString("hex")

    if (contract)
      GetHistory()

    RestartSubscriptions()

    UpdateNavDepositAddress()

    updateButtons()

    if (contract == undefined)
    {
      connectDiv.classList.add('d-none')
      registerDiv.classList.add('d-none')
      contentDiv.classList.add('d-none')
      footerSpan.classList.add('d-none')
      warningDiv.classList.remove('d-none')
    }
    else {
      warningDiv.classList.add('d-none')
    }
  }

  async function GetNavTx(hash) {
    if (cacheNavTx[hash]) return cacheNavTx[hash];
    var tx = await client.blockchain_transaction_get(hash, true);
    cacheNavTx[hash] = tx;
    return cacheNavTx[hash];
  }

  async function GetHistory() {
    await mutex
    .runExclusive(async function() {
      if (isMetaMaskConnected() && contract && contract.methods && contract.methods.register && lastNavBlock != -1 && lastEthBlock != -1)
      {
        var coldScriptHistory = await client.blockchain_scripthash_getHistory(coldStorageScriptHash)

        while (blockLoop < lastEthBlock)
        {
          //console.log("checking from "+blockLoop+" to "+Math.min(blockLoop+5000,lastEthBlock));
          await contract.getPastEvents(
          "Registered",
          { fromBlock: blockLoop, toBlock: Math.min(blockLoop+5000,lastEthBlock), filter: {"a": window.Web3.utils.toChecksumAddress(accounts[0])}}, async (errors, events) => {
            if (errors)
            {
              console.log("Error Registered: "+ errors);
            }
            else
            {
              for (var i in events) {
                var timestamp = await window.Web3.eth.getBlock(events[i].blockNumber);
                var confirmations = lastEthBlock-events[i].blockNumber >= config["ethConfirmations"] ? checkmark : Math.min(lastEthBlock-events[i].blockNumber,config["ethConfirmations"])+"/"+config["ethConfirmations"];
                history.push({timestamp: timestamp.timestamp, event: "Registered", confirmations: confirmations})
              }
            }
          });

          await contract.getPastEvents(
          "MintedWithNote",
          { fromBlock: blockLoop, toBlock: Math.min(blockLoop+5000,lastEthBlock), filter: {"a": window.Web3.utils.toChecksumAddress(accounts[0])}}, async (errors, events) => {
            if (errors)
            {
              console.log("Error Minted: "+ errors);
            }
            else
            {
              for (var i in events) {
                var timestamp = await window.Web3.eth.getBlock(events[i].blockNumber);
                var confirmations = lastEthBlock-events[i].blockNumber >= config["ethConfirmations"] ? checkmark : Math.min(lastEthBlock-events[i].blockNumber,config["ethConfirmations"])+"/"+config["ethConfirmations"];
                history.push({timestamp: timestamp.timestamp, event: "Minted "+parseInt(events[i].returnValues["1"])/100000000+ " wNAV", confirmations: confirmations})
              }
            }
          });

          await contract.getPastEvents(
          "BurnedWithNote",
          { fromBlock: blockLoop, toBlock: Math.min(blockLoop+5000,lastEthBlock)}, async (errors, events) => {
            if (errors)
            {
              console.log("Error BurnedWithNote: "+ errors);
            }
            else
            {
              for (var i in events) {
                totalBurntValue += parseInt(events[i].returnValues["1"]);
                if (events[i].returnValues["a"] != window.Web3.utils.toChecksumAddress(accounts[0]))
                  continue;
                burns[events[i].transactionHash] = events[i].returnValues["a"];
                var timestamp = await window.Web3.eth.getBlock(events[i].blockNumber);
                var confirmations = lastEthBlock-events[i].blockNumber >= config["ethConfirmations"] ? checkmark : Math.min(lastEthBlock-events[i].blockNumber,config["ethConfirmations"])+"/"+config["ethConfirmations"];
                history.push({timestamp: timestamp.timestamp, event: "Burned "+parseInt(events[i].returnValues["1"])/100000000+ " wNAV", confirmations: confirmations})
              }

              var totalWithdrawnValue = 0;

              for (var i in coldScriptHistory)
              {
                var tx = coldScriptHistory[i];

                tx = await GetNavTx(tx.tx_hash)

                try {
                  if (!tx.strdzeel) continue;

                  var json = JSON.parse(tx.strdzeel)
                  var jsonStrdzeel = json.burn

                  if (jsonStrdzeel["returnValues"] && jsonStrdzeel["returnValues"]["0"] && jsonStrdzeel["returnValues"]["1"] && jsonStrdzeel["returnValues"]["2"] && jsonStrdzeel["transactionHash"])
                  {
                    var value = 0

                    for (var out_index in tx.vout)
                    {
                      if(tx.vout[out_index].scriptPubKey.addresses && tx.vout[out_index].scriptPubKey.addresses[0] == jsonStrdzeel["returnValues"]["2"])
                        value += tx.vout[out_index].valueSat;
                    }
                    if (value > 0 && value == parseInt(jsonStrdzeel["returnValues"]["1"])-parseInt(DEFAULT_TX_FEE))
                      totalWithdrawnValue += value+parseInt(DEFAULT_TX_FEE);
                  }
                } catch (e) {
                  dumpError(e);
                }
              }

              if (totalBurntValue > 0)
                pendingWithdrawalSupply.innerHTML = parseInt(totalBurntValue-totalWithdrawnValue)/100000000;
            }
          });

          blockLoop = Math.min(blockLoop+5000, lastEthBlock);
        }

        var scriptHistory = await client.blockchain_scripthash_getHistory(scriptHash)

        for (var i in scriptHistory)
        {
          var tx = scriptHistory[i];

          var hash = tx.tx_hash;
          tx = await GetNavTx(tx.tx_hash)


          if (processedNav[hash] == true) continue;

          processedNav[hash] = true;

          var value = 0

          for (var out_index in tx.vout)
          {
            if(tx.vout[out_index].scriptPubKey.addresses && tx.vout[out_index].scriptPubKey.addresses[0] == navAddressStr)
              value += tx.vout[out_index].valueSat;
          }

          if (value > 0)
          {
            var confirmations = Math.min(tx.confirmations,config["navConfirmations"]) == config["navConfirmations"] ? checkmark : Math.min(tx.confirmations,config["navConfirmations"])+"/"+config["navConfirmations"];
            history.push({timestamp: tx.blocktime, event: "Deposited "+parseInt(value)/100000000+ " NAV", confirmations: confirmations});
          }
        }

        for (var i in coldScriptHistory)
        {
          var tx = coldScriptHistory[i];

          var hash = tx.tx_hash;
          tx = await GetNavTx(tx.tx_hash)

          if (processedNavCold[hash] == true) continue;

          processedNavCold[hash] = true;

          if (!tx.strdzeel)
            continue;

          try
          {
            var jsonStrdzeel = JSON.parse(tx.strdzeel)

            var value = 0

            if (jsonStrdzeel.networkId != globalNetworkId)
              continue;

            for (var out_index in tx.vout)
            {
              if(tx.vout[out_index].scriptPubKey.addresses && tx.vout[out_index].scriptPubKey.addresses[0] == jsonStrdzeel.burn.returnValues["2"] && burns[jsonStrdzeel.burn.transactionHash])
               value += tx.vout[out_index].valueSat;
            }

            if (value > 0)
            {
              var confirmations = Math.min(tx.confirmations,config["navConfirmations"]) == config["navConfirmations"] ? checkmark : Math.min(tx.confirmations,config["navConfirmations"])+"/"+config["navConfirmations"];
              history.push({timestamp: tx.blocktime, event: "Withdrawn "+parseInt(value)/100000000+ " NAV to "+jsonStrdzeel.burn.returnValues["2"], link: 'https://navexplorer.com/tx/'+hash, confirmations: confirmations});
            }
          }
          catch(e) {
            console.error(e);
          }
        }

        history = history.sort(function(a,b) {
            return b.timestamp - a.timestamp
        });

        var tbl = document.createElement('table');
        var thead = document.createElement("thead");
        var tbody = document.createElement("tbody")

        var tr_head = document.createElement("tr");

        var th_time = document.createElement("th");
        var th_spacer = document.createElement("th");
        var th_name = document.createElement("th");
        var th_spacer_2 = document.createElement("th");
        var th_confirmations = document.createElement("th");

        th_time.textContent = "Time";
        th_spacer.innerHTML = '&nbsp;&nbsp; ';
        th_name.textContent = "Event";
        th_spacer_2.innerHTML = '&nbsp;&nbsp; ';
        th_confirmations.textContent = "Confirmations";

        tr_head.appendChild(th_time);
        tr_head.appendChild(th_spacer);
        tr_head.appendChild(th_name);
        tr_head.appendChild(th_spacer_2);
        tr_head.appendChild(th_confirmations);

        thead.appendChild(tr_head);

        for(var i = 0, j = history.length; i < j; i++) {
          var tr_body = document.createElement("tr");

          var td_time = document.createElement("td");
          var td_spacer = document.createElement("td");
          var td_name = document.createElement("td");
          var td_spacer_2 = document.createElement("td");
          var td_confirmations = document.createElement("td");

          td_time.textContent = new moment(history[i].timestamp*1000).format('MMM D, YYYY, HH:mmA');
          td_spacer.innerHTML = '&nbsp;&nbsp; ';
          td_name.textContent = history[i].event;

          if (history[i].link)
            td_name.innerHTML += '&nbsp;<a href="'+history[i].link+'">Link</a>';

          td_spacer_2.innerHTML = '&nbsp;&nbsp; ';
          td_confirmations.innerHTML = history[i].confirmations;

          tr_body.appendChild(td_time);
          tr_body.appendChild(td_spacer);
          tr_body.appendChild(td_name);
          tr_body.appendChild(td_spacer_2);
          tr_body.appendChild(td_confirmations);

          tbody.appendChild(tr_body);
        }


        tbl.appendChild(thead);
        tbl.appendChild(tbody);

        if (history.length > 0)
        {
          historyTbl.innerHTML = '';
          historyTbl.appendChild(tbl);
        }
        else
        {
          historyTbl.innerHTML = 'There is no swap history.';
        }
      }
    });
  }

  async function RestartSubscriptions () {
    console.log('restarting subscriptions')

    pendingSpan.innerHTML = '0'

    pendingDiv.classList.add('d-none')

    pendingLoader.classList.remove('d-none')

    client = new ElectrumClient(
      electrumConfig[globalNetworkId]["electrum_host"],
      electrumConfig[globalNetworkId]["electrum_port"],
      "wss"
    )

    console.log("connecting to "+electrumConfig[globalNetworkId]["electrum_host"]+":"+electrumConfig[globalNetworkId]["electrum_port"]);

    await client.connect()

    await sleep(1500);

    client.subscribe.on('blockchain.headers.subscribe', NewNavBlockHeader);
    client.blockchain_headers_subscribe();
  }

  async function getNetworkAndChainId () {
    try {
      const chainId = await ethereum.request({
        method: 'eth_chainId',
      })
      handleNewChain(chainId)

      const networkId = await ethereum.request({
        method: 'net_version',
      })
      handleNewNetwork(networkId)
    } catch (err) {
      console.error(err)
    }
  }

  $.getJSON("/src/contracts/WNAV.json", (data) => {
    contractData = data

    if (contractData.networks)
    {
      for (var network in contractData.networks)
      {
        availableNetworks.appendChild(document.createTextNode((networkNames[network] ? networkNames[network] : network)));
      }
    }

    updateButtons()

    if (isMetamaskInstalled()) {
      ethereum.autoRefreshOnNetworkChange = false
      getNetworkAndChainId()

      ethereum.on('chainChanged', handleNewChain)
      ethereum.on('networkChanged', handleNewNetwork)
      ethereum.on('accountsChanged', handleNewAccounts)

      try {
        const newAccounts = ethereum.request({
          method: 'eth_accounts',
        }).then((newAccounts) => {
          handleNewAccounts(newAccounts)
        })
      } catch (err) {
        console.error('Error on init when getting accounts', err)
      }
    }

  });
}

window.addEventListener('load', initialize)
