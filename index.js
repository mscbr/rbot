require('dotenv').config();

const services = require('./src/services');
const logger = services.getLogger();

const Server = require('./src/api/server');

const CcxtExchanges = require('./src/ccxt-exchanges');
const { exchanges, hitbtc } = require('ccxt');

async function main() {
  const ccxtExchanges = new CcxtExchanges(logger);
  await ccxtExchanges.init();

  // console.log(ccxtExchanges.exchanges['hitbtc'].markets);
  // console.log('1000$ -> ETH @ binance: ', 1000 * ccxtExchanges.usdtTo('ETH', 'gateio'));
  // console.log('5000$ -> BTC @ gateio: ', 5000 * ccxtExchanges.usdtTo('BTC', 'gateio'));

  // console.log('GATEIO BONDED', ccxtExchanges.exchanges['gateio'].currencies['BONDED']);
  // console.log('HITBTC', ccxtExchanges.exchanges['hitbtc'].currencies['KIN']);

  const websocket = new Server(ccxtExchanges);
  websocket.startServer();
}

main();
