const { v4: uuid } = require('uuid');

const services = require('../../services');
const logger = services.getLogger();

const HttpError = require('../../models/httpError');
const Arbitrage = require('./arbitrage');
const Path = require('../../models/path');

module.exports = class ObScanner {
  constructor(ccxtExchanges, directExchanges, rateLimitManager, subscriber) {
    this.rateLimitManager = rateLimitManager;
    this.subscriber = null;

    this.ccxtExchanges = ccxtExchanges;
    this.directExchanges = directExchanges;
    this.arbitrage = new Arbitrage(logger);

    this.obPaths = {};
    this.currentObData = {};

    this.onObUpdate = this.onObUpdate.bind(this);
    this.directExchanges.propagateOnObUpdate(this.onObUpdate);
  }

  setSubscriber(subscriber) {
    this.subscriber = subscriber;
  }

  onObUpdate(orderBook, exchange) {
    this.currentObData[exchange] = {
      ...this.currentObData[exchange],
      [orderBook.symbol]: orderBook,
    };

    Object.values(this.obPaths)
      .filter((obPath) => obPath.market === orderBook.symbol && obPath.exchanges.includes(exchange))
      .forEach((obPath) => {
        if (
          !!this.currentObData[obPath.exchanges[0]] &&
          !!this.currentObData[obPath.exchanges[0]][obPath.market] &&
          !!this.currentObData[obPath.exchanges[1]] &&
          !!this.currentObData[obPath.exchanges[1]][obPath.market]
        )
          obPath.setArbs(
            this.arbitrage.singleMarketObScan({
              in: {
                ...this.currentObData[obPath.exchanges[0]][obPath.market],
              },
              out: {
                ...this.currentObData[obPath.exchanges[1]][obPath.market],
              },
              tradeFee: obPath.tradeFees.reduce((a, b) => a + b),
              transferFee: obPath.transferFee,
            }),
          );
      });

    this.subscriber && this.subscriber.send(JSON.stringify({ channel: 'obArbs', paths: this.obPaths }));
  }

  // _compareTargets(target1, target2) {
  //   if (target1.market !== target2.market) return false;
  //   return target1.exchanges.reduce((acc, exchange) => {
  //     if (!target2.exchanges.includes(exchange)) acc = false;
  //     return acc;
  //   }, true);
  // }

  addPath({ exchanges, market }, side = 'MAKER') {
    if (!market || (exchanges && exchanges.length < 2)) return;

    const path = new Path({
      id: uuid(),
      market,
      exchanges,
      tradeFees: [
        parseFloat(
          (side === 'MAKER'
            ? this.directExchanges.exchanges[exchanges[0]].markets[market].maker +
              this.directExchanges.exchanges[exchanges[1]].markets[market].maker
            : this.directExchanges.exchanges[exchanges[0]].markets[market].taker +
              this.directExchanges.exchanges[exchanges[1]].markets[market].taker
          ).toFixed(4),
        ),
      ],
      transferFee: 0, //instatiate fee data first and pass here
    });

    this.obPaths[path.id] = path;

    this.directExchanges.addObSubscription(path.id, exchanges, market);

    this.subscriber && this.subscriber.send(JSON.stringify({ channel: 'obArbs', paths: this.obPaths }));

    return this;
  }

  async runObFetching() {
    await this.directExchanges.openWsConnections();
    this.directExchanges.startObSubscriptions();
  }

  stopObFetching() {
    this.directExchanges.closeWsConnections();
  }

  removePath(pathId) {
    this.directExchanges.removeObSubscription(pathId);
    delete this.obPaths[pathId];
  }

  get paths() {
    return this.obPaths;
  }

  clearPaths() {
    this.obPaths = {};
    this.currentObData = {};
    this.directExchanges.obSubscriptions = {};
  }
};
