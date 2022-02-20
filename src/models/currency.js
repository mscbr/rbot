module.exports = class Currency {
  constructor(symbol, withdrawDisabled) {
    this.symbol = symbol;
    this.withdrawDisabled = withdrawDisabled;
    this.withdrawMin = 0;
    this.anyToWithdraw = false;
    // this is assgined later but
    // not defined here in order to
    // easier check if it is nullish
    // this.withdrawFee = {}; // {fix: number, percent: number, quoteEstimation: {[coin]: number}}
  }
};
