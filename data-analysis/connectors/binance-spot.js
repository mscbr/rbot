const got = require('got');
const _ = require('lodash');

const WebSocket = require('ws');

const Market = require('../../src/models/market');
const TickerEvent = require('../../src/models/ticker-event');
const Ticker = require('../../src/models/ticker');

const EXCEPTIONS_BINANCE_SPOT = {
  GTCBTC: 'GTCBTC1',
  GTCUSDT: 'GTCUSDT1',
  MIRUSDT: 'MIRUSDT1',
};

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
          const symbol = EXCEPTIONS_BINANCE_SPOT[market.symbol] || market.symbol;
          acc[symbol] = new Market(this.id, market);
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
      // logger.debug(`Received binance ping: ${e}`);
      console.log('PING: binance');
      ws.pong();
    });

    ws.onerror = function (e) {
      logger.error(`Binance Spot: Public stream (${_wssUrl}) error: ${JSON.stringify([e.code, e.message])}`);
    };

    ws.onopen = () => {
      logger.info(`Binance Spot: Public stream (${_wssUrl}) opened.`);

      logger.info(`Binance Spot subscriptions: ${JSON.stringify(subscriptions.length)}`);

      // it seem like Binance has a problef for taking
      // params.length > 380
      _.chunk(subscriptions, 200).forEach((chunk, idx) => {
        setTimeout(() => {
          ws.send(
            JSON.stringify({
              method: 'SUBSCRIBE',
              params: chunk,
              id: this._wsId,
            }),
          );
        }, idx * 1500);
        this._wsId += 1;
      });
    };

    ws.onmessage = function (e) {
      const body = JSON.parse(e.data);

      if (markets[body.s]) {
        try {
          eventEmitter.emit(
            'ticker',
            new TickerEvent(
              id,
              body.s,
              body.s,
              markets[body.s].baseAsset,
              markets[body.s].quoteAsset,
              markets[body.s].fee,
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

      setTimeout(() => {
        logger.info(`Binance: Public stream (${_wssUrl}) connection reconnect`);
        _startWs(subscriptions);
      }, 1000 * 10);
    };
  }

  startMarketStream(markets) {
    const subscriptions = [];
    for (let i = 0; i < markets.length; i++) {
      subscriptions.push(`${markets[i].toLowerCase()}@bookTicker`);
    }
    this._startWs(subscriptions);
  }
};
