const _ = require('lodash');

const globalOptions = require('../config/options.json');

function addCommandOptions(args, command) {
  let cmdArgs = args.wrap(null);

  if (command.example) cmdArgs = cmdArgs.example(command.example);

  let usage = 'Usage: $0';
  if (command.name) usage += ` ${command.name}`;
  if (command.usage) usage += ` ${command.usage}`;
  if (command.description) usage += `\n\n${command.description}`;
  cmdArgs = cmdArgs.usage(usage);

  const options = command.options || [];

  _.forEach(options, (option) => {
    if (!option.name) {
      throw new Error(`Error parsing bosco command ${command.name} options`);
    }

    cmdArgs = cmdArgs.option(option.name, option);
  });

  _.forEach(globalOptions, (option) => {
    cmdArgs = cmdArgs.option(option.name, option);
  });

  return cmdArgs.help('help').alias('help', 'h');
}

module.exports = addCommandOptions;
