require('dotenv').config();

const services = require('./src/modules/services');

const logger = services.getLogger();

async function initClients() {
  const exchanges = await services.getExchanges();
  const emitter = services.getEventEmitter();
  emitter.on('ticker', (data) => {
    console.log("'ticker' event received", data.symbol, data.ticker.ask);
  });
  // const collection = await services.getCollection();

  // logger.debug(collection);

}

initClients();
