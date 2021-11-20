const services = require('../services');
const logger = services.getLogger();

const Arbitrage = require('../modules/arb/arbitrage');
const ScanManager = require('../modules/arb/scan-manager');

module.exports = class WsTrigSubManager {
  constructor(exchanges, arbitrage) {
    this.subscriber = null;

    this.exchanges = exchanges;
    this.arbitrage = new Arbitrage(logger);
    this.scanManager = new ScanManager(this.exchanges, logger);

    this.channels = {
      tickerArbs: {
        arbs: [],
      },
      obArbs: {
        arbs: [],
      },
    };

    this.brokers = {
      tickerArbs: services.getInterval(),
    };

    this._initChannelBroker = this._initChannelBroker.bind(this);
    this._obTriggerFunctions = this._obTriggerFunctions.bind(this);
  }

  setSubscriber(subscriber) {
    this.subscriber = subscriber;
  }

  subscribe(channel, payload) {
    const { _initChannelBroker, subscriber, scanManager } = this;
    if (!subscriber) {
      logger.error(`WS trigsub-manager: subscriber not provided`);
      return;
    }

    logger.info(`WS: new subscription to ${channel}`);

    if (this.channels[channel]) subscriber.send(JSON.stringify({ message: `Subscribitng to ${channel}` }));
    else subscriber.send(JSON.stringify({ message: `${channel} not found` }));

    if (channel === 'tickerArbs') _initChannelBroker(channel, payload); // maybe should be simplified

    if (channel === 'obArbs') {
      subscriber.send(JSON.stringify({ channel, targets: scanManager.getTargets() }));
    }

  }

  unsubscribe(channel) {
    logger.info(`Subscription from ${channel} terminated`);
    this.brokers[channel] && this.brokers[channel].terminateInterval();
  }

  trigger(channel, { name, params }) {
    const { subscriber, _obTriggerFunctions } = this;

    if (!name) subscriber.send(JSON.stringify({ message: "Trigger not found" }));
    subscriber.send(JSON.stringify({ message: `Triggering ${name} @ ${channel}` }));

    switch (channel) {
      case 'obArbs':
        _obTriggerFunctions(name, params);
        break;
      default:
        break;
    }
  }

  _obTriggerFunctions(name, params) {
    const { scanManager, subscriber } = this;

    switch (name) {
      case 'addTarget':
        scanManager.addTarget(params.target);
        break;
      case 'clearTargets':
        scanManager.clearTargets();
      default:
        break;
    };

    subscriber.send(JSON.stringify({ channel: 'obArbs', targets: scanManager.getTargets() }));
  }

  _initChannelBroker(channel, { params }) {
    let { subscriber, brokers, channels, exchanges, arbitrage } = this;
    const interval = brokers[channel].getInterval();
    if (interval && interval.duration) return;

    if (channel === 'tickerArbs') {
      // for the fetchMarketTickers there is no sense
      // of fetching more frequent than 3s because
      // of the all the responses wait-time
      brokers.tickerArbs.setInterval(params && params.interval >= 3 ? params.interval : 3, [
        async () => {
          const tickers = await exchanges.fetchMarketTickers();
          const { arbs } = arbitrage.scanAllMarketTickers({ tickers });

          subscriber.send(
            JSON.stringify({
              channel,
              arbs,
              interval: params && params.interval >= 3 ? params.interval : 3,
            }),
          );
        },
      ]);
    }
  }

  clearBrokers() {
    logger.info('WS: terminating brokers');
    Object.values(this.brokers).forEach((broker) => {
      broker.terminateInterval();
    });
  }
};
