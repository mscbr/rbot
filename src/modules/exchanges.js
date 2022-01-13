require('dotenv').config();

const services = require('../services');
const logger = services.getLogger();

const Gateio = require('./connectors/gateio');
const Bitmart = require('./connectors/bitmart');

module.exports = class Exchanges {
  constructor() {
    this.exchanges = {
      gateio: new Gateio(process.env.APIKEY_PUBLIC_GATEIO_SPOT, process.env.APIKEY_PRIVATE_GATEIO_SPOT),
      bitmart: new Bitmart(
        process.env.APIKEY_PUBLIC_BITMART_SPOT,
        process.env.APIKEY_PRIVATE_BITMART_SPOT,
        process.env.MEMO_BITMART_SPOT,
      ),
    };

    this.obSubscriptions = {};
    this.propagateOnObUpdate = this.propagateOnObUpdate.bind(this);
    this.restartObSubscriptions = this.restartObSubscriptions.bind(this);
  }

  async init() {
    await this._loadMarkets();
  }

  async _loadMarkets() {
    const { exchanges } = this;

    const marketPromises = Object.values(exchanges).map(async (exchange) => {
      try {
        await exchange.loadMarkets();
        await exchange.loadCurrencies();
      } catch (err) {
        logger.error(err.message);
      }
    });

    logger.info('Loading markets...');
    await Promise.all(marketPromises);

    exchanges['gateio'].loadFees('BABYDOGE').then((data) => logger.debug(data));
    exchanges['gateio'].loadFees('KISHU').then((data) => logger.debug(data));
    exchanges['gateio'].loadFees('BTC').then((data) => logger.debug(data));
    exchanges['bitmart'].loadFees('KISHU').then((data) => logger.debug(data));
    exchanges['bitmart'].loadFees('AAA').then((data) => logger.debug(data));
  }

  async openWsConnections(exchanges = []) {
    logger.info('Opening WS connections...');

    await Promise.all(
      Object.values(this.exchanges).map(async (exchange) => {
        if (exchanges.length && !exchanges.includes(exchange.id)) return;
        try {
          await exchange.openWsConnection(this.restartObSubscriptions);
        } catch (err) {
          logger.error(err.message);
        }
      }),
    );
  }

  closeWsConnections(exchanges = []) {
    Object.values(this.exchanges).forEach((exchange) => {
      if (exchanges.length && !exchanges.includes(exchange.id)) return;
      exchange.closeWsConnection();
    });
  }

  propagateOnObUpdate(callback) {
    Object.values(this.exchanges).forEach((exchange) => {
      exchange.onObUpdate = callback;
    });
  }

  addObSubscription(pathId, exchanges, symbol) {
    this.obSubscriptions[pathId] = { symbol, exchanges };
  }

  removeObSubscription(pathId) {
    delete this.obSubscriptions[pathId];
  }

  startObSubscriptions(pathIds = []) {
    Object.values(this.exchanges).forEach((exchange) => {
      exchange.obStream = true;
    });

    let subscriptions = Object.keys(this.obSubscriptions)
      .filter((key) => (!pathIds.length ? true : pathIds.includes(key)))
      .map((key) => this.obSubscriptions[key]);

    for (let i = 0; i < subscriptions.length; i++) {
      setTimeout(() => {
        subscriptions[i].exchanges.forEach((exchange) => {
          this.exchanges[exchange].subscribeOb(subscriptions[i].symbol, '100');
        });

        // arbitrary value not to flood
        // the WS source with subscription data
        // most probably can be lowered down
      }, 1000 * i);
    }
  }

  async restartObSubscriptions() {
    this.closeWsConnections();
    await this.openWsConnections();
    Object.values(this.exchanges).forEach((exchange) => {
      exchange.obStream = true;
    });
    this.startObSubscriptions();
  }

  async populateWithdrawFees(coinsForExchanges) {}

  // stopSubscriptions() {} <-- handled by closeWsConnections
};
