const path = require('path');
const events = require('events');

const { createLogger, transports, format } = require('winston');

const BinanceSpotClient = require('./connectors/binance-spot');
const GateioSpotClient = require('./connectors/gateio-spot');
const BitforexSpotClient = require('./connectors/bitforex-spot');

let exchanges;
let collections;
let logger;
let eventEmitter;

module.exports = {
  boot: () => console.log('empty boot()'),

  getExchanges: async function () {
    if (exchanges) {
      return exchanges;
    }
    const logger = this.getLogger();

    const binanceSpot = await new BinanceSpotClient(
      process.env.APIKEY_PUBLIC_BINANCE_SPOT,
      process.env.APIKEY_PRIVATE_BINANCE_SPOT,
      this.getEventEmitter(),
      logger,
    );
    const gateioSpot = await new GateioSpotClient(
      process.env.APIKEY_PUBLIC_GATEIO_SPOT,
      process.env.APIKEY_PRIVATE_GATEIO_SPOT,
      this.getEventEmitter(),
      logger,
    );
    const bitforexSpot = new BitforexSpotClient(
      process.env.APIKEY_PUBLIC_BITFOREX_SPOT,
      process.env.APIKEY_PRIVATE_BITFOREX_SPOT,
      this.getEventEmitter(),
      logger,
    );

    try {
      await Promise.all([binanceSpot.init(), gateioSpot.init(), bitforexSpot.init()]);
    } catch (err) {
      logger.error(err.message);
      return err;
    }

    return (exchanges = [binanceSpot, gateioSpot, bitforexSpot]);
  },

  getLogger: function () {
    if (logger) {
      return logger;
    }

    return (logger = createLogger({
      format: format.combine(
        format.prettyPrint(),
        format.colorize({ colors: { info: 'green', error: 'red', debug: 'yellow' }, all: true }),
      ),
      transports: [
        new transports.Console({
          level: 'debug',
        }),
        new transports.File({
          filename: `${path.resolve(__dirname)}/logs.json`,
          level: 'debug',
        }),
      ],
    }));
  },

  // collection of market: [exchanges]
  getCollection: async function (withSingles = false) {
    if (collections) {
      return collections;
    }
    const exchanges = await this.getExchanges();

    collections = exchanges.reduce((acc, val) => {
      for (market in val.markets) {
        if (acc[market]) {
          acc[market] = [val.id, ...acc[market]];
        } else {
          acc[market] = [val.id];
        }
      }
      return acc;
    }, {});

    if (withSingles) return collections;

    return Object.keys(collections).reduce((acc, val) => {
      if (collections[val].length > 1) {
        acc[val] = collections[val];
        return acc;
      }
      return acc;
    }, {});
  },

  getCollectionStream: async function (selected = []) {
    const exchanges = await this.getExchanges();
    const collection = await this.getCollection();
    const markets = exchanges.reduce((acc, { id }) => {
      acc[id] = Object.keys(collection).filter((market) => collection[market].includes(id));
      return acc;
    }, {});
    const emitter = this.getEventEmitter();

    exchanges
      .filter((exchange) => (selected.length ? selected.includes(exchange.id) : true))
      .forEach((exchange) => exchange.startMarketStream(markets[exchange.id]));

    return (cb) =>
      emitter.on('ticker', (data) => {
        cb && cb(data);
      });
  },

  getEventEmitter: function () {
    if (eventEmitter) return eventEmitter;
    return (eventEmitter = new events.EventEmitter());
  },
};
