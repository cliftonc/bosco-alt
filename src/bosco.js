/**
 * Core bosco libraries
 */

require('colors'); // No need to define elsewhere
const _ = require('lodash');
const AppDirectory = require('appdirectory');
const async = require('async');
const EventEmitter = require('events');
const fs = require('fs-extra');
const osenv = require('osenv');
const path = require('path');
const Progress = require('progress');
const prompt = require('prompt');
const request = require('request');
const semver = require('semver');
const sf = require('sf');
const ip = require('ip');
const nconf = require('nconf');
const os = require('os');
const yargs = require('yargs');
const addCommandOptions = require('./add-command-options');
const getCmdHelper = require('./getCmdHelper');

prompt.message = 'Bosco'.green;

class Bosco extends EventEmitter {
  constructor(boscoDirectory) {
    super();
    this.boscoDirectory = boscoDirectory;
    this.cmdHelper = getCmdHelper(this);
  }

  init(options = {}) {
    this._defaults = {
      _defaultConfig: [__dirname, '../config/bosco.json'].join('/'),
    };

    this.options = _.defaults(_.clone(options), this._defaults);

    // Load base bosco config from home folder unless over ridden with path
    this.options.configPath = options.configPath
      ? path.resolve(options.configPath)
      : this.findConfigFolder();

    this.options.configFile = options.configFile ? path.resolve(options.configFile) : [this.options.configPath, 'bosco.json'].join('/');
    this.options.defaultsConfigFile = [this.options.configPath, 'defaults.json'].join('/');

    // NVM presets
    if (this.options['system-node']) {
      this.options.nvmSh = '';
      this.options.nvmUse = '';
      this.options.nvmUseDefault = '';
      this.options.nvmWhich = '';
      this.options.nvmInstall = '';
    } else {
      this.options.nvmSh = '. ${NVM_DIR:-$HOME/.nvm}/nvm.sh && ';// eslint-disable-line no-template-curly-in-string
      this.options.nvmUse = `${this.options.nvmSh}nvm use;`;
      this.options.nvmUseDefault = `${this.options.nvmSh}nvm use default;`;
      this.options.nvmWhich = `${this.options.nvmSh}nvm which`;
      this.options.nvmInstall = `${this.options.nvmSh}nvm install`;
    }

    this.options.cpus = os.cpus().length;
    this.options.ip = ip.address();
    this.options.inService = false;
    this.options.fileTypesWhitelist = ['js', 'css', 'img', 'html', 'swf', 'fonts', 'pdf', 'json'];

    this.config = nconf;
    this.prompt = prompt;
    this.Progress = Progress;
    this.errorStack = [];

    this.concurrency = {
      network: this.options.cpus * 4, // network constrained
      cpu: (this.options.cpus - 1) || 1, // cpu constrained
    };
  }

  initWithCommandLineArgs() {
    const pkg = require(path.join(this.boscoDirectory, 'package.json')); // eslint-disable-line import/no-dynamic-require,global-require,max-len
    const globalCommand = {
      name: '',
      usage: '[<options>] <command> [<args>]',
      description: pkg.description,
      options: [
        {
          name: 'completion',
          type: 'string',
          desc: 'Generate the shell completion code',
        },
        {
          name: 'shellCommands',
          type: 'boolean',
          desc: 'Generate commands for shell completion mode [used internally]',
        },
      ],
    };

    let boscoArgs = addCommandOptions(yargs, globalCommand)
      .version(pkg.version);

    const globalCommandPath = this.getGlobalCommandFolder();
    const globalCommands = this._getCommandsOnPath(this.getGlobalCommandFolder());

    const localCommandPath = this.getLocalCommandFolder();
    let localCommands = [];
    if (localCommandPath !== globalCommandPath) {
      localCommands = this._getCommandsOnPath(localCommandPath);
    }

    // Go over every command in the global and local commands folder and add the options
    boscoArgs = this._addBoscoCommands(boscoArgs, globalCommands);
    boscoArgs = this._addBoscoCommands(boscoArgs, localCommands);

    // Manually parse argv due to change in yargs
    boscoArgs.parse(_.drop(process.argv, 2));
    const argv = boscoArgs.argv || {};

    if (argv.completion) {
      boscoArgs.showCompletionScript();
      process.exit();
    }

    // Only take options we have specified.
    const boscoOptions = {};
    _.forOwn((boscoArgs.parsed || {}).aliases || {}, (val, optionName) => {
      boscoOptions[optionName] = argv[optionName];
    });

    boscoOptions.program = boscoArgs;
    boscoOptions.args = argv._;
    boscoOptions.version = pkg.version;
    this.init(boscoOptions);
  }

  _getCommandsOnPath(folderPath) {
    if (!fs.existsSync(folderPath)) return [];

    return _.map(fs.readdirSync(folderPath), (filename) => {
      if (path.extname(filename) !== '.js') return null;

      const file = folderPath + filename;
      try {
        const command = require(file); // eslint-disable-line import/no-dynamic-require,global-require,max-len
        if (command.name && command.cmd) return command;
        if (!command.name) this.error(`Error: ${file} does not have a name specified`);
        if (!command.cmd) this.error(`Error: ${file} does not have a cmd specified`);
      } catch (err) {
        this.error(`Error requiring command file: ${file}: ${err}`);
      }
      return null;
    });
  }

  _addBoscoCommands(args, commands) {
    if (!commands || !commands.length) { return args; }

    function checkCommandOptions(command) {
      if (!command.options) return true;

      let oldStyleArgs = false;
      _.forEach(command.options, (option) => {
        if (!option.name) {
          if (!option.option || !option.syntax || option.syntax.length < 2) {
            throw new Error(`Error parsing bosco command ${command.name} options`);
          }
          oldStyleArgs = true;
        }
      });
      return !oldStyleArgs;
    }

    _.forEach(commands, (command) => {
      if (!command) return;

      if (!checkCommandOptions(command)) {
        this.warn(`The ${command.name} command uses old-style options, it will not be available until upgraded to the new style.`);
        return;
      }

      args.command(command.name, command.description, (commandArgs) => {
        addCommandOptions(commandArgs, command);
      });
    });
    return args;
  }

  run() {
    this._init((err) => {
      this._checkVersion();
      if (err) return this.console.log(err);

      // Workspace found by reverse lookup in config - github team >> workspace.
      this.options.workspace = this.findWorkspace();
      this.options.workspaceConfigPath = [this.options.workspace, '.bosco'].join('/');

      // Environment config files are only ever part of workspace config
      this.options.envConfigFile = [this.options.workspaceConfigPath, `${this.options.environment}.json`].join('/');

      // Now load the environment specific config
      this.config.add('env-override', { type: 'file', file: this.options.envConfigFile });

      this.checkInService();

      const teamDesc = this.getTeam();
      this.log(
        `Initialised using [${this.options.configFile.magenta}] `
        + `in environment [${this.options.environment.green}] ${
          teamDesc ? `with team [${teamDesc.cyan}]` : 'without a team!'.red}`,
      );
      this._cmd();
    });
  }

  _init(next) {
    this._checkConfig((err, initialise) => {
      if (err) return;

      this.config.env()
        .file({
          file: this.options.configFile,
        })
        .file('defaults', {
          file: this.options.defaultsConfigFile,
        });

      if (initialise) {
        this._initialiseConfig((err2) => {
          if (err2) return;
          next();
        });
      } else if (!this.config.get('github:user')) {
        this.error('It looks like you are in a micro service folder or something is wrong with your config?\n');
        next('Exiting - no available github configuration.');
      } else {
        next();
      }
    });
  }

  _checkConfig(next) {
    const defaultConfig = this.options._defaultConfig;
    const { configPath } = this.options;
    const { configFile } = this.options;

    const checkConfigPath = (cb) => {
      if (this.exists(configPath)) return cb();
      fs.mkdirp(configPath, cb);
    };

    const checkConfig = (cb) => {
      if (this.exists(configFile)) return cb();

      prompt.start();
      prompt.get({
        properties: {
          confirm: {
            description: 'This looks like the first time you are using Bosco, do you want to create a new configuration file in your home folder (y/N)?'.white,
          },
        },
      }, (err, result) => {
        if (!result || (result.confirm !== 'Y' && result.confirm !== 'y')) {
          return cb({
            message: 'Did not confirm',
          });
        }

        const content = fs.readFileSync(defaultConfig);
        fs.writeFileSync(configFile, content);
        cb(null, true);
      });
    };

    async.series([checkConfigPath, checkConfig], (err, result) => {
      next(err, result[1]);
    });
  }

  _initialiseConfig(next) {
    prompt.start();
    prompt.get({
      properties: {
        githubUser: {
          description: 'Enter your github user name'.white,
        },
        authToken: {
          description: 'Enter the auth token (see: https://github.com/blog/1509-personal-api-tokens)'.white,
        },
      },
    }, (err, result) => {
      if (err) {
        return this.error(`There was an error during setup: ${err.message.red}`);
      }
      this.config.set('github:user', result.githubUser);
      this.config.set('github:authToken', result.authToken);
      this.console.log('\r');
      this.config.save(next);
    });
  }

  _cmd() {
    const { args } = this.options;
    const command = args.shift();
    this.command = command;
    const globalCommandModule = `${this.getGlobalCommandFolder()}${command}.js`;
    const localCommandModule = `${this.getLocalCommandFolder()}${command}.js`;
    let commandModule;
    let module;

    if (this.exists(localCommandModule)) {
      commandModule = localCommandModule;
    }

    if (this.exists(globalCommandModule)) {
      if (commandModule) {
        this.warn(`global command ${globalCommandModule} overriding local command ${localCommandModule}`);
      }
      commandModule = globalCommandModule;
    }

    if (commandModule) {
      module = require(commandModule); // eslint-disable-line import/no-dynamic-require,global-require,max-len
    }

    if (module) {
      if (module.requiresNvm && !this.hasNvm()) {
        this.error('You must have nvm >= 0.21.0 installed to use this command, https://github.com/creationix/nvm');
        return process.exit(1);
      }

      const isPromise = (module.cmd instanceof Object.getPrototypeOf(async () => {}).constructor); // is an async function
      const handler = (err) => {
        let code = 0;
        if (err) {
          code = 1;
          if (err.code > 0) code = err.code;
        }
        process.exit(code);
      };
      if (isPromise) return module.cmd(this, args).then(() => process.exit(0)).catch(handler);
      return module.cmd(this, args, handler);
    }

    if (this.options.shellCommands) return this._shellCommands();

    this.options.program.showHelp();
  }

  _shellCommands() {
    const cmdPath = this.getGlobalCommandFolder();
    const localPath = this.getLocalCommandFolder();

    function showCommands(cPath, files, next) {
      let cmdString = '';
      files.forEach((file) => {
        cmdString += `${file.replace('.js', '')} `;
      });
      next(null, cmdString.split(' '));
    }

    async.series(
      [
        (next) => {
          fs.readdir(cmdPath, (err, files) => {
            showCommands(cmdPath, files, next);
          });
        },
        (next) => {
          fs.readdir(localPath, (err, files) => {
            if (!files || files.length === 0) return next();
            showCommands(localPath, files, next);
          });
        },
      ],
      (err, files) => {
        const flatFiles = _.uniq(_.flatten(files));
        this.console.log(`Available commands: ${flatFiles.join(' ')}`);
        process.exit(0);
      },
    );
  }

  _checkVersion() {
    this._checkingVersion = true;
    const npmUrl = 'http://registry.npmjs.org/bosco';
    request({
      url: npmUrl,
      timeout: 1000,
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        const jsonBody = JSON.parse(body);
        const version = jsonBody['dist-tags'].latest;
        if (semver.lt(this.options.version, version)) {
          this.error(`There is a newer version (Local: ${this.options.version.yellow} < Remote: ${version.green}) of Bosco available, you should upgrade!`);
          if (this.config.get('ensureLatestVersion')) {
            this.error("Bosco is not up to date - exiting. Please upgrade Bosco or disable the 'ensureLatestVersion' option to continue.");
            process.exit(1);
          }
          this.console.log('\r');
        }
      }
      this._checkingVersion = false;
    });
  }

  findHomeFolder() { // eslint-disable-line class-methods-use-this
    return osenv.home();
  }

  findConfigFolder() {
    let { platform } = process;
    const oldConfig = [osenv.home(), '.bosco'].join('/');

    if (platform === 'darwin' || platform === 'win32') {
      const { env } = process;
      if (!env.XDG_CONFIG_HOME || !env.XDG_DATA_HOME || !env.XDG_CACHE_HOME) {
        return oldConfig;
      }
      platform = 'xdg';
    }

    const dirs = new AppDirectory({
      platform,
      appName: 'bosco',
      appAuthor: 'tes',
    });
    const newConfig = dirs.userConfig();

    this._migrateConfig(oldConfig, newConfig);

    return newConfig;
  }

  // TODO(geophree): remove this after a while (added 2015-09-26)
  _migrateConfig(oldConfig, newConfig) {
    if (!this.exists(oldConfig)) return null;

    const oldConfigWarning = `You still have an old config directory at ${oldConfig.red} that you should remove.`;

    if (this.exists(newConfig)) return this.warn(oldConfigWarning);

    fs.mkdirpSync(newConfig);
    fs.copySync(oldConfig, newConfig, { clobber: true });

    this.warn(`Your configuration has been copied to ${newConfig.red}`);
    this.warn(oldConfigWarning);
  }

  findWorkspace() {
    for (let p = path.resolve('.'); ; p = path.resolve(p, '..')) {
      if (this.exists(path.join(p, '.bosco'))) return p;
      if (p === '/') break;
    }
    return path.resolve('.');
  }

  getWorkspacePath() {
    return this.options.workspace;
  }

  getTeam() {
    const teamConfig = this.config.get('teams');
    let currentTeam = null;
    _.keys(teamConfig).forEach((team) => {
      if (this.options.workspace.indexOf(teamConfig[team].path) >= 0) {
        currentTeam = team;
      }
    });
    return currentTeam;
  }

  getRepos() {
    const team = this.getTeam();
    if (!team) {
      return [path.relative('..', '.')];
    }
    return this.config.get(`teams:${team}`).repos;
  }

  getOrg() {
    const teamConfig = this.config.get('teams');
    let currentOrg = '';
    _.keys(teamConfig).forEach((team) => {
      if (this.options.workspace.indexOf(teamConfig[team].path) >= 0) {
        currentOrg = team.split('/')[0]; // eslint-disable-line prefer-destructuring
      }
    });
    return currentOrg;
  }

  getOrgPath() {
    return path.resolve(this.getWorkspacePath());
  }

  getRepoPath(repo) {
    // Strip out / to support full github references
    let repoName;
    if (repo.indexOf('/') < 0) {
      repoName = repo;
    } else {
      repoName = repo.split('/')[1]; // eslint-disable-line prefer-destructuring
    }

    const isRepoCurrentService = (this.options.inService && repo === this.options.inServiceRepo);
    const repoPath = isRepoCurrentService
      ? path.resolve('.')
      : [path.resolve(this.getWorkspacePath()), repoName].join('/');
    return repoPath;
  }

  getGlobalCommandFolder() { // eslint-disable-line class-methods-use-this
    return [this.boscoDirectory, '/', 'commands', '/'].join('');
  }

  getLocalCommandFolder() {
    const workspace = this.options && this.options.workspace
      ? this.options.workspace
      : this.findWorkspace();
    return [workspace, '/', 'commands', '/'].join('');
  }

  getRepoUrl(repo) {
    let org;
    let host = this.config.get('github:hostname') || 'github.com';
    const hostUser = this.config.get('github:hostUser') || 'git';
    host = `${hostUser}@${host}:`;

    if (repo.indexOf('/') < 0) {
      org = `${this.getOrg()}/`;
    }
    return [host, org || '', repo, '.git'].join('');
  }

  isLocalCdn() {
    return !this.config.get('aws:cdn');
  }

  getCdnUrl() {
    if (!this.isLocalCdn()) {
      return this.config.get('aws:cdn');
    }

    const cdnPort = this.config.get('cdn:port') || '7334';
    return this.config.get('cdn:url') || `http://localhost:${cdnPort}`;
  }

  getBaseCdnUrl() {
    let baseUrl = this.getCdnUrl();

    if (baseUrl.substr(-1) === '/') {
      baseUrl = baseUrl.substr(0, baseUrl.length - 1);
    }

    if (!this.isLocalCdn()) {
      baseUrl += `/${this.options.environment}`;
    }

    return baseUrl;
  }

  getAssetCdnUrl(assetUrl) {
    let url = assetUrl;

    if (assetUrl.substr(0, 1) === '/') {
      url = assetUrl.substr(1);
    }

    return `${this.getBaseCdnUrl()}/${url}`;
  }

  getRepoName() {
    let repoName = path.relative('..', '.');
    const packagePath = path.resolve('package.json');
    if (this.exists(packagePath)) {
      const requiredPackage = require(packagePath); // eslint-disable-line import/no-dynamic-require,global-require,max-len
      if (requiredPackage.name) {
        repoName = requiredPackage.name;
      }
    }
    const boscoServicePath = path.resolve('bosco-service.json');
    if (this.exists(boscoServicePath)) {
      const boscoService = require(boscoServicePath); // eslint-disable-line import/no-dynamic-require,global-require,max-len
      if (boscoService.service && boscoService.service.name) {
        repoName = boscoService.service.name;
      }
    }
    return repoName;
  }

  checkInService() {
    const cwd = path.resolve('bosco-service.json');
    if (this.exists(cwd) && this.options.service) {
      this.options.inService = true;
      this.options.inServiceRepo = this.getRepoName();
      // Replace getRepos
      this.getRepos = () => [this.getRepoName()];
    }
  }

  warn(msg, args) {
    this._log('Bosco'.yellow, msg, args);
  }

  log(msg, args) {
    this._log('Bosco'.cyan, msg, args);
  }

  error(msg, args) {
    if (this.errorStack) { this.errorStack.push({ msg, args }); }
    this._log('Bosco'.red, msg, args);
  }

  logErrorStack() {
    if (this.errorStack.length === 0) return;
    this._log('Bosco'.red, 'These are all the errors that you may have missed:');
    this.errorStack.forEach((err) => {
      this._log('Bosco'.red, err.msg, err.args);
    });
  }

  _log(identifier, msg, args) {
    const parts = {
      identifier,
      time: new Date(),
      message: args ? sf(msg, args) : msg,
    };
    if (this.options && !this.options.quiet) {
      this.console.log(sf('[{time:hh:mm:ss}] {identifier}: {message}', parts));
    }
  }

  exists(checkPath) { // eslint-disable-line class-methods-use-this
    return fs.existsSync(checkPath);
  }

  hasNvm() {
    if (this.options['system-node']) {
      return true;
    }

    const nvmDir = process.env.NVM_DIR || '';
    const homeNvmDir = process.env.HOME ? path.join(process.env.HOME, '.nvm') : '';

    const hasNvm = (nvmDir && this.exists(path.join(nvmDir, 'nvm.sh')))
      || (homeNvmDir && this.exists(path.join(homeNvmDir, 'nvm.sh')));

    if (!hasNvm) {
      this.error('Could not find nvm');
    }

    return hasNvm;
  }
}

Bosco.prototype.console = global.console;
Bosco.prototype.process = global.process;

module.exports = Bosco;
