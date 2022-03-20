const got = require('got');
const WebSocket = require('ws');
const pako = require('pako');
const CryptoJS = require('crypto-js');
const Hex = require('crypto-js/enc-hex');

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const services = require('../../services');
const logger = services.getLogger();

const Market = require('../../models/market');
const Currency = require('../../models/currency');
const OrderBook = require('../../models/orderbook');

module.exports = class Bitmart {
  constructor(publicKey, secretKey, memo) {
    this.id = 'bitmart';
    this._baseUrl = 'https://api-cloud.bitmart.com';
    this._wssUrl = 'wss://ws-manager-compress.bitmart.com/api?protocol=1.1';
    this._publicKey = publicKey;
    this._secretKey = secretKey;
    this._memo = memo;

    this.markets = {};
    this.currencies = {};

    this.ws = null;
    // 60 subs data per 10min after connection
    this.obStream = false;
    this.onObUpdate = null;

    this.openWsConnection = this.openWsConnection.bind(this);
    this.closeWsConnection = this.closeWsConnection.bind(this);
    this.subscribeOb = this.subscribeOb.bind(this);
    this._generateSignature = this._generateSignature.bind(this);
    this.loadFees = this.loadFees.bind(this);
  }

  _getWsClient() {
    const { _wssUrl } = this;
    if (!this.ws) this.ws = new WebSocket(_wssUrl);
    return this.ws;
  }

  _getOnObUpdate() {
    return this.onObUpdate;
  }

  async openWsConnection(restartObSubscriptions) {
    const { _wssUrl, id } = this;

    const obStream = () => this.obStream;

    const ws = this._getWsClient();
    let getOnObUpdate = this._getOnObUpdate;
    getOnObUpdate = getOnObUpdate.bind(this);

    ws.onmessage = function (e) {
      if (!e.data) return;
      const text = typeof e.data === 'string' ? e.data : pako.inflate(e.data, { to: 'string', raw: true });
      let data = {};

      try {
        data = JSON.parse(text);
      } catch (err) {
        logger.error(`Couldn't parse Bitmart WS data ${e.data}`);
      }

      if (Object.keys(data).length) {
        switch (data.table) {
          case 'spot/depth5':
          case 'spot/depth50':
          case 'spot/depth100':
            const { asks, bids, ms_t, symbol } = data.data[0];
            const onObUpdate = getOnObUpdate();

            onObUpdate && onObUpdate(new OrderBook(symbol, symbol.split('_').join('/'), asks, bids, ms_t), id);
            break;
          default:
            break;
        }
      }
    };

    ws.onclose = function (e) {
      logger.error(`Bitmart: Public Stream (${_wssUrl}) connection closed: ${JSON.stringify([e.code, e.message])}`);

      if (obStream()) {
        setTimeout(async () => {
          logger.info(`Bitmart: Public stream (${_wssUrl}) connection reconnecting`);
          await restartObSubscriptions();
        }, 3000);
      }
    };

    return new Promise((resolve, reject) => {
      ws.onopen = function () {
        resolve(ws);
        logger.info(`Bitmart: Public stream (${_wssUrl}) opened.`);

        setInterval(() => {
          ws.send('ping');
        }, 19000);
      };
      ws.onerror = function (e) {
        reject(JSON.stringify([e.code, e.message]));
        logger.error(`Bitmart: Public stream (${_wssUrl}) error: ${JSON.stringify([e.code, e.message])}`);
      };
    });
  }

  closeWsConnection() {
    this.obStream = false;
    this.ws.close();
    this.ws = null;
  }

  subscribeOb(symbol, depth = '5') {
    const ws = this._getWsClient();

    ws.send(
      JSON.stringify({
        op: 'subscribe',
        args: [`spot/depth${depth}:${this.markets[symbol].id}`],
      }),
    );
  }

  // queryString: symbol=BMXBTC&side=BUY
  _generateSignature(timestamp, queryString) {
    return Hex.stringify(CryptoJS.HmacSHA256(timestamp + '#' + this._memo + '#' + queryString, this._secretKey));
  }

  async _makeRequest(method, endpoint, query) {
    const queryString = query ? new URLSearchParams(query).toString() : '';
    const timestamp = Date.now();

    const options = {
      url: this._baseUrl + endpoint,
      searchParams: query,
      headers: {
        'X-BM-KEY': this._publicKey,
        'Content-Type': 'application/json',
        'X-BM-SIGN': this._generateSignature(timestamp, queryString),
        'X-BM-TIMESTAMP': timestamp,
      },
      parseJson: (resp) => JSON.parse(resp),
      retry: {
        limit: 10,
      },
    };

    switch (method) {
      case 'GET':
        try {
          const response = await got(options).json();
          return response;
        } catch (err) {
          logger.error(`${this._baseUrl + endpoint}: ${err.message}`);
          return err;
        }
        return;
      default:
        throw new Error('BinanceSpot _makeRequest method value error');
    }
  }

  async loadMarkets() {
    try {
      const {
        data: { symbols },
      } = await this._makeRequest('GET', '/spot/v1/symbols/details');

      symbols.forEach((currencyPair) => {
        const { symbol: id, base_currency, quote_currency } = currencyPair;

        const symbol = `${base_currency}/${quote_currency}`;
        this.markets[symbol] = new Market(id, symbol, base_currency, quote_currency, 0.0025, 0.0025);
      });
    } catch (err) {
      logger.error(err.message);
      return err;
    }
  }

  async loadCurrencies() {
    const { loadCurrencies } = config;
    let currencies = {};

    if (loadCurrencies.static) {
      currencies = JSON.parse(fs.readFileSync(path.resolve(`./src/static-data/currencies/${this.id}.json`)));
    }

    if (!loadCurrencies.static || loadCurrencies.update) {
      const {
        data: { currencies: currenciesData },
      } = await this._makeRequest('GET', '/spot/v1/currencies');

      currenciesData.forEach((currency) => {
        const { id: symbol, withdraw_enabled } = currency;
        const currencyInstance = new Currency(symbol, !withdraw_enabled);
        if (currencies[symbol]) {
          currencies[symbol] = {
            ...currencies[symbol],
            ...currencyInstance,
          };
        } else {
          currencies[symbol] = currencyInstance;
        }
      });

      if (loadCurrencies.update) {
        const data = JSON.stringify(currencies, null, 4);
        fs.writeFileSync(path.resolve(`./src/static-data/currencies/${this.id}.json`), data);
      }
    }

    this.currencies = currencies;
  }

  // quote: {symbol, price}
  async loadFees(currency, quote = null) {
    const { loadCurrencies } = config;
    if (loadCurrencies.static && !loadCurrencies.update)
      return JSON.parse(fs.readFileSync(path.resolve(`./src/static-data/currencies/${this.id}.json`)));

    try {
      const { data } = await this._makeRequest('GET', '/account/v1/withdraw/charge', { currency: currency });
      const anyToWithdraw = parseFloat(data.today_available_withdraw_BTC) > 0;
      const withdrawMin = parseFloat(data.min_withdraw);
      const fix = parseFloat(data.withdraw_fee);

      this.currencies[currency].anyToWithdraw = anyToWithdraw;
      this.currencies[currency].withdrawMin = withdrawMin;
      this.currencies[currency].withdrawFee = { fix };

      if (quote)
        this.currencies[currency].withdrawFee.quoteEstimation = {
          [quote.symbol]: quote.price * fix,
        };

      if (loadCurrencies.update) {
        const currencies = JSON.parse(fs.readFileSync(path.resolve(`./src/static-data/currencies/${this.id}.json`)));
        const data = JSON.stringify(
          {
            ...currencies,
            [currency]: {
              ...staticData[this.id][currency],
              ...this.currencies[currency],
            },
          },
          null,
          4,
        );

        fs.writeFileSync(path.resolve(`./src/static-data/currencies/${this.id}.json`), data);
      }

      return this.currencies[currency].withdrawFee;
    } catch (e) {
      logger.error(e);
    }
  }
};
