const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const WsTrigSubManager = require('./ws-trigsub-manager');
const RateLimitManager = require('../modules/rate-limit-manager');

const services = require('../services');
const logger = services.getLogger();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

module.exports = class Server {
  constructor(ccxtExchanges, directExchanges) {
    this.rateLimitManager = new RateLimitManager(Object.keys(ccxtExchanges.exchanges));
    this.trigSubManager = {};

    this.ccxtExchanges = ccxtExchanges;
    this.directExchanges = directExchanges;

    this.ws = null;
  }

  async startServer() {
    wss.on('connection', (ws, req) => {
      ws.send(JSON.stringify({ message: 'Welcome to scan_exec websocket stream %$‿︵‿︵‿︵(-_-)' }));
      logger.info(`WS: Connection request from: ${req.connection.remoteAddress}`);

      this.ws = ws;

      ws.on('message', (data) => {
        const json = JSON.parse(data);
        const request = json.request;
        const channel = json.channel;
        const payload = json.payload;

        switch (request) {
          case 'TRIG':
            this.trigSubManager.trigger(channel, payload);
            break;
          case 'SUB':
            this.trigSubManager.subscribe(channel, payload);
            break;
          case 'UNSUB':
            this.trigSubManager.unsubscribe(channel);
            break;
          default:
            break;
        }
      });

      ws.on('close', () => {
        logger.info('WS: Stopping client connection.');
      });

      this.trigSubManager = new WsTrigSubManager(this.ccxtExchanges, this.directExchanges, this.ws);
    });

    return new Promise((resolve) => {
      server.listen(process.env.PORT || 8080, () => {
        // logger.info(`WS: server started on port ${server.address().port}`);
        resolve(`WS: server started on port ${server.address().port}`);
      });
    });
  }
};
