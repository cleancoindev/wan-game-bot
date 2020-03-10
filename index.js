const Web3 = require('web3');
const lotteryAbi = require("./lottery.json");
const axios = require('axios');
const sleep = require('ko-sleep');
// Using the IPC provider in node.js
var net = require('net');
var web3 = new Web3('/home/ubuntu/.wanchain/testnet/gwan.ipc', net);

const lotterySCAddr = '0xe87db9727577eeebb1d28e5a4893c2b320a79770';
const operator = '0xced44c4eb4c1910502d2b0759eb1e8013de543e3';

var options = {
  from: operator,
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
  let leftTime = Number(gameStartTime) + Number(updownTimeCycle) * (Number(round) + 1) - chainEndTime;
  if (round == 0 && roundInfo.openPrice == 0 && gameStartTime == 0) {
    console.log('Please first to setOperator.');
    
    await sleep(10000);
  } else if (gameStartTime != 0 && roundInfo.openPrice == 0 && leftTime < updownTimeCycle && leftTime > 0) {
    let curPrice = await getPrice();
    console.log('setPriceIndex...', curPrice);
    await lotterySC.methods.setPriceIndex(Number((curPrice * 1e8).toFixed(0)), 0, true).send(options);
    console.log('init finish.');
  } else if (gameStartTime != 0
    && roundInfo.openPrice != 0
    && roundInfo.closePrice == 0
    && chainEndTime > Number(gameStartTime) + Number(updownTimeCycle) * (Number(round) + 1)) {
    console.log('End time arrive.');

    let curPrice = await getPrice();
    console.log('setPriceIndex...');
    await lotterySC.methods.setPriceIndex(Number((curPrice * 1e8).toFixed(0)), Number(round), false).send(options);
    await sleep(10000);
    console.log('upDownLotteryFanalize...');
    await lotterySC.methods.upDownLotteryFanalize().send(options);
    console.log('setPriceIndex...');
    await lotterySC.methods.setPriceIndex(Number((curPrice * 1e8).toFixed(0)), Number(round) + 1, true).send(options);
    await sleep(10000);
  } 
  console.log('random end time:', (Number(gameStartTime) + Number(randomTimeCycle)*(Number(lotteryRound) + 1)));
  if ((chainEndTime != 0) && (randomTimeCycle != 0) && (gameStartTime != 0) && (chainEndTime > (Number(gameStartTime) + Number(randomTimeCycle)*(Number(lotteryRound) + 1)))) {
    let rd = await lotterySC.methods.randomGameMap(lotteryRound).call();
    console.log('randomGameMap:', rd);
    if (!rd.finished) {
      console.log('genRandom...')
      await lotterySC.methods.genRandom(lotteryRound).send(options);
      await sleep(10000);
      console.log('randomLotteryFanalize...')
      await lotterySC.methods.randomLotteryFanalize().send(options);
      await sleep(10000);
    }
  }

  console.log('check ok!');
  setTimeout(main, 5000, null);
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