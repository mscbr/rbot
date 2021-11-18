const ccxt = require('ccxt');

module.exports = class Exchanges {
  constructor(logger) {
    this.logger = logger;

    this.exchanges = {};
    //in order to implement market/exchange exclusion
    //write a f() to adjust marketsForExchanges
    this.marketsForExchanges = {};

    this.tickers = {};

    this._getMarketsForExchanges = this._getMarketsForExchanges.bind(this);
  }

  async init() {
    await this._loadExchanges();
    await this._loadMarkets();
  }

  async _loadExchanges() {
    this.exchanges = {
      binance: new ccxt.binance({ enableRateLimit: true }),
      gateio: new ccxt.gateio({ enableRateLimit: true }),
      ascendex: new ccxt.ascendex({ enableRateLimit: true }),
      poloniex: new ccxt.poloniex({ enableRateLimit: true }),
      bitfinex: new ccxt.bitfinex({ enableRateLimit: true }),
      kraken: new ccxt.kraken({ enableRateLimit: true }),
      bitvavo: new ccxt.bitvavo({ enableRateLimit: true }),
      bitmart: new ccxt.bitmart({ enableRateLimit: true }),
      ftx: new ccxt.ftx({ enableRateLimit: true }),
      hitbtc: new ccxt.hitbtc({ enableRateLimit: true }),
    };
  }

  async _loadMarkets() {
    const { exchanges, logger } = this;

    const marketPromises = Object.values(exchanges).map(async (exchange) => await exchange.loadMarkets());

    // console.log(Object.keys(exchanges).forEach((key) => console.log(key, exchanges[key].rateLimit)));

    logger.info('Loading markets...');
    await Promise.all(marketPromises);
  }

  _getMarketsForExchanges() {
    let { exchanges, marketsForExchanges } = this;

    if (!!Object.keys(marketsForExchanges).length) return marketsForExchanges;

    let exchangesForMarkets = Object.values(exchanges).reduce((acc, exchange) => {
      for (let market in exchange.markets) {
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

    marketsForExchanges = Object.keys(exchangesForMarkets).reduce((acc, market) => {
      exchangesForMarkets[market].forEach((exchange) => {
        if (!acc[exchange]) acc[exchange] = [];
        acc[exchange].push(market);
      });
      return acc;
    }, {});

    return marketsForExchanges;
  }

  async fetchMarketTickers() {
    const { exchanges, _getMarketsForExchanges, logger, excludedMarkets, excludedExchanges } = this;
    const marketsForExchanges = _getMarketsForExchanges();

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
        this.tickers[market] = {
          ...this.tickers[market],
          [exchange]: { ...ticker, fee: exchanges[exchange].markets[market].taker },
        };
      });
    });

    return this.tickers;
  }

  // fetchOrderBook
  //   rateLimit: A request rate limit in milliseconds.
  // Specifies the required minimal delay between two consequent HTTP requests to the same exchange.
  // The built-in rate-limiter is disabled by default and is turned on by setting the enableRateLimit property to true.
  //  enableRateLimit: A boolean (true/false) value that enables the built-in rate limiter
  // and throttles consecutive requests. This setting is true (enabled) by default. The user
  // is required to implement own :ref:`rate limiting <rate limit>` or leave the built-in rate limiter
  //  enabled to avoid being banned from the exchange.

  // https://withdrawalfees.com/exchanges/hitbtc
};
