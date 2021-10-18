require('dotenv').config();

const services = require('./src/modules/services');

const Arbitrage = require('./src/modules/scan/arbitrage');

const logger = services.getLogger();

async function initClients() {
  const logger = services.getLogger();

  const collectionStream = await services.getCollectionStream();
  const emmiter = services.getEventEmitter();
  const arbitrage = new Arbitrage(collectionStream, logger, emmiter);

  arbitrage.init();

  //   collectionStream((data) => {
  //     console.log(
  //       data.exchange === 'binance_spot' ? '\x1b[31m' : data.exchange === 'gateio_spot' ? '\x1b[36m' : '\x1b[33m',
  //       `${data.exchange.toUpperCase()} 'ticker' event received`,
  //       data.symbol,
  //       data.ticker,
  //     );
  //   });
}

initClients();

// FURTHER STEPS AS OF 11/10/2021:
// implement ascendex
// implement depth of order book

// 18/10:
// implement the most leading/lagging
// from: https://medium.com/digitalassetresearch/an-analysis-of-price-discovery-in-bitcoin-spot-markets-7563fbf1c890
