const got = require('got');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');
const Hex = require('crypto-js/enc-hex');

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const services = require('../services');
const logger = services.getLogger();

const Market = require('../../models/market');
const Currency = require('../../models/currency');
const OrderBook = require('../../models/orderbook');

module.exports = class Gateio {
  constructor(publicKey, secretKey) {
    this.id = 'gateio';
    this._baseUrl = 'https://api.gateio.ws/api';
    this._wssUrl = 'wss://api.gateio.ws/ws/v4/';
    this._publicKey = publicKey;
    this._secretKey = secretKey;

    this.markets = {};
    this.currencies = {};

    this.ws = null;
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
      const data = JSON.parse(e.data);

      if (Object.keys(data).length) {
        switch (data.channel) {
          case 'spot.order_book':
            const { asks, bids, s, t } = data.result;
            const onObUpdate = getOnObUpdate();

            if (asks && bids && s && t && onObUpdate)
              onObUpdate(new OrderBook(s, s.split('_').join('/'), asks, bids, t), id);
            break;
          default:
            break;
        }
      }
    };

    ws.onclose = function (e) {
      logger.error(`GateIo: Public Stream (${_wssUrl}) connection closed: ${JSON.stringify([e.code, e.message])}`);

      if (obStream()) {
        setTimeout(async () => {
          await restartObSubscriptions();
          logger.info(`Gateio: Public stream (${_wssUrl}) connection reconnecting`);
        }, 3000);
      }
    };

    return new Promise((resolve, reject) => {
      ws.onopen = function () {
        resolve(ws);
        logger.info(`GateIo: Public stream (${_wssUrl}) opened.`);
      };
      ws.onerror = function (e) {
        reject(JSON.stringify([e.code, e.message]));
        logger.error(`GateIo: Public stream (${_wssUrl}) error: ${JSON.stringify([e.code, e.message])}`);
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
        time: new Date().getTime(),
        channel: 'spot.order_book',
        event: 'subscribe',
        payload: [this.markets[symbol].id, depth, '1000ms'],
      }),
    );
  }

  _generateSignature(method, url, queryString, payload, timestamp) {
    const payload512 = Hex.stringify(CryptoJS.SHA512(payload));
    const string = `${method}\n${url}\n${queryString}\n${payload512}\n${timestamp}`;

    return Hex.stringify(CryptoJS.HmacSHA512(string, this._secretKey));
  }

  async _makeRequest(method, endpoint, query) {
    const queryString = query ? new URLSearchParams(query).toString() : '';
    const timestamp = (new Date().getTime() / 1000).toString();

    let options = {
      url: this._baseUrl + endpoint,
      searchParams: query,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        KEY: this._publicKey,
        Timestamp: timestamp,
      },
      parseJson: (resp) => JSON.parse(resp),
      retry: {
        limit: 10,
      },
    };

    switch (method) {
      case 'GET':
        options.headers.SIGN = this._generateSignature('GET', '/api' + endpoint, queryString, '', timestamp);
        try {
          const response = await got(options).json();
          return response;
        } catch (err) {
          logger.error(`${this._baseUrl + endpoint}: ${err.message}`);
          return err;
        }
      default:
        throw new Error('BinanceSpot _makeRequest method value error');
    }
  }

  async loadMarkets() {
    try {
      const currencyPairs = await this._makeRequest('GET', '/v4/spot/currency_pairs');

      currencyPairs.forEach((currencyPair) => {
        const { id, base, quote, fee, trade_status } = currencyPair;

        if (trade_status === 'tradable') {
          const symbol = `${base}/${quote}`;
          const feeFloat = parseFloat(fee) / 100;
          this.markets[symbol] = new Market(id, symbol, base, quote, feeFloat, feeFloat);
        }
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
      const currenciesData = await this._makeRequest('GET', '/v4/spot/currencies');

      currenciesData.forEach((currency) => {
        const { currency: symbol, withdraw_disabled, withdraw_delayed } = currency;
        const withdrawDisabled = withdraw_disabled && withdraw_delayed;
        const currencyInstance = new Currency(symbol, withdrawDisabled);
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
      const response = await this._makeRequest('GET', '/v4/wallet/withdraw_status', { currency: currency });
      const data = response[0];
      const anyToWithdraw = parseFloat(data.withdraw_day_limit_remain) > 0;
      const withdrawMin = parseFloat(data.withdraw_amount_mini);
      const fix = parseFloat(data.withdraw_fix);
      const percent = parseFloat(data.withdraw_percent.split('%')[0]) / 100;

      this.currencies[currency].anyToWithdraw = anyToWithdraw;
      this.currencies[currency].withdrawMin = withdrawMin;
      this.currencies[currency].withdrawFee = { fix, percent };

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
