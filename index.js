const Bosco = require('./src/bosco');

function boscoRun() {
  const bosco = new Bosco(__dirname);
  bosco.initWithCommandLineArgs();
  bosco.run();
}

module.exports = boscoRun;
