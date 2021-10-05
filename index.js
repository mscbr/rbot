require('dotenv').config();

const services = require('./src/modules/services');

const Arbitrage = require('./src/modules/arbitrage');

const logger = services.getLogger();

async function initClients() {
  const collectionStream = await services.getCollectionStream();
  const logger = services.getLogger();
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
