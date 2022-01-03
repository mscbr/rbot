require('dotenv').config();

const services = require('./src/services');
const logger = services.getLogger();

const Server = require('./src/api/server');

const CcxtExchanges = require('./src/ccxt-exchanges');
const Exchanges = require('./src/modules/exchanges');

async function main() {
  const ccxtExchanges = new CcxtExchanges(logger);
  await ccxtExchanges.init();

  const directExchanges = new Exchanges();
  await directExchanges.init();

  const websocket = new Server(ccxtExchanges, directExchanges);
  websocket.startServer();
}

main();
