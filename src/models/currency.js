module.exports = class Currency {
  constructor(symbol, withdrawDisabled) {
    this.symbol = symbol;
    this.withdrawDisabled = withdrawDisabled;
    this.withdrawMin = 0;
    this.anyToWithdraw = false;
    this.withdrawFee = {};
  }

  // set withdrawFee({ fix, percent = 0, fixUsdt }) {
  //   this.withdrawFee = { fix, percent, fixUsdt };
  // }
};
