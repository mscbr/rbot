require('dotenv').config();

const services = require('./src/services');
const logger = services.getLogger();

const Server = require('./src/api/server');

const Exchanges = require('./src/exchanges');

async function main() {
  const exchanges = new Exchanges(logger);
  await exchanges.init();

  const websocket = new Server(exchanges);
  websocket.startServer();
}

main();
