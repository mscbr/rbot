module.exports = class TickerArb {
  constructor(market, askPrice, askExchange, bidPrice, bidExchange, profit, fees) {
    this.market = market;
    this.ask = {
      price: askPrice,
      exchange: askExchange,
    };
    this.bid = {
      price: bidPrice,
      exchange: bidExchange,
    };
    this.profit = profit;
    this.fees = fees;
  }
};
