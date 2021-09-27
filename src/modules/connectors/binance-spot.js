const got = require('got');
const _ = require('lodash');

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

    this.ws = null;
    this._wsId = 1;
    this._startWs = this._startWs.bind(this);

    this.logger = logger;
    this.eventEmitter = eventEmitter;

    this.markets = {};
  }

  async init() {
    this.logger.info('Initializing BinanceSpot client');

    this.markets = await this.getMarkets();

    // this._startWs(['!bookTicker']);
    this.startMarketStream(['bnbusdt', 'lunabnb', 'ftmbnb', 'adabnb']);

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

  _getWs() {
    let { ws, _wssUrl } = this;
    if (!ws) ws = new WebSocket(_wssUrl);
    return ws;
  }

  _startWs(subscriptions) {
    const { eventEmitter, logger, _wssUrl, markets, id, _startWs } = this;
    if (!subscriptions) return logger.error(`startWs() @ BinanceSpot: No subscribtions provided`);

    let ws = this._getWs();

    ws.on('ping', (e) => {
      logger.debug(`Received binance ping: ${e}`);
      ws.pong();
    });

    ws.onerror = function (e) {
      logger.error(`Binance Spot: Public stream (${_wssUrl}) error: ${JSON.stringify([e.code, e.message])}`);
    };

    ws.onopen = () => {
      logger.info(`Binance Spot: Public stream (${_wssUrl}) opened.`);

      logger.info(`Binance Spot subscriptions: ${JSON.stringify(subscriptions.length)}`);

      ws.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: subscriptions,
          id: this._wsId,
        }),
      );
      this._wsId += 1;
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

      setTimeout(async () => {
        logger.info(`Binance: Public stream (${_wssUrl}) connection reconnect`);
        await _startWs(subscriptions);
      }, 1000 * 20);
    };
  }

  startMarketStream(symbols) {
    const subscriptions = [];
    for (let i = 0; i < symbols.length; i++) {
      subscriptions.push(`${symbols[i]}@bookTicker`);
    }
    this._startWs(subscriptions);
  }
};
