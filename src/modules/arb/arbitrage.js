const fs = require('fs');
const path = require('path');

const TickerArb = require('../../models/ticker-arb');

module.exports = class Arbitrage {
  constructor() {
    this.marketsData = {};

    this._scanMarketTickersForArbs = this._scanMarketTickersForArbs.bind(this);
  }

  init() {
    return;
  }

  _spread(bid, ask, fees = []) {
    return bid / ask - fees.reduce((acc, val) => acc + val, 0);
  }

  _scanMarketTickersForArbs(tickerData, highPass = 0.001, lowPass = 0.7) {
    const invalidSymbols = JSON.parse(fs.readFileSync(path.resolve('./src/static-data/invalid-symbols.json')));
    const exchanges = Object.keys(tickerData);
    let arbs = [];

    for (let i = 0; i < exchanges.length - 1; i++) {
      const reference = tickerData[exchanges[i]];
      const coin = reference.symbol.split('/')[0];
      for (let g = i + 1; g < exchanges.length; g++) {
        const checkup = tickerData[exchanges[g]];
        const fees = [reference.fee, checkup.fee];
        let symbolStatus = null;

        if (invalidSymbols[coin]) {
          const targetConnection = invalidSymbols[coin].find(
            (arr) => arr.includes(exchanges[i]) && arr.includes(exchanges[g]),
          );
          if (targetConnection) symbolStatus = targetConnection[2];
        }

        if (reference.ask < checkup.bid) {
          const spread = this._spread(checkup.bid, reference.ask, fees);
          if (spread < 1 + lowPass && spread > 1 + highPass) {
            arbs.push(
              new TickerArb(
                reference.symbol,
                reference.ask,
                exchanges[i],
                checkup.bid,
                exchanges[g],
                spread,
                fees,
                symbolStatus,
              ),
            );
          }
        } else if (checkup.ask < reference.bid) {
          const spread = this._spread(reference.bid, checkup.ask, fees);
          if (spread < 1 + lowPass && spread > 1 + highPass) {
            arbs.push(
              new TickerArb(
                checkup.symbol,
                checkup.ask,
                exchanges[g],
                reference.bid,
                exchanges[i],
                spread,
                fees,
                symbolStatus,
              ),
            );
          }
        }
      }
    }

    if (arbs.length) return arbs;
  }

  scanAllMarketTickers({ tickers, highPass, lowPass }) {
    let { _scanMarketTickersForArbs, exchanges } = this;
    const markets = Object.keys(tickers);
    let arbs = {};

    for (let i = 0; i < markets.length; i++) {
      const marketTickerScan = _scanMarketTickersForArbs(tickers[markets[i]], highPass, lowPass);

      if (marketTickerScan) {
        arbs = {
          ...arbs,
          [markets[i]]: marketTickerScan,
        };
      }
    }

    const sortedArbs = this.sortArbsByProfit(
      Object.values(arbs).reduce((acc, arbArr) => {
        acc = [...acc, ...arbArr];
        return acc;
      }, []),
    );

    return {
      arbs: sortedArbs,
      opportunitiesCount: sortedArbs.length,
    };
  }

  sortArbsByProfit(arbs) {
    return Object.values(arbs).sort((a, b) => b.profit - a.profit);
  }

  singleMarketObScan(obData, levels = [10, 50, 100, 200]) {
    const {
      in: { asks },
      out: { bids },
      tradeFee,
    } = obData;

    // mapping volume of currency regarding levels variable
    const levelWallets = asks.reduce((acc, _, idx) => {
      const accLength = Object.keys(acc).length;
      if (accLength === levels.length) return acc;

      const currentLevelValueVolume = asks.slice(0, idx + 1).reduce(
        // priceVolume = [price, volume]
        (cum, priceVolume) => {
          cum.value += parseFloat(priceVolume[0]) * parseFloat(priceVolume[1]);
          cum.volume += parseFloat(priceVolume[1]);
          return cum;
        },
        { value: 0, volume: 0 },
      );

      if (currentLevelValueVolume.value > levels[accLength]) {
        acc[accLength] = currentLevelValueVolume;
        return acc;
      }
      return acc;
    }, {});

    const output = Object.keys(levelWallets).reduce((acc, key, idx) => {
      const { value } = levelWallets[key];
      let volume = levelWallets[key].volume;

      const postVal = bids.reduce((valAcc, bid) => {
        const bidVol = parseFloat(bid[1]);
        const bidPrice = parseFloat(bid[0]);

        if (volume === 0) return valAcc;
        if (volume - bidVol >= 0) {
          valAcc += bidPrice * bidVol;
          volume -= bidVol;
          return valAcc;
        }
        if (volume - bidVol < 0) {
          for (let i = 1; i <= bidVol; i++) {
            if (volume > 0) {
              valAcc += bidPrice;
              // as we perform "-1 from volume"
              // this method is invalid for currencies
              // using floating points (ETH, BTC etc)
              volume -= 1;
              return valAcc;
            }
          }
        }
        return valAcc;
      }, 0);

      acc[key] = {
        preVal: value.toString(),
        postVal: postVal.toString(),
        arb: postVal / value - tradeFee,
      };

      return acc;
    }, {});

    return output;
  }
};
