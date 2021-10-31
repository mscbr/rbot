var ccxt = require('ccxt');

const TickerEvent = require('../models/ticker-event');
const Ticker = require('../models/ticker');

const Arbitrage = require('../modules/scan/arbitrage');

module.exports = class SingleMarketRecorder {
  constructor(logger) {
    this.logger = logger;

    this.exchanges = {};
    this.tickers = {};

    this.marketsForExchanges = {};

    this.arbitrage = new Arbitrage((data) => {}, logger, {});
    this.arbs = {};

    this._tickersToArbs = this._tickersToArbs.bind(this);
  }

  async init() {
    await this._loadExchanges();
    await this._loadMarkets();
  }

  _loadExchanges(ids = ['binance', 'getio', 'ascendex', 'poloniex', 'bitfinex', 'kraken']) {
    this.exchanges = {
      binance: new ccxt.binance(),
      gateio: new ccxt.gateio(),
      ascendex: new ccxt.ascendex(),
      poloniex: new ccxt.poloniex(),
      bitfinex: new ccxt.bitfinex(),
      kraken: new ccxt.kraken(),
    };
  }

  async _loadMarkets() {
    const { exchanges, logger } = this;

    const marketPromises = Object.values(exchanges)
      .filter((exchange) => exchange.has['fetchTickers'])
      .map(async (exchange) => await exchange.loadMarkets());

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

  async _fetchTickers() {
    const { exchanges, _getMarketsForExchanges, logger, init } = this;
    const marketsForExchanges = this._getMarketsForExchanges();

    const tickerPromises = Object.values(exchanges).reduce((acc, exchange) => {
      if (exchange.id === 'ascendex') {
        acc[exchange.id] = exchange.fetchTickers();
      } else {
        acc[exchange.id] = exchange.fetchTickers(marketsForExchanges[exchange.id]);
      }
      return acc;
    }, {});

    const tickersArr = await Promise.all(Object.values(tickerPromises));

    Object.keys(tickerPromises).forEach((exchange, i) => {
      Object.keys(tickersArr[i]).forEach((market) => {
        const ticker = tickersArr[i][market];
        const dateNow = Date.now();
        this.tickers[market] = {
          ...this.tickers[market],
          [exchange]: new TickerEvent(
            exchange,
            market,
            ticker.symbol,
            ticker.symbol.split('/')[0],
            ticker.symbol.split('/')[1],
            exchanges[exchange].markets[market].taker,
            new Ticker(dateNow, ticker.bid, ticker.ask),
          ),
        };
      });
    });

    return this.tickers;
  }

  _spread(bid, ask, fees = []) {
    return bid / ask - fees.reduce((acc, val) => acc + val, 0);
  }

  async _tickersToArbs() {
    let { logger, arbs, arbitrage } = this;

    const tickers = await this._fetchTickers();
    const markets = Object.keys(tickers);

    for (let i = 0; i < markets.length; i++) {
      const singleScan = arbitrage.singleMarketScan(Object.values(tickers[markets[i]]), 0.009);

      if (singleScan) {
        arbs = {
          ...arbs,
          [markets[i]]: singleScan,
        };
        logger.debug(arbitrage.sortArbsByProfit(arbs));
      }
    }
  }

  async scanForArbs(_interval = 0) {
    const { _tickersToArbs } = this;
    if (_interval) {
      const interval = _interval * 1000;
      setInterval(async () => {
        await _tickersToArbs();
      }, interval);
    } else {
      await _tickersToArbs();
    }
  }
};
