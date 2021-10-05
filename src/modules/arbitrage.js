module.exports = class Arbitrage {
  constructor(collectionStream, logger, emitter) {
    this.logger = logger;
    this.emitter = emitter;

    this.collectionStream = collectionStream;
    this.marketData = {};
    this.marketUpdates = 0;

    this._updateMarkets = this._updateMarkets.bind(this);
  }

  init() {
    const { collectionStream, marketData, logger, emitter, _updateMarkets } = this;
    collectionStream((data) => {
      _updateMarkets(data);
    });
  }

  _updateMarkets(data) {
    const { collectionStream, marketData, logger, emitter } = this;
    // is the incoming value a novelty
    if (
      marketData[data.market] &&
      marketData[data.market][data.exchange] &&
      marketData[data.market][data.exchange].ticker.bid === data.ticker.bid &&
      marketData[data.market][data.exchange].ticker.ask === data.ticker.ask
    )
      return;

    // maybe for perf, just the ticker can be updated?
    marketData[data.market] = { ...marketData[data.market], [data.exchange]: data };

    // DEBUG
    data.market === 'ETHBTC' && console.log(marketData[data.market]);
  }

  // singleMarketScan() {}
};
