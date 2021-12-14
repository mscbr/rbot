module.exports = class Arbitrage {
  constructor(logger) {
    this.logger = logger;

    this.marketsData = {};

    this.singleMarketTickerScan = this.singleMarketTickerScan.bind(this);
  }

  init() {
    return;
  }

  _spread(bid, ask, fees = []) {
    return bid / ask - fees.reduce((acc, val) => acc + val, 0);
  }

  singleMarketTickerScan(tickerData, hPass = 0.01, lPass = 0.6) {
    // FIX: display all the arbs, NOT the best one only

    //find the lowest ask and the highest bid
    const arb = Object.keys(tickerData).reduce((acc, exchange, idx) => {
      if (!tickerData[exchange]) return acc;
      const { symbol, bid, ask, fee } = tickerData[exchange];
      acc.market = symbol;

      if (!idx) {
        acc.lowestAsk = {
          exchange,
          price: ask,
          fee,
        };
        acc.highestBid = {
          exchange,
          price: bid,
          fee,
        };
        return acc;
      }

      if (acc.lowestAsk.price > ask) {
        acc.lowestAsk = {
          exchange,
          price: ask,
          fee,
        };
      }
      if (acc.highestBid.price < bid) {
        acc.highestBid = {
          exchange,
          price: bid,
          fee,
        };
      }
      return acc;
    }, {});

    arb.profit = this._spread(arb.highestBid.price, arb.lowestAsk.price, [arb.highestBid.fee, arb.lowestAsk.fee]);

    if (arb.profit > 1 + lPass) return null;
    if (arb.profit > 1 + hPass) return arb;
    return null;
  }

  scanAllMarketTickers({ tickers, hPass, lPass }) {
    let { logger, singleMarketTickerScan, exchanges } = this;
    const markets = Object.keys(tickers);
    let arbs = {};

    for (let i = 0; i < markets.length; i++) {
      const singleScan = singleMarketTickerScan(tickers[markets[i]]);

      if (singleScan) {
        arbs = {
          ...arbs,
          [markets[i]]: singleScan,
        };
      }
    }
    const sortedArbs = this.sortArbsByProfit(arbs);
    return {
      arbs: sortedArbs,
      opportunitiesCount: sortedArbs.length,
    };
  }

  sortArbsByProfit(arbs) {
    return Object.values(arbs).sort((a, b) => b.profit - a.profit);
  }

  singleMarketObScan(obData, levels = [500, 1000, 5000, 10000]) {
    const {
      in: { asks },
      out: { bids },
      tradeFee,
      transferFee, // logic NOT implemented
    } = obData;

    const levelWallets = asks.reduce((acc, priceVol, idx) => {
      const accLength = Object.keys(acc).length;
      if (accLength === levels.length) return acc;

      const levelValVol = asks.slice(0, idx + 1).reduce(
        (cum, pV) => {
          cum.val += pV[0] * pV[1];
          cum.vol += pV[1];
          return cum;
        },
        { val: 0, vol: 0 },
      );

      if (levelValVol.val > levels[accLength]) {
        acc[accLength] = levelValVol;
        return acc;
      }
      return acc;
    }, {});

    // FIX:
    // {} 'NAV/BTC' hitbtc
    // ticker size not implemented BTC to "small"
    // console.log(levelWallets);

    const output = Object.keys(levelWallets).reduce((acc, key, idx) => {
      const { val } = levelWallets[key];
      let vol = levelWallets[key].vol;

      const postVal = bids.reduce((valAcc, bid) => {
        if (vol === 0) return valAcc;
        if (vol - bid[1] >= 0) {
          valAcc += bid[0] * bid[1];
          vol -= bid[1];
          return valAcc;
        }

        // reccurence based on the ticker size
        // probably should be implemented below
        if (vol - bid[1] < 0) {
          for (let i = 1; i <= bid[1]; i++) {
            if (vol > 0) {
              valAcc += bid[0];
              vol -= 1;
              return valAcc;
            }
          }
        }
        return valAcc;
      }, 0);

      acc[key] = {
        preVal: val.toString(),
        postVal: postVal.toString(),
        arb: postVal / val - tradeFee,
      };

      return acc;
    }, {});

    return output;
  }
};
