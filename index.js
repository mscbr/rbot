require('dotenv').config();

const services = require('./src/services');
const logger = services.getLogger();

const Exchanges = require('./src/exchanges');
const Arbitrage = require('./src/arbitrage');

async function main() {
  const logger = services.getLogger();
  const exchanges = new Exchanges(logger);
  await exchanges.init();
  const arbitrage = new Arbitrage();
  const tickerInterval = services.getInterval();

  tickerInterval.setInterval(30, async () => {
    const tickers = await exchanges.fetchMarketTickers();
    console.log('ARBS', arbitrage.scanAllMarketTickers({ tickers }));
  });

  setTimeout(() => {
    tickerInterval.terminateInterval();
  }, 40000);
}

main();
