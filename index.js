require('dotenv').config();

const services = require('./src/modules/services');

const logger = services.getLogger();

async function initClients() {
  const exchanges = await services.getExchanges();
  const collection = await services.getCollection();

  logger.debug(collection);

  // think about the fast & light way to keep cross-exchange market data
  // check the structure of "collections.json"
  // think about future data collection - to db or not db?
}

initClients();
