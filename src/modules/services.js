const path = require('path');

const { createLogger, transports, format } = require('winston');

const BinanceSpotClient = require('./connectors/binance-spot');
const GateioSpotClient = require('./connectors/gateio-spot');

let exchanges;
let logger;

module.exports = {
  boot: () => console.log('empty boot()'),

  getExchanges: async function () {
    if (exchanges) {
      return exchanges;
    }

    const binanceSpot = await new BinanceSpotClient(
      process.env.APIKEY_PUBLIC_BINANCE_SPOT,
      process.env.APIKEY_PRIVATE_BINANCE_SPOT,
      'eventEmitter',
      this.getLogger(),
    );
    const gatioSpot = await new GateioSpotClient(
      process.env.APIKEY_PUBLIC_GATEIO_SPOT,
      process.env.APIKEY_PRIVATE_GATEIO_SPOT,
      'eventEmitter',
      this.getLogger(),
    );

    await binanceSpot.init();
    await gatioSpot.init();

    return (exchanges = [binanceSpot, gatioSpot]);
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
        // new transports.File({
        //   filename: `${path.resolve(__dirname)}/logs.json`,
        //   level: 'debug',
        // }),
      ],
    }));
  },
};
