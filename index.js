require('dotenv').config();

const services = require('./src/services');
const logger = services.getLogger();

const Server = require('./src/api/server');

const CcxtExchanges = require('./src/ccxt-exchanges');
const { exchanges, hitbtc } = require('ccxt');

async function main() {
  const ccxtExchanges = new CcxtExchanges(logger);
  await ccxtExchanges.init();

  const websocket = new Server(ccxtExchanges);
  websocket.startServer();
}

main();
