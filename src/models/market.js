module.exports = class Market {
  constructor(exchange, marketInfo) {
    if (exchange === 'binance_spot') {
      this.symbol = marketInfo.symbol;
      this.baseAsset = marketInfo.baseAsset;
      this.quoteAsset = marketInfo.quoteAsset;
      this.pricePrecision = marketInfo.quoteAssetPrecision || marketInfo.baseAssetPrecision; // check if differentiation is needed ??
      this.quantityPrecision = marketInfo.quotePrecision; // compare with gateio api
      this.fee = 0.001;
    } else if (exchange === 'gateio_spot') {
      this.symbol = marketInfo.id;
      this.baseAsset = marketInfo.base;
      this.quoteAsset = marketInfo.quote;
      this.pricePrecision = marketInfo.precision;
      this.quantityPrecision = marketInfo.amount_precision;
      this.fee = parseFloat(marketInfo.fee) / 100;
    } else if (exchange === 'bitforex_spot') {
      const baseQuote = marketInfo.symbol
        .split('-')
        .slice(1, 3)
        .reverse()
        .map((item) => item.toUpperCase());
      this.symbol = marketInfo.symbol;
      this.baseAsset = baseQuote[0];
      this.quoteAsset = baseQuote[1];
      this.pricePrecision = marketInfo.pricePrecision;
      this.quantityPrecision = marketInfo.amountPrecision;
      this.fee = 0.001;
    }
  }
};
