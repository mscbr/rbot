const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');

const WsTrigSubManager = require('./ws-trigsub-manager');
const Arbitrage = require('../arbitrage');

const services = require('../services');
const logger = services.getLogger();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

module.exports = class Server {
  constructor(exchanges) {
    this.arbitrage = new Arbitrage(logger);

    this.trigSubManager = new WsTrigSubManager(exchanges, this.arbitrage);

    this.ws = null;
  }

  startServer() {
    const { trigSubManager } = this;

    wss.on('connection', (ws, req) => {
      ws.send('Welcome to scan_exec websocket stream %$‿︵‿︵‿︵(-_-)');
      logger.info(`WS: Connection request from: ${req.connection.remoteAddress}`);
      this.ws = ws;

      ws.on('message', (data) => {
        const json = JSON.parse(data);
        const request = json.request;
        // const message = json.message;
        const channel = json.channel;

        switch (request) {
          case 'TRIG':
            // trigSubManager.publish(ws, channel, message);
            break;
          case 'SUB':
            trigSubManager.subscribe(ws, channel);
            break;
        }
      });

      ws.on('close', () => {
        logger.info('WS: Stopping client connection.');
        this.trigSubManager.clearBrokers();
      });
    });

    server.listen(process.env.PORT || 8080, () => {
      logger.info(`WS: server started on port ${server.address().port}`);
    });
  }
};
