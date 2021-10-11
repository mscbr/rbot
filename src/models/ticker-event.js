module.exports = class TickerEvent {
  constructor(exchange, market, symbol, baseAsset, quoteAsset, fee, ticker) {
    this.exchange = exchange;
    this.market = market;
    this.symbol = symbol;
    this.baseAsset = baseAsset;
    this.quoteAsset = quoteAsset;
    this.fee = fee;
    this.ticker = ticker;
  }
};
