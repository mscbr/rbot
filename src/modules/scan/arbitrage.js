const { reduce } = require('lodash');

module.exports = class Arbitrage {
  constructor(collectionStream, logger, emitter) {
    this.logger = logger;
    this.emitter = emitter;

    this.collectionStream = collectionStream;
    this.marketsData = {};
    this.falseMarkets = {};

    this.arbs = {};

    this._updateMarkets = this._updateMarkets.bind(this);
  }

  init() {
    let { collectionStream, marketsData, arbs, logger, emitter, _updateMarkets } = this;
    collectionStream((data) => {
      const marketData = _updateMarkets(data);
      if (!marketData) return;
      const singleScan = this.singleMarketScan(marketData[data.market]);

      if (singleScan) {
        arbs = {
          ...arbs,
          [data.market]: singleScan,
        };
        logger.debug(arbs);
      }
    });
  }

  _updateMarkets(data) {
    let { collectionStream, marketsData, logger, emitter } = this;
    // is the incoming value a novelty
    if (
      marketsData[data.market] &&
      marketsData[data.market][data.exchange] &&
      marketsData[data.market][data.exchange].ticker.bid === data.ticker.bid &&
      marketsData[data.market][data.exchange].ticker.ask === data.ticker.ask
    )
      return null;

    marketsData[data.market] = { ...marketsData[data.market], [data.exchange]: data };

    return { [data.market]: Object.values(marketsData[data.market]) };
  }

  _spread(bid, ask, fees = []) {
    return bid / ask - fees.reduce((acc, val) => acc + val, 0);
  }

  singleMarketScan(marketData) {
    //find the lowest ask and the highest bid
    const arb = marketData.reduce((acc, { exchange, ticker: { ask, bid }, market, fee }, idx) => {
      acc.market = market;

      if (!idx) {
        acc.lowestAsk = {
          exchange,
          price: ask,
          fee,
        };
        acc.highestBid = {
          exchange,
          price: bid,
          fee,
        };
        return acc;
      }

      if (acc.lowestAsk.price > ask) {
        acc.lowestAsk = {
          exchange,
          price: ask,
          fee,
        };
      }
      if (acc.highestBid.price < bid) {
        acc.highestBid = {
          exchange,
          price: bid,
          fee,
        };
      }
      return acc;
    }, {});

    arb.profit = this._spread(arb.highestBid.price, arb.lowestAsk.price, [arb.highestBid.fee, arb.lowestAsk.fee]);

    if (arb.profit > 2) {
      const prevMarkets = { ...this.falseMarkets };
      this.falseMarkets = {
        ...this.falseMarkets,
        [arb.market]: {
          profit: arb.profit,
          exchanges: [arb.lowestAsk.exchange, arb.highestBid.exchange],
        },
      };
      if (Object.keys(prevMarkets).length !== Object.keys(this.falseMarkets).length) {
        console.log(this.falseMarkets);
      }
      return null;
    }
    if (arb.profit > 0.97) return arb;
    return null;
  }
};
