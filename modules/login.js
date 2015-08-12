'use strict';

var request = require('request');
var crypto = require('crypto');
var xml2js = new require('xml2js').Parser();

var internals = {};

/**
 * Obtain session info, including challenge.
 *
 * Result:
 *  {
 *    sid: '0000000000000000',
 *    challenge: 'xxxxxx',
 *    blocktime: '0'
 *  }
 **/
internals.getSessionInfo = function getSessionInfo(callback) {

  request.get('http://192.168.1.1/login_sid.lua', function(err, response, body) {
    xml2js.parseString(body, function(err, data) {

      if(err) {
        return callback(err);
      }

      callback(null, {
        sid: data.SessionInfo.SID[0],
        challenge: data.SessionInfo.Challenge[0],
        blocktime: data.SessionInfo.BlockTime[0]
      });
    });
  });
};

/**
 * Obtain the password from the parameters. When not provided, ask the user to input it.
 **/
internals.getPassword = function getPassword(parameters, callback) {
  if(parameters.length) {
    return callback(null, parameters[0]);
  }

  // Password not provided
  process.stdin.setEncoding('utf8');

  process.stdin.on('readable', function() {
    var value = process.stdin.read();

    if(value) {
      value = value.toString().trim();

      if(value.length > 0) {
        process.stdin.pause();

        callback(null, value);
      }
    }
  });
};

internals.authenticate = function authenticate(content, callback) {
  request.get('http://192.168.1.1/login_sid.lua?username=&response=' + content, function(err, response, body) {

    if(err) {
      return callback(err);
    }

    xml2js.parseString(body, function(err, data) {

      if(err) {
        return callback(err);
      }

      if(data.SessionInfo.SID[0] === '0000000000000000') {
        return callback(new Error('Wrong password. Blocked for ' + data.SessionInfo.BlockTime[0] + ' seconds.'));
      }

      callback(null, {
        sid: data.SessionInfo.SID[0],
        challenge: data.SessionInfo.Challenge[0],
        blocktime: data.SessionInfo.BlockTime[0]
      });
    });
  });
}

/**
 * Generates an hash from the password and the challenge and logs-in
 **/
internals.login = function login(sid, challenge, password, callback) {

  if(!callback || !(callback instanceof Function)) {
    throw new Error('Wrong usage of login module. Callback is missing or is not a function.');
  }

  var concat = challenge + "-" + password;

  // Create md5 hash
  var md5 = crypto.createHash('md5');
  md5.update(concat, 'ucs2'); // 16 - Unicode
  var digest = md5.digest('hex');

  var result = challenge + '-' + digest;

  // Procede to authentication
  internals.authenticate(result, callback);
};

module.exports = function main(sid, parameters, callback) {

  internals.getSessionInfo(function(err, result) {
    if(err) {
      return callback(err);
    }

    if(result.sid === '0000000000000000') {
      // Authenticate

      internals.getPassword(parameters, function(err, password) {
        if(err) {
          return callback(err);
        }

        internals.login(result.sid, result.challenge, password, callback);
      });
    } else {
      callback(null, result);
    }
  });
};

module.exports.auth = false;
