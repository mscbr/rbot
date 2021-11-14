const path = require('path');
const events = require('events');

const { createLogger, transports, format } = require('winston');

let logger;
let eventEmitter;

module.exports = {
  boot: () => console.log('empty boot()'),

  getLogger: function () {
    if (logger) {
      return logger;
    }

    return (logger = createLogger({
      format: format.combine(
        format.prettyPrint(),
        format.colorize({ colors: { info: 'green', error: 'red', debug: 'yellow' }, all: true }),
      ),
      transports: [
        new transports.Console({
          level: 'debug',
        }),

        // uncomment for saving logs to json file
        // new transports.File({
        //   filename: `${path.resolve(__dirname)}/logs.json`,
        //   level: 'debug',
        // }),
      ],
    }));
  },

  getEventEmitter: function () {
    if (eventEmitter) return eventEmitter;
    return (eventEmitter = new events.EventEmitter());
  },

  getInterval: function () {
    let interval = null;
    return {
      setInterval: function (duration = 10, callback) {
        const targetDuration = duration * 1000;

        interval = {
          id: setInterval(async () => {
            await callback();
          }, targetDuration),
          callback,
        };
      },

      setIntervalDuration: function (duration = 10) {
        const targetDuration = duration * 1000;
        if (interval) {
          clearInterval(intervals[name].id);
          this.getInterval(name, duration, interval.callback);
        }
      },

      terminateInterval: function () {
        if (interval) clearInterval(interval.id);
      },
    };
  },
};
