const got = require('got');

const Market = require('../../models/market');

module.exports = class BinanceSpot {
  constructor(publicKey, secretKey, eventEmitter, logger) {
    this.id = 'binance_spot';
    this._baseUrl = 'https://api.binance.com/api';
    this._wssUrl = 'wss://stream.binance.com:9443/ws';
    this._publicKey = publicKey;
    this._secretKey = secretKey;
    this._headers = { 'X-MBX-APIKEY': this._publicKey };

    this.logger = logger;

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
          this.logger.error(this._baseUrl + endpoint, err.message);
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
};
