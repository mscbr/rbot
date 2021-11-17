const services = require('../services');
const logger = services.getLogger();
// const tickerInterval = services.getInterval();

module.exports = class WsTrigSubManager {
  constructor(exchanges, arbitrage) {
    this.exchanges = exchanges;
    this.arbitrage = arbitrage;

    this.channels = {
      tickerArbs: {
        arbs: [],
        subscribers: [],
      },
      obArbs: {
        arbs: [],
        subscribers: [],
      },
    };

    this.brokers = {
      tickerArbs: services.getInterval(),
      obArbs: services.getInterval(),
    };

    this.initChannelBroker = this.initChannelBroker.bind(this);
  }

  subscribe(subscriber, channel) {
    const { initChannelBroker } = this;
    logger.info(`WS: new subscription to ${channel}`);

    this.channels[channel].subscribers.push(subscriber);
    initChannelBroker(channel);
  }

  initChannelBroker(channel) {
    let { brokers, channels, exchanges, arbitrage } = this;
    if (brokers[channel].getInterval()) return;

    if (channel === 'tickerArbs') {
      brokers.tickerArbs.setInterval(5, async () => {
        const tickers = await exchanges.fetchMarketTickers();
        const { arbs } = arbitrage.scanAllMarketTickers({ tickers });

        channels[channel].subscribers.forEach((subscriber) => {
          subscriber.send(
            JSON.stringify({
              channel,
              message: arbs,
            }),
          );
        });
      });
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
