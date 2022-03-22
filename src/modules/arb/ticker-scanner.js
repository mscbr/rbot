const services = require('../services');
const logger = services.getLogger();

const Arbitrage = require('./arbitrage');

module.exports = class TickeScanner {
  constructor(ccxtExchanges, directExchanges, subscriber, channel = 'tickerArbs') {
    this.subscriber = subscriber;
    this.channel = channel;

    this.ccxtExchanges = ccxtExchanges;
    this.directExchanges = directExchanges;

    this.exchangeDisabledCoins = Object.values(directExchanges.exchanges).reduce((acc, exchange) => {
      Object.values(exchange.currencies).forEach((currency) => {
        if (currency.withdrawDisabled) {
          if (acc[exchange.id]) acc[exchange.id] = [...acc[exchange.id], currency.symbol];
          else acc[exchange.id] = [currency.symbol];
        }
      });
      return acc;
    }, {});

    this.arbs = [];
    this.tickers = {};

    this.arbitrage = new Arbitrage(logger);
    this.interval = services.getInterval();
  }

  runTickerFetching() {
    this.interval.setInterval(3, [
      async () => {
        const tickers = await this.ccxtExchanges.fetchMarketTickers(this.exchangeDisabledCoins);
        this.tickers = tickers;

        const { arbs } = this.arbitrage.scanAllMarketTickers({ tickers });

        const arbsWithTransfer = arbs.map((arb) => {
          const withdrawFee =
            this.directExchanges.exchanges[arb.ask.exchange].currencies[arb.market.split('/')[0]].withdrawFee;

          if (withdrawFee && Object.keys(withdrawFee).length) {
            return {
              ...arb,
              transferFees:
                this.directExchanges.exchanges[arb.ask.exchange].currencies[arb.market.split('/')[0]].withdrawFee,
            };
          }

          return arb;
        });

        this.arbs = arbsWithTransfer;

        this.subscriber.send(
          JSON.stringify({
            channel: this.channel,
            arbs: arbsWithTransfer,
            interval: 3,
          }),
        );
      },
    ]);
  }

  stopTickerFetching() {
    this.interval.terminateInterval();
  }

  populateWithdrawFees() {
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
      (coin, exchange, transferFees) => {
        const target = this.arbs.find((item) => item.market.split('/')[0] === coin && item.ask.exchange === exchange);

        if (target) {
          const index = this.arbs.indexOf(target);
          this.arbs.splice(index, 1, {
            ...target,
            transferFees,
          });

          this.subscriber.send(
            JSON.stringify({
              channel: this.channel,
              arbs: this.arbs,
              interval: 3,
            }),
          );
        }
      },
    );
  }
};
