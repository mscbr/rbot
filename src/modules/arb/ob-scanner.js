const { v4: uuid } = require('uuid');
const services = require('../../services');
const HttpError = require('../../models/httpError');
const Arbitrage = require('./arbitrage');
const Path = require('../../models/path');

// this.obTargets = [
//   {
//     id: '',
//     market: '',
//     exchanges: ['', ''],
//     volume: 1000,
//     arb: null,
//   },
// ];

module.exports = class ObScanner {
  constructor(ccxtExchanges, logger, rateLimitManager, subscriber) {
    this.logger = logger;
    this.rateLimitManager = rateLimitManager;
    this.subscriber = null;

    this.ccxtExchanges = ccxtExchanges;
    this.arbitrage = new Arbitrage(logger);

    this.obPaths = {};
    this.currentObData = {};
  }

  setSubscriber(subscriber) {
    this.subscriber = subscriber;
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
        side === 'MAKER'
          ? this.ccxtExchanges.exchanges[exchanges[0]].markets[market].maker +
            this.ccxtExchanges.exchanges[exchanges[1]].markets[market].maker
          : this.ccxtExchanges.exchanges[exchanges[0]].markets[market].taker +
            this.ccxtExchanges.exchanges[exchanges[0]].markets[market].taker,
      ],
      transferFee: 0, //instatiate fee data first and pass here
    });

    this.obPaths[path.id] = path;

    this.rateLimitManager.addCallback(path.exchanges, {
      id: path.id,
      run: async (exchange) => {
        if (this.ccxtExchanges.exchanges[exchange].has['fetchOrderBook']) {
          const ob = await this.ccxtExchanges.exchanges[exchange].fetchOrderBook(path.market, 50);
          this.logger.info(`${path.market} order book from ${exchange}`);
          this.currentObData[exchange] = {
            ...this.currentObData[exchange],
            [path.market]: ob,
          };

          if (
            !!this.currentObData[path.exchanges[0]] &&
            !!this.currentObData[path.exchanges[0]][path.market] &&
            !!this.currentObData[path.exchanges[1]] &&
            !!this.currentObData[path.exchanges[1]][path.market]
          ) {
            this.obPaths[path.id].setArbs(
              this.arbitrage.singleMarketObScan({
                in: {
                  ...this.currentObData[path.exchanges[0]][path.market],
                },
                out: {
                  ...this.currentObData[path.exchanges[1]][path.market],
                },
                tradeFee: path.tradeFees.reduce((a, b) => a + b),
                transferFee: path.transferFee,
              }),
            );
            this.subscriber && this.subscriber.send(JSON.stringify({ channel: 'obArbs', paths: this.obPaths }));
          }
        }
      },
    });

    this.subscriber && this.subscriber.send(JSON.stringify({ channel: 'obArbs', paths: this.obPaths }));
    return this;
  }

  // updateTarget(id, { volume }) {
  // this.obTargets = this.obTargets.find((elem,i) => elem.id === id); // maybe convert to obj?
  // this.rateLimitManager.addCallback(this.obTargets[id].exchanges, {
  //   id,
  //   run: async (exchange) => {
  //     if (this.exchanges[exchange].has['fetchOrderBook']) {
  //       const ob = await this.exchanges[exchange].fetchOrderBook(target.market);
  //       this.logger.info(`${target.market} order book from ${exchange}`);
  //       console.log(ob);
  //     }
  //   },
  // });
  // }

  runObFetching() {
    this.rateLimitManager.startIntervals();
  }

  stopObFetching() {
    this.rateLimitManager.stopIntervals();
  }

  removePath(pathId) {
    const { obPaths } = this;
    this.rateLimitManager.clearCallback(pathId);
    delete this.obPaths[pathId];
  }

  get paths() {
    return this.obPaths;
  }

  clearPaths() {
    this.obPaths = {};
    this.currentObData = {};
    this.rateLimitManager.clearCallbacks();
  }

  // startTarget(targetId, duration) {
  //   let target = this.obTargets.find((obTarget) => obTarget.id === target.id);
  //   if (!target) return;

  //   target.exchanges.forEach((exchange) => {
  //     const {
  //       rateLimit,
  //       interval: { interval },
  //     } = this.exchangeQuerries[exchange];
  //     this.exchangeQuerries[exchange].interval.setInterval(rateLimit * 2, [
  //       ...interval.callbacks,
  //       () => {
  //         console.log('INTERVAL_CHECK', exchange, rateLimit, target.symbol, id);
  //       },
  //     ]);
  //   });
  // }
};
