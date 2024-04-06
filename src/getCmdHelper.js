const async = require('async');
const _ = require('lodash');
const { spawn } = require('child_process');
const hl = require('highland');

const globalRunOptions = require('../config/options.json');

function isDefaulOption(option, value) {
  const configOption = _.find(globalRunOptions, { name: option });

  return configOption && configOption.default === value;
}

function guardFn(bosco, repoPath, options, next) {
  next();
}

/**
 * Helper functions to reduce repetition and boiler plate in commands
 */

function getCmdHelper(bosco) {
  function createOptions(givenOptions) {
    const options = _.defaults(givenOptions, {
      cmd: 'echo',
      args: ['NO COMMAND DEFINED!'],
      guardFn,
      dieOnError: false,
    });

    if (!options.init) {
      if (options.stdoutFn === undefined) {
        options.stdoutFn = (stdout, repoPath) => {
          bosco.error(`${repoPath.green} >> ${stdout}`);
        };
      }

      if (options.stderrFn === undefined) {
        options.stderrFn = (stderr, repoPath) => {
          bosco.error(`${repoPath.red} >> ${stderr}`);
        };
      }
    }

    return options;
  }

  function execute(command, args, repoPath, options, next) {
    if (options.init && (options.stdoutFn || options.stderrFn)) {
      bosco.error('command init and stdoutFn/stderrFn are not compatible.');
      return next(Error('Bad command'));
    }

    const stdio = ['pipe', 'pipe', 'pipe'];
    let count = 1;
    let returnCode;
    let error;

    const tryNext = function tryNext(err) {
      if (err) error = err;
      if (!(--count)) { // eslint-disable-line no-plusplus
        if (error) return next(error);
        next(returnCode === 0 ? null : `Process exited with status code ${returnCode}`);
      }
    };

    if (!options.init) {
      stdio[0] = 'ignore';
      if (!options.stdoutFn) {
        stdio[1] = 'ignore';
      }
      if (!options.stderrFn) {
        stdio[2] = 'ignore';
      }
    }

    const sc = spawn(command, args, {
      cwd: repoPath,
      stdio,
    });

    sc.on('error', (err) => {
      bosco.error(`spawn error: ${err}`);
    });

    if (stdio[1] !== 'ignore') {
      sc.stdio[1] = sc.stdout = hl(sc.stdout); // eslint-disable-line no-multi-assign

      if (options.stdoutFn) {
        count++; // eslint-disable-line no-plusplus
        sc.stdout.toArray((stdout) => {
          const fullStdout = stdout.join('');
          if (fullStdout.length) {
            if (options.stdoutFn.length === 3) {
              return options.stdoutFn(fullStdout, repoPath, tryNext);
            }
            options.stdoutFn(fullStdout, repoPath);
          }
          tryNext();
        });
      }
    }

    if (stdio[2] !== 'ignore') {
      sc.stdio[2] = sc.stderr = hl(sc.stderr); // eslint-disable-line no-multi-assign

      if (options.stderrFn) {
        count++; // eslint-disable-line no-plusplus
        sc.stderr.toArray((stderr) => {
          const fullStderr = stderr.join('');
          if (fullStderr.length) {
            if (options.stderrFn.length === 3) {
              return options.stderrFn(fullStderr, repoPath, tryNext);
            }
            options.stderrFn(fullStderr, repoPath);
          }
          tryNext();
        });
      }
    }

    if (options.init) {
      options.init(bosco, sc, repoPath);
    }

    sc.on('close', (code) => {
      returnCode = code;
      tryNext();
    });
  }

  function iterate(options, next) {
    const repoPattern = bosco.options.repo;
    const repoRegex = new RegExp(repoPattern);
    const repos = bosco.getRepos();
    if (!repos) return bosco.error('You are repo-less :( You need to initialise bosco first, try \'bosco clone\'.');

    async.mapLimit(repos, bosco.options.cpus, (repo, repoCb) => {
      if (!repo.match(repoRegex)) return repoCb();

      const repoPath = bosco.getRepoPath(repo);

      options.guardFn(bosco, repoPath, options, (err) => {
        if (err) return repoCb(err);
        execute(options.cmd, options.args, repoPath, options, repoCb);
      });
    }, (err) => {
      if (options.dieOnError) return next(err);
      next();
    });
  }

  function checkInService() {
    const onWorkspaceFolder = bosco.options.workspace === process.cwd();
    const hasDefaultRepoOption = !bosco.options.repo || isDefaulOption('repo', bosco.options.repo);
    const hasDefaultTagOption = !bosco.options.tag || isDefaulOption('tag', bosco.options.tag);

    // Tag and repo options take precendence over cwd
    if (!onWorkspaceFolder && hasDefaultRepoOption && hasDefaultTagOption) {
      bosco.options.service = true; // eslint-disable-line no-param-reassign
      bosco.checkInService();
      return true;
    }
    return false;
  }

  return {
    createOptions,
    iterate,
    execute,
    checkInService,
  };
}

module.exports = getCmdHelper;
