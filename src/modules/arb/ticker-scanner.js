const services = require('../../services');
const logger = services.getLogger();

const HttpError = require('../../models/httpError');
const Arbitrage = require('./arbitrage');

module.exports = class TickeScanner {
  // do I nneed setSubscriber()??
  constructor(ccxtExchanges, directExchanges, subscriber) {}
};
