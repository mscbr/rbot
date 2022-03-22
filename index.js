require('dotenv').config();

const figlet = require('figlet');
const gradient = require('gradient-string');
const chalk = require('chalk');
const chalkAnimation = require('chalk-animation');

const Server = require('./src/api/server');

const CcxtExchanges = require('./src/modules/ccxt-exchanges');
const Exchanges = require('./src/modules/exchanges');

async function main() {
  const ccxtExchanges = new CcxtExchanges();
  const directExchanges = new Exchanges();
  try {
    console.log(gradient.retro('Initializing RBOT...'));
    await ccxtExchanges.init();
    await directExchanges.init();
  } catch (err) {
    console.log(chalk.red(err));
  }

  const websocket = new Server(ccxtExchanges, directExchanges);
  try {
    const resolution = await websocket.startServer();
    console.log(gradient.fruit(resolution));
  } catch (err) {
    console.log(chalk.red(err));
  }

  console.log(gradient.teen('\n🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑'));
  figlet.text('RBOT', {}, (_, data) => {
    console.log(gradient.teen(data));
    console.log(gradient.teen('\n🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑🤑'));
  });
}

main();
