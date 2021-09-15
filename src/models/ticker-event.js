module.exports = class TickerEvent {
  constructor(exchange, symbol, baseAsset, quoteAsset, ticker) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.baseAsset = baseAsset;
    this.quoteAsset = quoteAsset;
    this.ticker = ticker;
  }
};
