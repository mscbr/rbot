const got = require('got');

const WebSocket = require('ws');

const Market = require('../../models/market');
const TickerEvent = require('../../models/ticker-event');
const Ticker = require('../../models/ticker');

module.exports = class GateioSpot {
  constructor(publicKey, secretKey, eventEmitter, logger) {
    this.id = 'gateio_spot';
    this._baseUrl = 'https://api.gateio.ws/api';
    this._wssUrl = 'wss://api.gateio.ws/ws/v4/';
    this._publicKey = publicKey;
    this._secretKey = secretKey;
    this._headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

    this.logger = logger;
    this.eventEmitter = eventEmitter;

    this.ws = null;
    this._wsId = 1;
    this._startWs = this._startWs.bind(this);

    this.markets = {};
  }

  async init() {
    this.logger.info('Initializing GateioSpot client');

    this.markets = await this.getMarkets();

    this.startMarketStream(Object.values(this.markets).map((market) => market.symbol));

    this.logger.info('GateioSpot client successfully initialized');
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
        throw new Error('BinanceSpot _makeRequest method value error');
    }
  }

  async getMarkets() {
    try {
      this.logger.info('Fetching market data...');
      const exchangeInfo = await this._makeRequest('GET', '/v4/spot/currency_pairs');
      return exchangeInfo.reduce((acc, market) => {
        if (market['trade_status'] == 'tradable') {
          acc[market.id.split('_').join('')] = new Market(this.id, market);
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

  _startWs(subscriptions, symbols = []) {
    const { eventEmitter, logger, _wssUrl, markets, id, _startWs } = this;
    if (!subscriptions) return logger.error(`startWs() @ GateIoSpot: No subscribtions provided`);

    let ws = this._getWs();

    ws.on('ping', (e) => {
      logger.debug(`Received gateio ping: ${e}`);
      ws.pong();
    });

    ws.onerror = function (e) {
      logger.error(`GateIo Spot: Public stream (${_wssUrl}) error: ${JSON.stringify([e.code, e.message])}`);
    };

    ws.onopen = () => {
      logger.info(`GateIo Spot: Public stream (${_wssUrl}) opened.`);

      logger.info(`GateIo Spot subscriptions: ${JSON.stringify(subscriptions.length * symbols.length)}`);

      for (let i = 0; i < subscriptions.length; i++) {
        ws.send(
          JSON.stringify({
            time: Math.floor(Date.now() / 1000),
            id: this._wsId,
            channel: subscriptions[i],
            event: 'subscribe',
            payload: symbols,
            auth: {},
          }),
        );
        this._wsId += 1;
      }
    };

    ws.onmessage = async function (e) {
      const { result } = JSON.parse(e.data);
      const market = result.s && result.s.split('_').join('');

      if (market && markets[market]) {
        try {
          eventEmitter.emit(
            'ticker',
            new TickerEvent(
              id,
              result.s,
              markets[market].baseAsset,
              markets[market].quoteAsset,
              new Ticker(Date.now(), parseFloat(result.b), parseFloat(result.a)),
            ),
          );
        } catch (err) {
          logger.error(err.message);
        }
      }
    };

    ws.onclose = function (event) {
      logger.error(
        `GateIo Spot: Public Stream (${_wssUrl}) connection closed: ${JSON.stringify([event.code, event.message])}`,
      );

      setTimeout(async () => {
        logger.info(`GateIo: Public stream (${_wssUrl}) connection reconnect`);
        await _startWs(subscriptions, symbols);
      }, 1000 * 20);
    };
  }

  startMarketStream(symbols) {
    this._startWs(['spot.book_ticker'], symbols);
  }
};
