require('dotenv').config();

const services = require('./src/services');
const logger = services.getLogger();

const Server = require('./src/api/server');

const CcxtExchanges = require('./src/ccxt-exchanges');

async function main() {
  const ccxtExchanges = new CcxtExchanges(logger);
  await ccxtExchanges.init();

  console.log('1000$ -> ETH @ binance: ', 1000 * ccxtExchanges.usdtTo('ETH', 'binance'));
  console.log('5000$ -> BTC @ gateio: ', 5000 * ccxtExchanges.usdtTo('BTC', 'gateio'));

  const websocket = new Server(ccxtExchanges);
  websocket.startServer();
}

main();
