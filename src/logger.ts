import winston from 'winston';

export default winston.createLogger({
  level: 'verbose',
  format: winston.format.cli({
    colors: { info: 'blue', error: 'red', warning: 'yellow' },
  }),
  transports: [new winston.transports.Console()],
});
