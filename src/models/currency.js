module.exports = class Currency {
  constructor(symbol, withdrawDisabled) {
    this.symbol = symbol;
    this.withdrawDisabled = withdrawDisabled;
    // this.withdrawAvailable = withdrawAvailable;
    // this.withdrawMin = withDrawMin;
    // this.withdrawFee = {};
  }

  set withdrawFee({ fix, percent, fixUsdt }) {
    this.withdrawFee = { fix, percent, fixUsdt };
  }
};
