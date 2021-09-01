module.exports = class Market {
  constructor(exchange, marketInfo) {
    if (exchange === 'binance_spot') {
      this.symbol = marketInfo.symbol;
      this.baseAsset = marketInfo.baseAsset;
      this.quoteAsset = marketInfo.quoteAsset;
      this.pricePrecision = marketInfo.quoteAssetPrecision || marketInfo.baseAssetPrecision; // check if differentiation is needed ??
      this.quantityPrecision = marketInfo.quotePrecision; // compare with gateio api
      this.fee = 0.1;
    } else if (exchange === 'gateio_spot') {
      this.symbol = marketInfo.id.split('_').join('');
      this.baseAsset = marketInfo.base;
      this.quoteAsset = marketInfo.quote;
      this.pricePrecision = marketInfo.precision;
      this.quantityPrecision = marketInfo.amount_precision;
      this.fee = parseFloat(marketInfo.fee);
    }
  }
};
