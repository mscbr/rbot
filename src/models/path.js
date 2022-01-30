module.exports = class Path {
  constructor({ id, market, exchanges, tradeFees, transferFees }) {
    this.id = id;
    this.market = market;
    this.exchanges = exchanges;
    this.transferFees = transferFees;
    this.tradeFees = tradeFees;
    this.arbs = null;
  }

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
};
