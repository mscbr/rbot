const got = require('got');

const WebSocket = require('ws');

const Market = require('../../models/market');
const TickerEvent = require('../../models/ticker-event');
const Ticker = require('../../models/ticker');

module.exports = class BitforexSpot {
  constructor(publicKey, secretKey, eventEmitter, logger) {
    this.id = 'bitforex_spot';
    this._baseUrl = 'https://api.bitforex.com/api';
    this._wssUrl = 'wss://www.bitforex.com/mkapi/coinGroup1/ws';
    this._publicKey = publicKey;
    this._secretKey = secretKey;
    this._headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

    this.logger = logger;
    this.eventEmitter = eventEmitter;

    this.ws = null;
    this._startWs = this._startWs.bind(this);

    this.markets = {};
  }

  async init() {
    this.logger.info('Initializing BitforexSpot client');

    this.markets = await this.getMarkets();

    this.startMarketStream(Object.values(this.markets).map((market) => market.symbol));

    this.logger.info('BitforexSpot client successfully initialized');
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
    }
  }

  async getMarkets() {
    try {
      this.logger.info('Fetching market data...');
      const exchangeInfo = await this._makeRequest('GET', '/v1/market/symbols');
      return exchangeInfo.data.reduce((acc, market) => {
        acc[market.symbol.split('-').slice(1, 3).reverse().join('').toUpperCase()] = new Market(this.id, market);
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

  _startWs(subscriptions, symbols = [], params) {
    const { eventEmitter, logger, markets, _wssUrl, id, _startWs } = this;
    if (!subscriptions) return logger.error(`startWs() @ BitforexSpot: No subscribtions provided`);

    let ws = this._getWs();

    ws.on('ping', (e) => {
      logger.debug(`Received gateio ping: ${e}`);
      ws.pong();
    });

    ws.onerror = function (e) {
      logger.error(`Bitforex Spot: Public stream (${_wssUrl}) error: ${JSON.stringify([e.code, e.message])}`);
    };

    ws.onopen = () => {
      logger.info(`Bitforex Spot: Public stream (${_wssUrl}) opened.`);

      const payload = subscriptions.reduce((acc, sub) => {
        symbols.forEach((symbol) => {
          acc.push({
            type: 'subHq',
            event: sub,
            param: {
              businessType: symbol,
              ...params,
            },
          });
        });
        return acc;
      }, []);

      logger.info(`Bitforex Spot subscriptions: ${JSON.stringify(payload.length)}`);

      for (let i = 0; i < payload.length; i++) {
        ws.send(JSON.stringify([payload[i]]));
      }
    };

    ws.onmessage = async function (e) {
      const body = JSON.parse(e.data);
      const market = body.param.businessType.split('-').slice(1, 3).reverse().join('').toUpperCase();

      if (market && markets[market]) {
        try {
          eventEmitter.emit(
            'ticker',
            new TickerEvent(
              id,
              body.param.businessType,
              markets[market].baseAsset,
              markets[market].quoteAsset,
              new Ticker(Date.now(), parseFloat(body.data.bids[0].price), parseFloat(body.data.asks[0].price)),
            ),
          );
        } catch (err) {
          logger.error(err.message);
        }
      }
    };

    ws.onclose = function (event) {
      logger.error(
        `Bitforex Spot: Public Stream (${_wssUrl}) connection closed: ${JSON.stringify([event.code, event.message])}`,
      );

      setTimeout(async () => {
        logger.info(`Bitforex: Public stream (${_wssUrl}) connection reconnect`);
        await _startWs(subscriptions, symbols);
      }, 1000 * 20);
    };
  }

  startMarketStream(symbols) {
    this._startWs(['depth10'], symbols, { dType: 0 });
  }
};
