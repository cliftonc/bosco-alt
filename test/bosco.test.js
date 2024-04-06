'use strict';

var expect = require('expect.js');
var fs = require('fs-extra');
var sinon = require('sinon');
var osenv = require('osenv');
var _ = require('lodash');

var Bosco = require('../src/bosco');

var HOME = osenv.home();

describe('bosco', function() {
  var bosco;
  var sandbox;

  beforeEach(function() {
    bosco = new Bosco();
  });

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    if (sandbox) sandbox.verifyAndRestore();
  });

  describe('config folder', function() {
    var mockBosco;
    beforeEach(function() {
      mockBosco = sandbox.mock(bosco);
    });

    function getConfigDir(bosco, platform, env) {
      var oldPlatform = process.platform;
      var oldEnv = process.env;
      try {
        Object.defineProperty(process, 'platform', {
          value: platform
        });
        if (env) {
          process.env = _.assign({HOME: HOME}, env);
        }
        return bosco.findConfigFolder();
      } finally {
        Object.defineProperty(process, 'platform', {
          value: oldPlatform
        });
        process.env = oldEnv;
      }
    };

    function getXdgConfigEnv(name) {
      return {
        XDG_CONFIG_HOME: '/my/' + name + '/config/home',
        XDG_DATA_HOME: '/my/' + name + '/data/home',
        XDG_CACHE_HOME: '/my/' + name + '/cache/home'
      };
    }

    it('should use XDG for config if available on any platform', function() {
      mockBosco.expects('_migrateConfig').thrice();
      expect(getConfigDir(bosco, 'linux', getXdgConfigEnv('linux'))).to.be('/my/linux/config/home/bosco');
      expect(getConfigDir(bosco, 'darwin', getXdgConfigEnv('osx'))).to.be('/my/osx/config/home/bosco');
      expect(getConfigDir(bosco, 'win32', getXdgConfigEnv('windows'))).to.be('/my/windows/config/home/bosco');
    });

    it('should default to XDG for config on linux', function() {
      mockBosco.expects('_migrateConfig').twice();
      expect(getConfigDir(bosco, 'linux')).to.be(HOME + '/.config/bosco');
      expect(getConfigDir(bosco, 'linux', {XDG_CONFIG_HOME: '/my/linux/config/home'})).to.be('/my/linux/config/home/bosco');
    });

    it('should default to dot-dir for config on not-linux', function() {
      mockBosco.expects('_migrateConfig').never();
      expect(getConfigDir(bosco, 'darwin')).to.be(HOME + '/.bosco');
      expect(getConfigDir(bosco, 'win32')).to.be(HOME + '/.bosco');
    });

    it('should call migrate with correct args', function() {
      mockBosco.expects('_migrateConfig').once().withArgs(HOME + '/.bosco', HOME + '/.config/bosco');

      getConfigDir(bosco, 'linux');
    });
  });

  describe('config folder migration', function() {
    it('should not use fs when old does not exist', function() {
      var mockFs = sandbox.mock(fs);
      mockFs.expects('mkdirpSync').never();
      mockFs.expects('copySync').never();

      var mockBosco = sandbox.mock(bosco);
      mockBosco.expects('exists').once().withArgs('foo').returns(false);

      bosco._migrateConfig('foo', 'bar');
    });

    it('should warn and not use fs when old and new exist', function() {
      var mockFs = sandbox.mock(fs);
      mockFs.expects('mkdirpSync').never();
      mockFs.expects('copySync').never();

      var mockBosco = sandbox.mock(bosco);
      mockBosco.expects('exists').once().withArgs('foo').returns(true);
      mockBosco.expects('exists').once().withArgs('bar').returns(true);
      mockBosco.expects('warn').once().withArgs(sinon.match('an old config directory'));

      bosco._migrateConfig('foo', 'bar');
    });

    it('should create and copy when new does not exist', function() {
      var mockFs = sandbox.mock(fs);
      mockFs.expects('mkdirpSync').once().withArgs('bar');
      mockFs.expects('copySync').once().withArgs('foo', 'bar');

      var mockBosco = sandbox.mock(bosco);
      mockBosco.expects('exists').once().withArgs('foo').returns(true);
      mockBosco.expects('exists').once().withArgs('bar').returns(false);
      mockBosco.expects('warn').once().withArgs(sinon.match('has been copied'));
      mockBosco.expects('warn').once().withArgs(sinon.match('an old config directory'));

      bosco._migrateConfig('foo', 'bar');
    });
  });
});
