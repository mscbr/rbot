module.exports = class Arbitrage {
  constructor(logger) {
    this.logger = logger;
    // this.emitter = emitter;

    this.marketsData = {};
    this.falseMarkets = {};

    this.singleMarketTickerScan = this.singleMarketTickerScan.bind(this);
  }

  init() {
    return;
  }

  _spread(bid, ask, fees = []) {
    return bid / ask - fees.reduce((acc, val) => acc + val, 0);
  }

  // CCXT fetchTickers():
  //   {
  //     'symbol':        string symbol of the market ('BTC/USD', 'ETH/BTC', ...)
  //     'info':        { the original non-modified unparsed reply from exchange API },
  //     'timestamp':     int (64-bit Unix Timestamp in milliseconds since Epoch 1 Jan 1970)
  //     'datetime':      ISO8601 datetime string with milliseconds
  //     'high':          float, // highest price
  //     'low':           float, // lowest price
  //     'bid':           float, // current best bid (buy) price
  //     'bidVolume':     float, // current best bid (buy) amount (may be missing or undefined)
  //     'ask':           float, // current best ask (sell) price
  //     'askVolume':     float, // current best ask (sell) amount (may be missing or undefined)
  //     'vwap':          float, // volume weighed average price
  //     'open':          float, // opening price
  //     'close':         float, // price of last trade (closing price for current period)
  //     'last':          float, // same as `close`, duplicated for convenience
  //     'previousClose': float, // closing price for the previous period
  //     'change':        float, // absolute change, `last - open`
  //     'percentage':    float, // relative change, `(change/open) * 100`
  //     'average':       float, // average price, `(last + open) / 2`
  //     'baseVolume':    float, // volume of base currency traded for last 24 hours
  //     'quoteVolume':   float, // volume of quote currency traded for last 24 hours
  //     'exchange': string
  // }

  singleMarketTickerScan(tickerData, hPass = 0.06, lPass = 1) {
    //find the lowest ask and the highest bid

    const arb = Object.keys(tickerData).reduce((acc, exchange, idx) => {
      if (!tickerData[exchange]) return acc;
      const { symbol, bid, ask, fee } = tickerData[exchange];
      acc.market = symbol;

      if (!idx) {
        acc.lowestAsk = {
          exchange,
          price: ask,
          fee,
        };
        acc.highestBid = {
          exchange,
          price: bid,
          fee,
        };
        return acc;
      }

      if (acc.lowestAsk.price > ask) {
        acc.lowestAsk = {
          exchange,
          price: ask,
          fee,
        };
      }
      if (acc.highestBid.price < bid) {
        acc.highestBid = {
          exchange,
          price: bid,
          fee,
        };
      }
      return acc;
    }, {});

    arb.profit = this._spread(arb.highestBid.price, arb.lowestAsk.price, [arb.highestBid.fee, arb.lowestAsk.fee]);

    if (arb.profit > 1 + lPass) return null;
    if (arb.profit > 1 + hPass) return arb;
    return null;
  }

  scanAllMarketTickers({ tickers, hPass, lPass }) {
    let { logger, singleMarketTickerScan, exchanges } = this;
    const markets = Object.keys(tickers);
    let arbs = {};

    for (let i = 0; i < markets.length; i++) {
      const singleScan = singleMarketTickerScan(tickers[markets[i]]);

      if (singleScan) {
        arbs = {
          ...arbs,
          [markets[i]]: singleScan,
        };
      }
    }
    const sortedArbs = this.sortArbsByProfit(arbs);
    return {
      arbs: sortedArbs,
      opportunitiesCount: sortedArbs.length,
    };
  }

  sortArbsByProfit(arbs) {
    return Object.values(arbs).sort((a, b) => a.profit - b.profit);
  }
};
