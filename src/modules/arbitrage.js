module.exports = class Arbitrage {
  constructor(collectionStream, logger, emitter) {
    this.logger = logger;
    this.emitter = emitter;

    this.collectionStream = collectionStream;
    this.marketsData = {};
    this.marketUpdates = 0;

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

  singleMarketScan(marketData) {
    //find the lowest ask and the highest bid
    const arb = marketData.reduce((acc, { exchange, ticker: { ask, bid }, market }, idx) => {
      acc.market = market;
      if (!idx) {
        acc.lowestAsk = {
          exchange,
          price: ask,
        };
        acc.highestBid = {
          exchange,
          price: bid,
        };
        return acc;
      }

      if (acc.lowestAsk.price > ask) {
        acc.lowestAsk = {
          exchange,
          price: ask,
        };
      }
      if (acc.highestBid.price < bid) {
        acc.highestBid = {
          exchange,
          price: bid,
        };
      }
      return acc;
    }, {});
    if (arb.highestBid.price - arb.lowestAsk.price > 0) console.log(arb.market);
    if (arb.lowestAsk.price < arb.highestBid.price) return arb;
    return null;
  }
};
