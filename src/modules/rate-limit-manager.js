const services = require('../services');

module.exports = class RateLimitManager {
  constructor(exchanges) {
    this.exchanges = exchanges;

    this.intervals = exchanges.reduce((acc, key) => {
      acc[key] = {
        callbacks: {},
        interval: services.getInterval(),
      };
      return acc;
    }, {});

    this.startIntervals = this.startIntervals.bind(this);
  }

  addCallback(exchanges, { id, run }) {
    exchanges.forEach((exchange) => {
      if (this.intervals[exchange]) this.intervals[exchange].callbacks[id] = async () => await run(exchange);
    });
  }

  setIntervalsDuration(exchanges, duration) {
    exchanges.forEach((exchange) => {
      const { interval, callbacks } = this.intervals[exchange];
      if (interval.getInterval()) interval.setIntervalDuration(duration, Object.values(callbacks));
    });
  }

  startIntervals(exchanges = []) {
    if (!exchanges.length) {
      Object.values(this.intervals).forEach(
        (interval) =>
          Object.keys(interval.callbacks).length && interval.interval.setInterval(2, Object.values(interval.callbacks)),
      );
    }

    if (exchanges.length)
      exchanges.forEach((exchange) => {
        if (this.intervals[exchange]) {
          const { interval, callbacks } = this.intervals[exchange];
          if (callbacks) interval.setInterval(2, Object.values(callbacks));
        }
      });
  }

  stopIntervals() {
    Object.keys(this.intervals).forEach((exchange) => {
      if (this.intervals[exchange]) {
        this.intervals[exchange].interval.terminateInterval();
      }
    });
  }

  clearCallbacks(exchanges = []) {
    this.stopIntervals(exchanges);
    Object.keys(this.intervals).forEach((exchange) => {
      this.intervals[exchange].callbacks = {};
    });
  }

  clearCallback(callbackId) {
    Object.keys(this.intervals).forEach((exchange) => {
      delete this.intervals[exchange].callbacks[callbackId];
    });
  }
};
