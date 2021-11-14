require('dotenv').config();

const services = require('./src/services');
const logger = services.getLogger();

const WS = require('./src/api/websocket/server');

const Exchanges = require('./src/exchanges');
const Arbitrage = require('./src/arbitrage');

async function main() {
  const logger = services.getLogger();
  const tickerInterval = services.getInterval();

  const websocket = new WS(logger);
  websocket.startServer();

  const exchanges = new Exchanges(logger);
  await exchanges.init();
  const arbitrage = new Arbitrage(logger);

  tickerInterval.setInterval(5, async () => {
    const tickers = await exchanges.fetchMarketTickers();
    const arbs = arbitrage.scanAllMarketTickers({ tickers });
    websocket.emitData(
      JSON.stringify(
        arbs.arbs.map(
          ({ market, profit, lowestAsk: { exchange: askExchange }, highestBid: { exchange: bidExchange } }) => ({
            market,
            profit,
            askExchange,
            bidExchange,
          }),
        ),
      ),
    );

    // console.log('ARBS', arbitrage.scanAllMarketTickers({ tickers }));
  });

  // setTimeout(() => {
  //   tickerInterval.terminateInterval();
  // }, 40000);
}

main();
