const got = require('got');

const Market = require('../../models/market');

module.exports = class BitforexSpot {
  constructor(publicKey, secretKey, eventEmitter, logger) {
    this.id = 'bitforex_spot';
    this._baseUrl = 'https://api.bitforex.com/api';
    this._wssUrl = 'wss://www.bitforex.com/mkapi/coinGroup1/ws';
    this._publicKey = publicKey;
    this._secretKey = secretKey;
    this._headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

    this.logger = logger;

    this.markets = {};
  }

  async init() {
    this.logger.info('Initializing BitforexSpot client');

    this.markets = await this.getMarkets();

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
};
