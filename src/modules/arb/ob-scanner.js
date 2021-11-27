const { v4: uuid } = require('uuid');
const services = require('../../services');
const HttpError = require('../../models/httpError');

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

    this.exchanges = ccxtExchanges.exchanges;

    this.obTargets = [];
  }

  setSubscriber(subscriber) {
    this.subscriber = subscriber;
  }

  _compareTargets(target1, target2) {
    if (target1.market !== target2.market) return false;
    return target1.exchanges.reduce((acc, exchange) => {
      if (!target2.exchanges.includes(exchange)) acc = false;
      return acc;
    }, true);
  }

  addTarget(target) {
    this.logger.debug(target);
    if (
      target &&
      // checks if same target is already in obTargets
      this.obTargets.reduce((acc, obTarget) => {
        if (this._compareTargets(target, obTarget)) acc = false;
        return acc;
      }, true)
    ) {
      const newTarget = {
        ...target,
        id: uuid(),
      };

      this.obTargets.unshift(newTarget);

      this.rateLimitManager.addCallback(target.exchanges, {
        id: newTarget.id,
        run: async (exchange) => {
          // const promises = target.exchanges
          if (this.exchanges[exchange].has['fetchOrderBook']) {
            const ob = await this.exchanges[exchange].fetchOrderBook(target.market);
            this.logger.info(`${target.market} order book from ${exchange}`);
            console.log(ob);
          }
        },
      });

      this.subscriber.send(JSON.stringify({ channel: 'obArbs', targets: this.getTargets() }));

      return newTarget;
    }
  }

  runObFetching() {
    this.rateLimitManager.startIntervals();
  }

  stopObFetching() {
    this.rateLimitManager.stopIntervals();
  }

  removeTarget(targetId) {
    const { obTargets } = this;
    this.obTargets = obTargets.filter(({ id }) => id !== targetId);
  }

  getTargets() {
    return this.obTargets;
  }

  clearTargets() {
    this.obTargets = [];
    this.rateLimitManager.clearCallbacks();
  }

  startTarget(targetId, duration) {
    let target = this.obTargets.find((obTarget) => obTarget.id === target.id);
    if (!target) return;

    target.exchanges.forEach((exchange) => {
      const {
        rateLimit,
        interval: { interval },
      } = this.exchangeQuerries[exchange];
      this.exchangeQuerries[exchange].interval.setInterval(rateLimit * 2, [
        ...interval.callbacks,
        () => {
          console.log('INTERVAL_CHECK', exchange, rateLimit, target.symbol, id);
        },
      ]);
    });
  }
};
