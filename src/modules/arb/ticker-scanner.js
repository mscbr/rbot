const services = require('../../services');
const logger = services.getLogger();

const HttpError = require('../../models/httpError');
const Arbitrage = require('./arbitrage');

module.exports = class TickeScanner {
  constructor(ccxtExchanges, directExchanges, subscriber, channel = 'tickerArbs') {
    this.subscriber = subscriber;
    this.channel = channel;

    this.ccxtExchanges = ccxtExchanges;
    this.directExchanges = directExchanges;

    this.withdrawDisabledCoins = Object.values(directExchanges.exchanges).reduce((acc, exchange) => {
      Object.values(exchange.currencies).forEach((currency) => {
        if (currency.withdrawDisabled) acc.push(currency.symbol);
      });
      return acc;
    }, []);

    this.arbs = [];
    this.tickers = {};

    this.arbitrage = new Arbitrage(logger);
    this.interval = services.getInterval();
  }

  runTickerFetching() {
    this.interval.setInterval(3, [
      async () => {
        const tickers = await this.ccxtExchanges.fetchMarketTickers(this.withdrawDisabled);
        this.tickers = tickers;

        const { arbs } = this.arbitrage.scanAllMarketTickers({ tickers });
        this.arbs = arbs;

        this.subscriber.send(
          JSON.stringify({
            channel: this.channel,
            arbs,
            interval: 3,
          }),
        );
      },
    ]);
  }

  stopTickerFetching() {
    this.interval.terminateInterval();
  }

  async populateWithdrawFees() {
    if (!this.arbs.length) return;
    this.stopTickerFetching();

    this.directExchanges.populateWithdrawFees(
      this.arbs.reduce((acc, arb) => {
        const {
          ask: { exchange },
          market,
        } = arb;
        const coin = market.split('/')[0];

        if (!acc.hasOwnProperty(exchange)) acc[exchange] = [];
        if (acc[exchange].includes(coin)) return acc;

        acc[exchange].push(coin);
        return acc;
      }, {}),
      this.tickers,
    );
  }
};
