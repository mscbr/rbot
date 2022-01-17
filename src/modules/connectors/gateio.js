const got = require('got');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');
const Hex = require('crypto-js/enc-hex');
const Utf8 = require('crypto-js/enc-utf8');

const services = require('../../services');
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
        }, 1000 * 3);
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
    const s = `${method}\n${url}\n${queryString}\n${payload512}\n${timestamp}`;

    return Hex.stringify(CryptoJS.HmacSHA512(s, this._secretKey));
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
        return;
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
    const currencies = await this._makeRequest('GET', '/v4/spot/currencies');

    currencies.forEach((currency) => {
      const { currency: symbol, withdraw_disabled, withdraw_delayed } = currency;
      const withdrawDisabled = withdraw_disabled && withdraw_delayed;
      this.currencies[symbol] = new Currency(symbol, withdrawDisabled);
    });
  }

  async loadFees(currency) {
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

      logger.debug(this.currencies[currency]);
    } catch (e) {
      logger.error(e);
    }
  }
};
