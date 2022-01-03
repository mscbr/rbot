module.exports = class OrderBook {
  constructor(id, symbol, asks, bids, timestamp) {
    this.id = id;
    this.symbol = symbol;
    this.asks = asks;
    this.bids = bids;
    this.timestamp = timestamp;
  }
};
