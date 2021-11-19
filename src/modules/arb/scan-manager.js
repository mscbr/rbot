const { v4: uuid } = require('uuid');
const services = require('../../services');
const HttpError = require('../../models/httpError');


// this.obTargets = [
//   {
//     id: '',
//     market: '',
//     exchanges: ['', ''],
//     arb: null,
//   },
// ];

module.exports = class ScanManager {
  constructor(exchanges, logger, targets = []) {
    this.logger = logger;

    this.exchanges = exchanges;
    this.exchangeQuerries = Object.keys(exchanges).reduce((acc, key) => {
      acc[key] = {
        ratelimit: exchanges[key].rateLimit,
        rateUse: 0,
        interval: services.getInterval(),
      };
      return acc;
    }, {});

    this.obTargets = [];

    this.init = this.init.bind(this);
    this.init(targets);
  }

  init(targets) {
    targets && targets.length && targets.forEach((target) => this.addTarget(target));
  }

  _compareTargets(target1, target2) {
    if (target1.market !== target2.market) return false;
    return target1.exchanges.reduce((acc, exchange) => {
      if (!target2.exchanges.includes(exchange)) acc = false;
      return acc;
    }, true);
  }

  addTarget(target) {
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
      return newTarget;
    }
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
  }

  startTarget(targetId, duration) {
    let target = this.obTargets.find((obTarget) => obTarget.id === target.id);
    if (!target) return;
    target.exchanges.forEach(exchange => {
      const { rateLimit, interval: { interval } } = this.exchangeQuerries[exchange];
      this.exchangeQuerries[exchange].interval.setInterval(rateLimit * 2, [...interval.callbacks, () => {
        console.log("INTERVAL_CHECK", exchange, rateLimit, target.symbol, id);
      }]);
    });
  }
};
