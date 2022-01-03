const services = require('../services');
const logger = services.getLogger();

const Arbitrage = require('../modules/arb/arbitrage');
const ObScanner = require('../modules/arb/ob-scanner');

module.exports = class WsTrigSubManager {
  constructor(ccxtExchanges, directExchanges, rateLimitManager) {
    this.subscriber = null;

    this.ccxtExchanges = ccxtExchanges;
    this.directExchanges = directExchanges;
    this.arbitrage = new Arbitrage(logger);
    this.obScanner = new ObScanner(ccxtExchanges, directExchanges, rateLimitManager);

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
    this.obScanner.setSubscriber(subscriber); // :thinking_face:
  }

  subscribe(channel, payload) {
    const { _initChannelBroker, subscriber, obScanner } = this;
    if (!subscriber) {
      logger.error(`WS trigsub-manager: subscriber not provided`);
      return;
    }

    logger.info(`WS: new subscription to ${channel}`);

    if (this.channels[channel]) subscriber.send(JSON.stringify({ message: `Subscribitng to ${channel}` }));
    else subscriber.send(JSON.stringify({ message: `${channel} not found` }));

    if (channel === 'tickerArbs') _initChannelBroker(channel, payload); // maybe should be simplified

    if (channel === 'obArbs') {
      subscriber.send(JSON.stringify({ channel, paths: obScanner.paths })); // ?
      this.obScanner.runObFetching();
    }
  }

  unsubscribe(channel) {
    logger.info(`Subscription from ${channel} terminated`);
    this.brokers[channel] && this.brokers[channel].terminateInterval();

    if (channel === 'obArbs') {
      this.obScanner.stopObFetching();
    }
  }

  trigger(channel, { name, params }) {
    const { subscriber, _obTriggerFunctions } = this;

    if (!name) subscriber.send(JSON.stringify({ message: 'Trigger not found' }));
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
    const { obScanner, subscriber } = this;

    switch (name) {
      case 'addPath':
        obScanner.addPath(params.path);
        break;
      case 'clearPaths':
        obScanner.clearPaths();
        break;
      case 'removePath':
        obScanner.removePath(params.path.id);
        break;
      default:
        break;
    }

    subscriber.send(JSON.stringify({ channel: 'obArbs', paths: obScanner.paths }));
  }

  // logic of _initChannelBroker should prolly be moved
  // to ticker-scanner.js
  _initChannelBroker(channel, { params }) {
    let { subscriber, brokers, channels, ccxtExchanges, arbitrage } = this;

    const interval = brokers[channel].getInterval();
    if (interval && interval.duration) return;

    if (channel === 'tickerArbs') {
      // this should be exchange specific!
      const withdrawDisabled = Object.values(this.directExchanges.exchanges).reduce((acc, exchange) => {
        Object.values(exchange.currencies).forEach((currency) => {
          if (currency.withdrawDisabled) acc.push(currency.symbol);
        });
        return acc;
      }, []);

      // for the fetchMarketTickers there is no sense
      // of fetching more frequent than 3s because
      // of the all the responses wait-time
      brokers.tickerArbs.setInterval(params && params.interval >= 3 ? params.interval : 3, [
        async () => {
          const tickers = await ccxtExchanges.fetchMarketTickers(withdrawDisabled);
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
