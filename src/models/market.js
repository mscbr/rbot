module.exports = class Market {
  constructor(id, symbol, base, quote, taker, maker, precision = {}) {
    this.id = id;
    this.symbol = symbol;
    this.base = base;
    this.quote = quote;
    this.taker = taker;
    this.maker = maker;
    this.precision = precision;
  }
};
