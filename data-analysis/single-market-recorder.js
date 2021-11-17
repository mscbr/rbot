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

    this.scanIntervalId = null;
  }

  async init() {
    await this._loadExchanges();
    await this._loadMarkets();
  }

  async _loadExchanges() {
    this.exchanges = {
      binance: new ccxt.binance(),
      gateio: new ccxt.gateio(),
      ascendex: new ccxt.ascendex(),
      poloniex: new ccxt.poloniex(),
      bitfinex: new ccxt.bitfinex(),
      kraken: new ccxt.kraken(),
      bitvavo: new ccxt.bitvavo(),
      bitmart: new ccxt.bitmart(),
      ftx: new ccxt.ftx(),
      hitbtc: new ccxt.hitbtc(),
      okcoin: new ccxt.okcoin(),
      // bitforex: new ccxt.bitforex(),// doesnt have fetchTickers
    };
  }

  async _loadMarkets() {
    const { exchanges, logger } = this;

    const marketPromises = Object.values(exchanges)
      .filter((exchange) => exchange.has['fetchTickers'])
      .map(async (exchange) => await exchange.loadMarkets());

    logger.info('Loading markets...');
    await Promise.all(marketPromises);
    Object.values(exchanges).map((exchange) => {
      logger.info(`Loaded ${Object.keys(exchange.markets).length} markets for ${exchange.id}`);
    });
  }

  // param: exclude = {[exchange]: [market1, market2...]}
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

    // does it return pointer to the original object
    // or just a value?
    return this.tickers;
  }

  // not used within the class
  _spread(bid, ask, fees = []) {
    return bid / ask - fees.reduce((acc, val) => acc + val, 0);
  }

  // maybe it shouldn'tbe async f()
  // but take tickers as a param
  async _tickersToArbs() {
    let { logger, arbs, arbitrage, exchanges } = this;

    logger.info('Fetching tickers...');
    const tickers = await this._fetchTickers();
    const markets = Object.keys(tickers);

    for (let i = 0; i < markets.length; i++) {
      const singleScan = arbitrage.singleMarketScan(Object.values(tickers[markets[i]]), 0.09);

      if (singleScan) {
        arbs = {
          ...arbs,
          [markets[i]]: singleScan,
        };
      }
    }
    const sortedArbs = arbitrage.sortArbsByProfit(arbs);
    logger.debug(sortedArbs);
    logger.debug(`OPPORTUNITIES No. ${sortedArbs.length}`);
    const occurencies = sortedArbs
      .reduce((acc, val) => {
        acc = [...acc, val.lowestAsk.exchange, val.highestBid.exchange];
        return acc;
      }, [])
      .reduce((acc, val) => {
        if (!acc[val]) acc[val] = 1;
        else acc[val]++;
        return acc;
      }, {});
    logger.debug(occurencies);
  }

  async scanForArbs(_interval = 0) {
    const { _tickersToArbs } = this;
    if (_interval) {
      const interval = _interval * 1000;
      this.scanIntervalId = setInterval(async () => {
        await _tickersToArbs();
      }, interval);
    } else {
      await _tickersToArbs();
    }
  }

  terminateScan() {
    if (this.scanIntervalId) clearInterval(this.scanIntervalId);
    this.logger.error('ARB SCAN TERMINATED');
  }
};
