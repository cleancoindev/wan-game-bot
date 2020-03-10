const Web3 = require('web3');
const lotteryAbi = require("./lottery.json");
const axios = require('axios');
const sleep = require('ko-sleep');
// Using the IPC provider in node.js
var net = require('net');
var web3 = new Web3('/home/ubuntu/.wanchain/testnet/gwan.ipc', net);

const lotterySCAddr = '0xa4d6c4835ea5e2259cb525413f837dd17788e7c8';
const _updownGameTime = 600;
const _stopBetTime = 120;
const _randomGameTime = _updownGameTime*2;
const _winnerCnt = 2;
const owner = '0xbf12c73ccc1f7f670bf80d0bba93fe5765df9fec';
const operator = '0xced44c4eb4c1910502d2b0759eb1e8013de543e3';
const _feeRatio = 100;//10%
const _allStartTime = (Date.now()/1000).toFixed(0);

var options = {
  from: owner,
  to: lotterySCAddr,
  gasPrice: 180e9,
  gas: 10000000
}

console.log('wan bet bot start:', lotterySCAddr);

let lotterySC = new web3.eth.Contract(lotteryAbi, lotterySCAddr);


main = async () => {
  console.log((new Date()).toString(), 'checking...');

  let awaitArray = [];
  awaitArray.push(lotterySC.methods.curUpDownRound().call());
  awaitArray.push(lotterySC.methods.curRandomRound().call());
  awaitArray.push(lotterySC.methods.gameStartTime().call());
  awaitArray.push(lotterySC.methods.upDownLotteryTimeCycle().call());
  awaitArray.push(lotterySC.methods.feeRatio().call());
  awaitArray.push(lotterySC.methods.upDownLtrstopTimeSpanInAdvance().call());
  awaitArray.push(lotterySC.methods.randomLotteryTimeCycle().call());
  awaitArray.push(lotterySC.methods.chainEndTime().call());



  let [
    round,
    lotteryRound,
    gameStartTime,
    updownTimeCycle,
    feeRatio,
    stopBefore,
    randomTimeCycle,
    chainEndTime,
  ] = await Promise.all(awaitArray);

  console.log('round:', round,
    'lotteryRound:', lotteryRound,
    'gameStartTime:', gameStartTime,
    'updownTimeCycle:', updownTimeCycle,
    'feeRatio:', feeRatio,
    'stopBefore:', stopBefore,
    'randomTimeCycle:', randomTimeCycle,
    'localTime:', (Date.now()/1000).toFixed(0),
    'chainEndTime:', chainEndTime);

  chainEndTime = Number(chainEndTime);

  let roundInfo = await lotterySC.methods.updownGameMap(round).call();

  console.log('roundInfo-> openPrice:', roundInfo.openPrice, 'closePrice:', roundInfo.closePrice,
    'upAmount:', Number(roundInfo.upAmount) / 1e18, 'downAmount:', Number(roundInfo.downAmount) / 1e18);
  
  console.log('round time left:', Number(gameStartTime) + Number(updownTimeCycle) * (Number(round) + 1) - chainEndTime, 's.');
  if (round == 0 && roundInfo.openPrice == 0 && gameStartTime == 0) {
    console.log('SC init.');
    console.log('setFeeRatio...');
    await lotterySC.methods.setFeeRatio(_feeRatio).send(options);
    console.log('setRandomWinnerNumber...');
    await lotterySC.methods.setRandomWinnerNumber(_winnerCnt).send(options);
    console.log('setLotteryTime...');
    const _gameStartTime = _allStartTime;
    await lotterySC.methods.setLotteryTime(_gameStartTime, _updownGameTime, _stopBetTime, _randomGameTime).send(options);

    await sleep(10000);
    console.log('setOperator...');
    await lotterySC.methods.setOperator(operator).send(options);

    console.log('SC init finish.');
  } 
}

getPrice = async () => {
  let ret = await axios({
    method: 'GET',
    url: 'https://min-api.cryptocompare.com/data/pricemulti',
    timeout: 50000,
    params: {
      fsyms: 'WAN',
      tsyms: 'BTC',
    }
  });
  console.log('btcPrice:', ret.data);
  return ret.data.WAN.BTC;
}

main().then(console.log).catch(console.log);