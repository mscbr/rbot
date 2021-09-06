const got = require('got');

const Market = require('../../models/market');

module.exports = class GateioSpot {
  constructor(publicKey, secretKey, eventEmitter, logger) {
    this.id = 'gateio_spot';
    this._baseUrl = 'https://api.gateio.ws/api';
    this._wssUrl = 'wss://api.gateio.ws/ws/v4/';
    this._publicKey = publicKey;
    this._secretKey = secretKey;
    this._headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

    this.logger = logger;

    this.markets = {};
  }

  async init() {
    this.logger.info('Initializing GateioSpot client');

    this.markets = await this.getMarkets();

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
};
