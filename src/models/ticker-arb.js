module.exports = class TickerArb {
  constructor(market, askPrice, askExchange, bidPrice, bidExchange, profit, fees, symbolStatus) {
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
    this.transferFees = {}; // {fix: number, percent: number, quoteEstimation: {[coin]: number}}
    this.symbolStatus = symbolStatus;
  }
};
