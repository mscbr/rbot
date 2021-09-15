const got = require('got');

const WebSocket = require('ws');

const Market = require('../../models/market');
const TickerEvent = require('../../models/ticker-event');
const Ticker = require('../../models/ticker');

module.exports = class BinanceSpot {
  constructor(publicKey, secretKey, eventEmitter, logger) {
    this.id = 'binance_spot';
    this._baseUrl = 'https://api.binance.com/api';
    this._wssUrl = 'wss://stream.binance.com:9443/ws';
    this._publicKey = publicKey;
    this._secretKey = secretKey;
    this._headers = { 'X-MBX-APIKEY': this._publicKey };

    this._ws_id = 1;
    this._startWs = this._startWs;

    this.logger = logger;
    this.eventEmitter = eventEmitter;

    this.markets = {};
  }

  async init() {
    this.logger.info('Initializing BinanceSpot client');

    this.markets = await this.getMarkets();
    this._startWs(['@bookTicker']);

    this.logger.info('BinanceSpot client successfully initialized');
  }

  async _makeRequest(method, endpoint, data) {
    const options = {
      url: this._baseUrl + endpoint,
      headers: this._headers,
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
          this.logger.error(`${this._baseUrl + endpoint}: ${err.message}`);
          return err;
        }
        return;
      default:
        throw this.logger.error('BinanceSpot _makeRequest method value error');
    }
  }

  async getMarkets() {
    try {
      this.logger.info('Fetching market data...');
      const exchangeInfo = await this._makeRequest('GET', '/v3/exchangeInfo');
      return exchangeInfo.symbols.reduce((acc, market) => {
        if (market.isSpotTradingAllowed) {
          acc[market.symbol] = new Market(this.id, market);
          return acc;
        }
        return acc;
      }, {});
    } catch (err) {
      this.logger.error(err.message);
      return err;
    }
  }

  _startWs(subscriptions, symbols = []) {
    const { eventEmitter, logger, _wssUrl, markets, id } = this;
    if (!subscriptions) return logger.error(`startWs() @ BinanceSpot: No subscribtions provided`);

    const ws = new WebSocket(_wssUrl);

    ws.on('ping', (e) => {
      logger.debug(`Received ping: ${e}`);
    });

    ws.onerror = function (e) {
      logger.error(`Binance Spot: Public stream (${_wssUrl}) error: ${JSON.stringify([e.code, e.message])}`);
    };

    ws.onopen = () => {
      // => func in order to bind this._ws_id
      logger.info(`Binance Spot: Public stream (${_wssUrl}) opened.`);

      logger.info(`Binance Spot subscriptions: ${JSON.stringify(subscriptions.length)}`);

      for (let i = 0; i < subscriptions.length; i++) {
        ws.send(
          JSON.stringify({
            method: 'SUBSCRIBE',
            params: ['!bookTicker'], //symbols.map((symbol) => symbol.lowerCase() + '@' + subscriptions[i]),
            id: this._ws_id,
          }),
        );
        this._ws_id += 1;
      }
    };

    ws.onmessage = async function (e) {
      const body = JSON.parse(e.data);

      if (markets[body.s]) {
        try {
          eventEmitter.emit(
            'ticker',
            new TickerEvent(
              id,
              body.s,
              markets[body.s].baseAsset,
              markets[body.s].quoteAsset,
              new Ticker(Date.now(), parseFloat(body.b), parseFloat(body.a)),
            ),
          );
        } catch (err) {
          logger.error(err.message);
        }
      }
    };

    ws.onclose = function (event) {
      logger.error(
        `Binance Spot: Public Stream (${_wssUrl}) connection closed: ${JSON.stringify([event.code, event.message])}`,
      );

      // setTimeout(async () => {
      //   logger.info(`Binance Futures: Public stream (${_wssUrl}) connection reconnect`);
      //   await _startWs(subscriptions, symbols);
      // }, 1000 * 20);
    };
  }
};
