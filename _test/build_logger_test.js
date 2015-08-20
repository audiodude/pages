/* jshint node: true */
/* jshint expr: true */
/* jshint mocha: true */
'use strict';

var path = require('path');
var fs = require('fs');
var chai = require('chai');
var sinon = require('sinon');
var build_logger = require('../build-logger.js');

var expect = chai.expect;
chai.should();

describe('BuildLogger', function() {
  var logger, log_file_dir, log_file_path;

  before(function() {
    log_file_dir = path.resolve(__dirname, 'build_logger_test');
    log_file_path = path.resolve(log_file_dir, 'build.log');
  });

  beforeEach(function(done) {
    fs.exists(log_file_dir, function(exists) {
      (exists ? fs.chmod : fs.mkdir)(log_file_dir, '0700', done);
    });
  });

  afterEach(function(done) {
    fs.exists(log_file_path, function(exists) {
      if (exists) { fs.unlink(log_file_path, done); } else { done(); }
    });
  });

  after(function(done) {
    fs.exists(log_file_dir, function(exists) {
      if (exists) { fs.rmdir(log_file_dir, done); } else { done(); }
    });
  });

  var make_logger = function(done) {
    return new build_logger.BuildLogger(log_file_path, done);
  };

  var capture_logs = function() {
    sinon.stub(console, 'log').returns(void 0);
    sinon.stub(console, 'error').returns(void 0);
  };

  var restore_logs = function() {
    console.error.restore();
    console.log.restore();
  };

  var check_n = function(n, done, cb) {
    return function(err) {
      if (--n === 0) {
        try {
          cb(err);
          restore_logs();
          done();
        } catch (e) {
          restore_logs();
          done(e);
        }
      }
    };
  };

  it ('should fail if the file cannot be written to', function(done) {
    logger = make_logger(check_n(2, done, function() {
      var expected_error = 'Error: EACCES, open \'' + log_file_path + '\'';
      // I expected the following to succeed, since the failing call happens
      // after the successful call:
      //
      // expect(err).to.equal(expected_error);
      //
      // But here's the thing: It takes longer to flush the first, successful
      // call than it does to change the file permission and make the second 
      // call fail.
      expect(console.log.called).to.be.true;
      expect(console.log.args[0].join(' '))
        .to.equal('This should be logged to the file');
      expect(fs.readFileSync(log_file_path).toString())
        .to.equal('This should be logged to the file\n');
      expect(console.log.args[1].join(' '))
        .to.equal('This should not be logged to the file');
      expect(console.error.called).to.be.true;
      expect(console.error.args[0].join(' '))
        .to.equal('Error: failed to append to log file ' + log_file_path +
          ': ' + expected_error);
    }));

    capture_logs();
    logger.log('This should be logged to the file');

    fs.chmod(log_file_path, '400', function(err) {
      if (err) {
        done(err);
        return;
      }
      logger.log('This should not be logged to the file');
    });
  });

  it('should log everything to the file', function(done) {
    logger = make_logger(check_n(2, done, function(err) {
      expect(err).to.be.null;
      expect(console.log.called).to.be.true;
      expect(console.log.args[0].join(' '))
        .to.equal('This should be logged to the file');
      expect(console.error.called).to.be.true;
      expect(console.error.args[0].join(' '))
        .to.equal('This should also be logged to the file');
      expect(fs.readFileSync(log_file_path).toString())
        .to.equal('This should be logged to the file\n' +
          'This should also be logged to the file\n');
    }));
    capture_logs();
    logger.log('This should be logged to the file');
    logger.error('This should also be logged to the file');
  });
});
