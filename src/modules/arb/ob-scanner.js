const { v4: uuid } = require('uuid');

const services = require('../../services');
const logger = services.getLogger();

const Arbitrage = require('./arbitrage');
const Path = require('../../models/path');

module.exports = class ObScanner {
  constructor(directExchanges, subscriber) {
    this.subscriber = subscriber;

    this.directExchanges = directExchanges;
    this.arbitrage = new Arbitrage(logger);

    this.obPaths = {};
    this.currentObData = {};

    this.onObUpdate = this.onObUpdate.bind(this);
    this.directExchanges.propagateOnObUpdate(this.onObUpdate);
  }

  addPath({ exchanges, market }, side = 'MAKER') {
    if (!market || (exchanges && exchanges.length < 2)) return;

    const transferFees = this.directExchanges.exchanges[exchanges[0]].currencies[market.split('/')[0]].withdrawFee;

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
      transferFees,
    });

    this.obPaths[path.id] = path;

    this.directExchanges.addObSubscription(path.id, exchanges, market);

    this.subscriber && this.subscriber.send(JSON.stringify({ channel: 'obArbs', paths: this.obPaths }));

    return this;
  }

  onObUpdate(orderBook, exchange) {
    this.currentObData[exchange] = {
      ...this.currentObData[exchange],
      [orderBook.symbol]: orderBook,
    };

    Object.values(this.obPaths)
      .filter((obPath) => obPath.market === orderBook.symbol && obPath.exchanges.includes(exchange))
      .forEach((obPath) => {
        const inObData =
          this.currentObData[obPath.exchanges[0]] && this.currentObData[obPath.exchanges[0]][obPath.market];
        const outObData =
          this.currentObData[obPath.exchanges[1]] && this.currentObData[obPath.exchanges[1]][obPath.market];

        if (inObData && outObData)
          obPath.arbs = this.arbitrage.singleMarketObScan({
            in: inObData,
            out: outObData,
            tradeFee: obPath.tradeFees.reduce((a, b) => a + b),
          });
      });

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
