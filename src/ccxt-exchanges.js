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
    // await this._loadConversionData();
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

  // async _loadConversionData() {
  //   const { exchanges } = this;
  //   const coreMarkets = ['BTC/USDT', 'ETH/USDT'];

  //   this.logger.info('Loading conversion data...');
  //   for (let i = 0; i < coreMarkets.length; i++) {
  //     const promises = Object.keys(exchanges).reduce((acc, exchange) => {
  //       acc[exchange] = {
  //         [coreMarkets[i]]: exchanges[exchange].fetchTicker(coreMarkets[i]), // use average
  //       };
  //       return acc;
  //     }, {});

  //     try {
  //       const resultsArr = await Promise.all(Object.values(promises).map((promise) => promise[coreMarkets[i]]));
  //       Object.keys(promises).forEach((exchange, i) => {
  //         this.usdtConversionMarkets[exchange] = {
  //           ...this.usdtConversionMarkets[exchange],
  //           [resultsArr[i].symbol]: resultsArr[i],
  //         };
  //       });

  //       if (i < coreMarkets.length - 1) {
  //         // rate limitting to 1s/req to each exchange
  //         setTimeout(() => {}, 1000);
  //       }
  //     } catch {
  //       this.logger.error("Couldn't fetch conversion data");
  //     }
  //   }
  // }

  // usdtTo(coin, exchange) {
  //   if (!coin || (coin !== 'ETH' && coin !== 'BTC')) {
  //     this.logger.error('usdtTo works only w/ ETH & BTC');
  //     return;
  //   }
  //   const { usdtConversionMarkets } = this;
  //   const market = coin + '/USDT';

  //   if (!exchange || !usdtConversionMarkets[exchange][market]) return;

  //   const { ask } = usdtConversionMarkets[exchange][market];
  //   return 1 / ask;
  // }

  get marketsForExchanges() {
    let { exchanges, _marketsForExchanges } = this;

    if (!!Object.keys(_marketsForExchanges).length) return _marketsForExchanges;

    let exchangesForMarkets = Object.values(exchanges).reduce((acc, exchange) => {
      for (let market in exchange.markets) {
        // maybe there should be HOF for transfer related checkups?
        // filtering out
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
