const services = require('../services');
const logger = services.getLogger();

const Arbitrage = require('../modules/arb/arbitrage');

module.exports = class WsTrigSubManager {
  constructor(exchanges, arbitrage) {
    this.exchanges = exchanges;
    this.arbitrage = new Arbitrage(logger);

    this.channels = {
      tickerArbs: {
        arbs: [],
        subscriber: null,
      },
      obArbs: {
        arbs: [],
        subscriber: null,
      },
    };

    this.brokers = {
      tickerArbs: services.getInterval(),
      obArbs: services.getInterval(),
    };

    this._initChannelBroker = this._initChannelBroker.bind(this);
  }

  subscribe(subscriber, channel) {
    const { _initChannelBroker } = this;
    logger.info(`WS: new subscription to ${channel}`);
    if (this.channels[channel]) subscriber.send(JSON.stringify({ message: `Subscribitng to ${channel}` }));
    else subscriber.send(JSON.stringify({ message: `${channel} not found` }));

    this.channels[channel].subscriber = subscriber;
    _initChannelBroker(channel);
  }

  unsubscribe(channel) {
    logger.info(`Subscription from ${channel} terminated`);
    this.brokers[channel].terminateInterval();
  }

  _initChannelBroker(channel) {
    let { brokers, channels, exchanges, arbitrage } = this;
    const interval = brokers[channel].getInterval();
    if (interval && interval.duration) return;

    if (channel === 'tickerArbs') {
      brokers.tickerArbs.setInterval(5, [
        async () => {
          const tickers = await exchanges.fetchMarketTickers();
          const { arbs } = arbitrage.scanAllMarketTickers({ tickers });

          channels[channel].subscriber.send(
            JSON.stringify({
              channel,
              arbs,
              interval: interval && interval.duration,
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

  trigger(channel, f, params) {
    //f list switch
  }
};
