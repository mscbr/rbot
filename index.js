require('dotenv').config();

const services = require('./src/modules/services');

const GateioSpotClient = require('./src/modules/connectors/gateio-spot');

const logger = services.getLogger();

async function initClients() {
  // const gateioSpot = new GateioSpotClient(
  //   process.env.APIKEY_PUBLIC_GATEIO_SPOT,
  //   process.env.APIKEY_PRIVATE_GATEIO_SPOT,
  //   'eventEmitter',
  //   logger,
  // );
  // await gateioSpot.init();
  // logger.debug(gateioSpot.markets);

  const exchanges = await services.getExchanges();

  exchanges.map((exchange) => {
    logger.info(exchange.id);
    for (let i = 0; i < 10; i++) logger.debug(exchange.markets[Object.keys(exchange.markets)[i]]);
  });

  // think about the fast & light way to keep cross-exchange market data
  // check the structure of "collections.json"
  // think about future data collection - to db or not db?
}

initClients();
