const { exchanges } = require('ccxt');

module.exports = class Path {
  constructor({ id, market, exchanges, tradeFees, transferFees }) {
    this.id = id;
    this.market = market;
    this.exchanges = exchanges;
    this.transferFees = 0;
    this.tradeFees = tradeFees;
    this.arbs = null;
  }

  // how to store arbs
  // think about saving historical data
  get path() {
    return {
      id: this.id,
      market: this.market,
      exchanges: this.exchanges,
      transferFees: this.transferFees, // ~ -
      tradeFees: this.tradeFees, // ~ * - for simplicity
      arbs: this.arbs,
    };
  }

  setArbs(arbs) {
    this.arbs = arbs;
  }

  // addTransferFees()
  // removeTransferFee()
};
