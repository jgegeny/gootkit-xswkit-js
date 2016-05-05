




















var util = require('util');
var net = require('net');
var url = require('url');
var EventEmitter = require('events').EventEmitter;
var HTTPParser = process.binding('http_parser').HTTPParser;
var assert = require('assert').ok;

var common = require('_http_common');

var httpSocketSetup = common.httpSocketSetup;
var parsers = common.parsers;
var freeParser = common.freeParser;

var OutgoingMessage = require('_http_outgoing').OutgoingMessage;

var Agent = require('_http_agent');


function ClientRequest(options, cb) {
  var self = this;
  OutgoingMessage.call(self);

  if (util.isString(options)) {
    options = url.parse(options);
  } else {
    options = util._extend({}, options);
  }

  var agent = options.agent;
  var defaultAgent = options._defaultAgent || Agent.globalAgent;
  if (agent === false) {
    agent = new defaultAgent.constructor();
  } else if (util.isNullOrUndefined(agent) && !options.createConnection) {
    agent = defaultAgent;
  }
  self.agent = agent;

  var protocol = options.protocol || defaultAgent.protocol;
  var expectedProtocol = defaultAgent.protocol;
  if (self.agent && self.agent.protocol)
    expectedProtocol = self.agent.protocol;

  if (options.path && / /.test(options.path)) {
    
    
    
    
    
    
    throw new TypeError('Request path contains unescaped characters.');
  } else if (protocol !== expectedProtocol) {
    throw new Error('Protocol "' + protocol + '" not supported. ' +
                    'Expected "' + expectedProtocol + '".');
  }

  var defaultPort = options.defaultPort || self.agent && self.agent.defaultPort;

  var port = options.port = options.port || defaultPort || 80;
  var host = options.host = options.hostname || options.host || 'localhost';

  if (util.isUndefined(options.setHost)) {
    var setHost = true;
  }

  self.socketPath = options.socketPath;

  var method = self.method = (options.method || 'GET').toUpperCase();
  self.path = options.path || '/';
  if (cb) {
    self.once('response', cb);
  }

  if (!util.isArray(options.headers)) {
    if (options.headers) {
      var keys = Object.keys(options.headers);
      for (var i = 0, l = keys.length; i < l; i++) {
        var key = keys[i];
        self.setHeader(key, options.headers[key]);
      }
    }
    if (host && !this.getHeader('host') && setHost) {
      var hostHeader = host;
      if (port && +port !== defaultPort) {
        hostHeader += ':' + port;
      }
      this.setHeader('Host', hostHeader);
    }
  }

  if (options.auth && !this.getHeader('Authorization')) {
    
    this.setHeader('Authorization', 'Basic ' +
                   new Buffer(options.auth).toString('base64'));
  }

  if (method === 'GET' ||
      method === 'HEAD' ||
      method === 'DELETE' ||
      method === 'OPTIONS' ||
      method === 'CONNECT') {
    self.useChunkedEncodingByDefault = false;
  } else {
    self.useChunkedEncodingByDefault = true;
  }

  if (util.isArray(options.headers)) {
    self._storeHeader(self.method + ' ' + self.path + ' HTTP/1.1\r\n',
                      options.headers);
  } else if (self.getHeader('expect')) {
    self._storeHeader(self.method + ' ' + self.path + ' HTTP/1.1\r\n',
                      self._renderHeaders());
  }

  if (self.socketPath) {
    self._last = true;
    self.shouldKeepAlive = false;
    var conn = self.agent.createConnection({ path: self.socketPath });
    self.onSocket(conn);
  } else if (self.agent) {
    
    
    
    
    if (!self.agent.keepAlive && !Number.isFinite(self.agent.maxSockets)) {
      self._last = true;
      self.shouldKeepAlive = false;
    } else {
      self._last = false;
      self.shouldKeepAlive = true;
    }
    self.agent.addRequest(self, options);
  } else {
    
    self._last = true;
    self.shouldKeepAlive = false;
    if (options.createConnection) {
      var conn = options.createConnection(options);
    } else {
      var conn = net.createConnection(options);
    }
    self.onSocket(conn);
  }

  self._deferToConnect(null, null, function() {
    self._flush();
    self = null;
  });
}

util.inherits(ClientRequest, OutgoingMessage);

exports.ClientRequest = ClientRequest;

ClientRequest.prototype.aborted = undefined;

ClientRequest.prototype._finish = function() {
  
  
  OutgoingMessage.prototype._finish.call(this);
};

ClientRequest.prototype._implicitHeader = function() {
  this._storeHeader(this.method + ' ' + this.path + ' HTTP/1.1\r\n',
                    this._renderHeaders());
};

ClientRequest.prototype.abort = function() {
  
  
  
  this.aborted = Date.now();

  
  if (this.res)
    this.res._dump();
  else
    this.once('response', function(res) {
      res._dump();
    });

  
  
  if (this.socket) {
    
    this.socket.destroy();
  }
};


function createHangUpError() {
  var error = new Error('socket hang up');
  error.code = 'ECONNRESET';
  return error;
}


function socketCloseListener() {
  var socket = this;
  var req = socket._httpMessage;

  
  
  
  socket.read();

  
  
  var parser = socket.parser;
  req.emit('close');
  if (req.res && req.res.readable) {
    
    req.res.emit('aborted');
    var res = req.res;
    res.on('end', function() {
      res.emit('close');
    });
    res.push(null);
  } else if (!req.res && !req.socket._hadError) {
    
    
    
    req.emit('error', createHangUpError());
    req.socket._hadError = true;
  }

  
  
  
  if (req.output)
    req.output.length = 0;
  if (req.outputEncodings)
    req.outputEncodings.length = 0;

  if (parser) {
    parser.finish();
    freeParser(parser, req, socket);
  }
}

function socketErrorListener(err) {
  var socket = this;
  var parser = socket.parser;
  var req = socket._httpMessage;

  if (req) {
    req.emit('error', err);
    
    
    req.socket._hadError = true;
  }

  if (parser) {
    parser.finish();
    freeParser(parser, req, socket);
  }
  socket.destroy();
}

function socketOnEnd() {
  var socket = this;
  var req = this._httpMessage;
  var parser = this.parser;

  if (!req.res && !req.socket._hadError) {
    
    
    req.emit('error', createHangUpError());
    req.socket._hadError = true;
  }
  if (parser) {
    parser.finish();
    freeParser(parser, req, socket);
  }
  socket.destroy();
}

function socketOnData(d) {
  var socket = this;
  var req = this._httpMessage;
  var parser = this.parser;

  assert(parser && parser.socket === socket);

  var ret = parser.execute(d);
  if (ret instanceof Error) {
    freeParser(parser, req, socket);
    socket.destroy();
    req.emit('error', ret);
    req.socket._hadError = true;
  } else if (parser.incoming && parser.incoming.upgrade) {
    
    var bytesParsed = ret;
    var res = parser.incoming;
    req.res = res;

    socket.removeListener('data', socketOnData);
    socket.removeListener('end', socketOnEnd);
    parser.finish();

    var bodyHead = d.slice(bytesParsed, d.length);

    var eventName = req.method === 'CONNECT' ? 'connect' : 'upgrade';
    if (EventEmitter.listenerCount(req, eventName) > 0) {
      req.upgradeOrConnect = true;

      
      socket.emit('agentRemove');
      socket.removeListener('close', socketCloseListener);
      socket.removeListener('error', socketErrorListener);

      
      
      socket._readableState.flowing = null;

      req.emit(eventName, res, socket, bodyHead);
      req.emit('close');
    } else {
      
      socket.destroy();
    }
    freeParser(parser, req, socket);
  } else if (parser.incoming && parser.incoming.complete &&
             
             
             
             parser.incoming.statusCode !== 100) {
    socket.removeListener('data', socketOnData);
    socket.removeListener('end', socketOnEnd);
    freeParser(parser, req, socket);
  }
}



function parserOnIncomingClient(res, shouldKeepAlive) {
  var socket = this.socket;
  var req = socket._httpMessage;


  
  if (req.domain && !res.domain) {

    res.domain = req.domain;
  }

  if (req.res) {
    
    
    socket.destroy();
    return;
  }
  req.res = res;

  
  if (req.method === 'CONNECT') {
    res.upgrade = true;
    return true; 
  }

  
  
  
  
  
  var isHeadResponse = req.method === 'HEAD';

  if (res.statusCode === 100) {
    
    delete req.res; 
    req.emit('continue');
    return true;
  }

  if (req.shouldKeepAlive && !shouldKeepAlive && !req.upgradeOrConnect) {
    
    
    
    req.shouldKeepAlive = false;
  }


  
  
  req.res = res;
  res.req = req;

  
  res.on('end', responseOnEnd);
  var handled = req.emit('response', res);

  
  
  
  if (!handled)
    res._dump();

  return isHeadResponse;
}


function responseOnEnd() {
  var res = this;
  var req = res.req;
  var socket = req.socket;

  if (!req.shouldKeepAlive) {
    if (socket.writable) {
      socket.destroySoon();
    }
    assert(!socket.writable);
  } else {
    if (req.timeoutCb) {
      socket.setTimeout(0, req.timeoutCb);
      req.timeoutCb = null;
    }
    socket.removeListener('close', socketCloseListener);
    socket.removeListener('error', socketErrorListener);
    
    
    process.nextTick(function() {
      socket.emit('free');
    });
  }
}

function tickOnSocket(req, socket) {
  var parser = parsers.alloc();
  req.socket = socket;
  req.connection = socket;
  parser.reinitialize(HTTPParser.RESPONSE);
  parser.socket = socket;
  parser.incoming = null;
  req.parser = parser;

  socket.parser = parser;
  socket._httpMessage = req;

  
  httpSocketSetup(socket);

  
  if (util.isNumber(req.maxHeadersCount)) {
    parser.maxHeaderPairs = req.maxHeadersCount << 1;
  } else {
    
    parser.maxHeaderPairs = 2000;
  }

  parser.onIncoming = parserOnIncomingClient;
  socket.on('error', socketErrorListener);
  socket.on('data', socketOnData);
  socket.on('end', socketOnEnd);
  socket.on('close', socketCloseListener);
  req.emit('socket', socket);
}

ClientRequest.prototype.onSocket = function(socket) {
  var req = this;

  process.nextTick(function() {
    if (req.aborted) {
      
      socket.emit('free');
    } else {
      tickOnSocket(req, socket);
    }
  });
};

ClientRequest.prototype._deferToConnect = function(method, arguments_, cb) {
  
  
  
  
  
  var self = this;
  var onSocket = function() {
    if (self.socket.writable) {
      if (method) {
        self.socket[method].apply(self.socket, arguments_);
      }
      if (cb) { cb(); }
    } else {
      self.socket.once('connect', function() {
        if (method) {
          self.socket[method].apply(self.socket, arguments_);
        }
        if (cb) { cb(); }
      });
    }
  }
  if (!self.socket) {
    self.once('socket', onSocket);
  } else {
    onSocket();
  }
};

ClientRequest.prototype.setTimeout = function(msecs, callback) {
  if (callback) this.once('timeout', callback);

  var self = this;
  function emitTimeout() {
    self.emit('timeout');
  }

  if (this.socket && this.socket.writable) {
    if (this.timeoutCb)
      this.socket.setTimeout(0, this.timeoutCb);
    this.timeoutCb = emitTimeout;
    this.socket.setTimeout(msecs, emitTimeout);
    return;
  }

  
  this.timeoutCb = emitTimeout;
  if (this.socket) {
    var sock = this.socket;
    this.socket.once('connect', function() {
      sock.setTimeout(msecs, emitTimeout);
    });
    return;
  }

  this.once('socket', function(sock) {
    sock.setTimeout(msecs, emitTimeout);
  });
};

ClientRequest.prototype.setNoDelay = function() {
  this._deferToConnect('setNoDelay', arguments);
};
ClientRequest.prototype.setSocketKeepAlive = function() {
  this._deferToConnect('setKeepAlive', arguments);
};

ClientRequest.prototype.clearTimeout = function(cb) {
  this.setTimeout(0, cb);
};
