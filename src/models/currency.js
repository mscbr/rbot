module.exports = class Currency {
  constructor(symbol, withdrawDisabled) {
    this.symbol = symbol;
    this.withdrawDisabled = withdrawDisabled;
  }
};
