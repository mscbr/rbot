const ccxt = require('ccxt');

module.exports = class CcxtExchanges {
  constructor(logger) {
    this.logger = logger;

    this.exchanges = {
      // binance: new ccxt.binance({ enableRateLimit: true }),
      gateio: new ccxt.gateio({ enableRateLimit: true }),
      // ascendex: new ccxt.ascendex({ enableRateLimit: true }),
      // poloniex: new ccxt.poloniex({ enableRateLimit: true }),
      // bitfinex: new ccxt.bitfinex({ enableRateLimit: true }),
      // bitforex: new ccxt.bitforex({ enableRateLimit: true }),
      // kraken: new ccxt.kraken({ enableRateLimit: true }),
      // bitvavo: new ccxt.bitvavo({ enableRateLimit: true }), // gives empty OB data
      bitmart: new ccxt.bitmart({ enableRateLimit: true }),
      // ftx: new ccxt.ftx({ enableRateLimit: true }),
      // hitbtc: new ccxt.hitbtc({ enableRateLimit: true }),
    };

    this._marketsForExchanges = {};

    this.tickers = {};

    this.usdtConversionMarkets = {};
  }

  async init() {
    await this._loadMarkets();
  }

  async _loadMarkets() {
    const { exchanges, logger } = this;

    const marketPromises = Object.values(exchanges).map(async (exchange) => {
      try {
        await exchange.loadMarkets();
      } catch (err) {
        logger.error(err.message);
      }
    });

    logger.info('Loading markets...');
    await Promise.all(marketPromises);
  }

  get marketsForExchanges() {
    let { exchanges, _marketsForExchanges } = this;

    if (!!Object.keys(_marketsForExchanges).length) return _marketsForExchanges;

    let exchangesForMarkets = Object.values(exchanges).reduce((acc, exchange) => {
      for (let market in exchange.markets) {
        if (
          exchange.currencies[exchange.markets[market].base] &&
          exchange.currencies[exchange.markets[market].base].payout === false
        ) {
          return acc;
        }

        if (acc[market]) {
          acc[market] = [exchange.id, ...acc[market]];
        } else {
          acc[market] = [exchange.id];
        }
      }
      return acc;
    }, {});

    // filtering out single exchange markets
    Object.keys({ ...exchangesForMarkets }).forEach((key) => {
      if (exchangesForMarkets[key].length < 2) delete exchangesForMarkets[key];
    });

    _marketsForExchanges = Object.keys(exchangesForMarkets).reduce((acc, market) => {
      exchangesForMarkets[market].forEach((exchange) => {
        if (!acc[exchange]) acc[exchange] = [];
        acc[exchange].push(market);
      });
      return acc;
    }, {});

    return _marketsForExchanges;
  }

  async fetchMarketTickers(excludedCoins = []) {
    const { exchanges, marketsForExchanges, logger } = this;

    logger.info('Fetching market tickers...');

    const tickerPromises = Object.values(exchanges).reduce((acc, exchange) => {
      //exceptions
      if (exchange.id === 'ascendex') acc[exchange.id] = exchange.fetchTickers();
      //regular handling
      else acc[exchange.id] = exchange.fetchTickers(marketsForExchanges[exchange.id]);

      return acc;
    }, {});

    const tickersArr = await Promise.all(Object.values(tickerPromises));

    Object.keys(tickerPromises).forEach((exchange, i) => {
      Object.keys(tickersArr[i]).forEach((market) => {
        const ticker = tickersArr[i][market];

        // excludedCoins ~ withdrawal disabled
        const base = ticker.symbol.split('/')[0];
        if (excludedCoins.length && excludedCoins.includes(base)) return;

        this.tickers[market] = {
          ...this.tickers[market],
          [exchange]: { ...ticker, fee: exchanges[exchange].markets[market].maker },
        };
      });
    });

    Object.keys(this.tickers).forEach((key) => {
      if (Object.keys(this.tickers[key]).length < 2) delete this.tickers[key];
    });

    return this.tickers;
  }

  // https://withdrawalfees.com/exchanges/hitbtc
};
