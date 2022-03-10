const services = require('../services');
const logger = services.getLogger();

const Arbitrage = require('../modules/arb/arbitrage');
const ObScanner = require('../modules/arb/ob-scanner');
const TickerScanner = require('../modules/arb/ticker-scanner');

module.exports = class WsTrigSubManager {
  constructor(ccxtExchanges, directExchanges, subscriber) {
    this.subscriber = subscriber;

    this.ccxtExchanges = ccxtExchanges;
    this.directExchanges = directExchanges;
    this.arbitrage = new Arbitrage();
    this.obScanner = new ObScanner(directExchanges, subscriber);
    this.tickerScanner = new TickerScanner(ccxtExchanges, directExchanges, subscriber);

    this._obTriggerFunctions = this._obTriggerFunctions.bind(this);
    this._tickerTriggerFunctions = this._tickerTriggerFunctions.bind(this);
  }

  subscribe(channel, payload) {
    const { _initChannelBroker, subscriber, obScanner } = this;
    if (!subscriber) {
      logger.error(`WS trigsub-manager: subscriber not provided`);
      return;
    }

    logger.info(`WS: new subscription to ${channel}`);

    if (channel === 'tickerArbs') this.tickerScanner.runTickerFetching();

    if (channel === 'obArbs') {
      subscriber.send(JSON.stringify({ channel, paths: obScanner.paths }));
      this.obScanner.runObFetching();
    }
  }

  unsubscribe(channel) {
    logger.info(`Subscription from ${channel} terminated`);

    if (channel === 'tickerArbs') this.tickerScanner.stopTickerFetching();
    if (channel === 'obArbs') this.obScanner.stopObFetching();
  }

  trigger(channel, { name, params }) {
    const { subscriber, _obTriggerFunctions, _tickerTriggerFunctions } = this;

    if (!name) subscriber.send(JSON.stringify({ message: 'Trigger not found' }));
    subscriber.send(JSON.stringify({ message: `Triggering ${name} @ ${channel}` }));

    switch (channel) {
      case 'tickerArbs':
        _tickerTriggerFunctions(name, params);
      case 'obArbs':
        _obTriggerFunctions(name, params);
        break;
      default:
        break;
    }
  }

  _tickerTriggerFunctions(name, params) {
    const { tickerScanner } = this;

    switch (name) {
      case 'populateWithdrawFees':
        tickerScanner.populateWithdrawFees();
        break;
      default:
        break;
    }
  }

  _obTriggerFunctions(name, params) {
    const { obScanner, subscriber } = this;

    switch (name) {
      case 'addPath':
        obScanner.addPath(params.path);
        break;
      case 'clearPaths':
        obScanner.clearPaths();
        break;
      case 'removePath':
        obScanner.removePath(params.path.id);
        break;
      default:
        break;
    }

    subscriber.send(JSON.stringify({ channel: 'obArbs', paths: obScanner.paths }));
  }
};
