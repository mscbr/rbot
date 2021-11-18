const { v4: uuid } = require('uuid');
const services = require('../../services');

module.exports = class ScanManager {
  constructor(exchanges, logger, targets) {
    this.logger = logger;

    this.exchanges = exchanges;
    this.exchangeQuerries = Object.keys(exchanges).reduce((acc, key) => {
      acc[key] = {
        ratelimit: exchanges[key].rateLimit,
        rateUse: 0,
        interval: services.getInterval();
      };
    }, {});

    this.obTargets = [
      {
        id: '',
        symbol: '',
        exchanges: ['', ''],
        arb: null,
      },
    ];

    this.init = this.init.bind(this);
    this.init(targets);
  }

  init(targets) {
    // for each target add(target)
    targets.forEach((target) => this.addTarget(target));
  }

  _compareTargets(target1, target2) {
    if (target1.symbol !== target2.symbol) return false;
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
      }, true)
    )
      this.obTargets.push({
        ...target,
        id: uuid(),
      });
  }

  startTarget(targetId, duration) {
    let target = this.obTargets.find((obTarget) => obTarget.id === target.id);
    if (!target) return;
    target.exchanges.forEach(exchange => {
      const {rateLimit, interval: {interval}} = this.exchangeQuerries[exchange];
      this.exchangeQuerries[exchange].interval.setInterval(rateLimit*2, [interval?.callbacks, () => {
        console.log("ANOTHER_INTEVAL");
      }])
    })
  }
};
