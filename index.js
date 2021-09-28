require('dotenv').config();

const services = require('./src/modules/services');

const logger = services.getLogger();

async function initClients() {
  const collectionStream = await services.getCollectionStream();

  collectionStream((data) => {
    console.log(
      data.exchange === 'binance_spot' ? '\x1b[31m' : data.exchange === 'gateio_spot' ? '\x1b[36m' : '\x1b[33m',
      `${data.exchange.toUpperCase()} 'ticker' event received`,
      data.symbol,
      data.ticker,
    );
  });
}

initClients();
