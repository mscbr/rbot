require('dotenv').config();

const services = require('./src/modules/services');

const Arbitrage = require('./src/modules/scan/arbitrage');
const SingleMarketRecorder = require('./src/data-analysis/single-market-recorder');

const logger = services.getLogger();

async function initClients() {
  const logger = services.getLogger();

  const collectionStream = await services.getCollectionStream([], []);
  const emmiter = services.getEventEmitter();
  const arbitrage = new Arbitrage(collectionStream, logger, emmiter);

  arbitrage.init();

  collectionStream((data) => {
    console.log(
      data.exchange === 'binance_spot' ? '\x1b[31m' : data.exchange === 'gateio_spot' ? '\x1b[36m' : '\x1b[33m',
      `${data.exchange.toUpperCase()} 'ticker' event received`,
      data.symbol,
      data.ticker,
    );
  });
}

// initClients();

async function analyze() {
  const logger = services.getLogger();

  const recorder = new SingleMarketRecorder(logger);
  await recorder.init();
  await recorder.scanForArbs(15);

  // setTimeout(() => {
  //   recorder.terminateScan();
  // }, 30000);
}

analyze();

// FURTHER STEPS AS OF 11/10/2021:
// implement ascendex
// implement depth of order book
