const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

module.exports = class WS {
  constructor(logger) {
    this.logger = logger;

    this.ws = null;
  }

  startServer() {
    const { logger } = this;

    wss.on('connection', (ws) => {
      ws.send('Welcome to scan_exec websocket stream ‿︵‿︵‿︵(-_-)');
      logger.info('New client connected');
      this.ws = ws;
    });

    server.listen(process.env.PORT || 8080, () => {
      console.log(`WebSocket server started on port ${server.address().port}`);
    });
  }

  emitData(data) {
    const { ws } = this;
    if (ws) {
      ws.send(data);
    }
  }
};
