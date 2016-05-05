




















var util = require('util');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var HTTPParser = process.binding('http_parser').HTTPParser;
var assert = require('assert').ok;

var common = require('_http_common');
var parsers = common.parsers;
var freeParser = common.freeParser;
var CRLF = common.CRLF;
var continueExpression = common.continueExpression;
var chunkExpression = common.chunkExpression;
var httpSocketSetup = common.httpSocketSetup;

var OutgoingMessage = require('_http_outgoing').OutgoingMessage;


var STATUS_CODES = exports.STATUS_CODES = {
  100 : 'Continue',
  101 : 'Switching Protocols',
  102 : 'Processing',                 
  200 : 'OK',
  201 : 'Created',
  202 : 'Accepted',
  203 : 'Non-Authoritative Information',
  204 : 'No Content',
  205 : 'Reset Content',
  206 : 'Partial Content',
  207 : 'Multi-Status',               
  300 : 'Multiple Choices',
  301 : 'Moved Permanently',
  302 : 'Moved Temporarily',
  303 : 'See Other',
  304 : 'Not Modified',
  305 : 'Use Proxy',
  307 : 'Temporary Redirect',
  308 : 'Permanent Redirect',         
  400 : 'Bad Request',
  401 : 'Unauthorized',
  402 : 'Payment Required',
  403 : 'Forbidden',
  404 : 'Not Found',
  405 : 'Method Not Allowed',
  406 : 'Not Acceptable',
  407 : 'Proxy Authentication Required',
  408 : 'Request Time-out',
  409 : 'Conflict',
  410 : 'Gone',
  411 : 'Length Required',
  412 : 'Precondition Failed',
  413 : 'Request Entity Too Large',
  414 : 'Request-URI Too Large',
  415 : 'Unsupported Media Type',
  416 : 'Requested Range Not Satisfiable',
  417 : 'Expectation Failed',
  418 : 'I\'m a teapot',              
  422 : 'Unprocessable Entity',       
  423 : 'Locked',                     
  424 : 'Failed Dependency',          
  425 : 'Unordered Collection',       
  426 : 'Upgrade Required',           
  428 : 'Precondition Required',      
  429 : 'Too Many Requests',          
  431 : 'Request Header Fields Too Large',
  500 : 'Internal Server Error',
  501 : 'Not Implemented',
  502 : 'Bad Gateway',
  503 : 'Service Unavailable',
  504 : 'Gateway Time-out',
  505 : 'HTTP Version Not Supported',
  506 : 'Variant Also Negotiates',    
  507 : 'Insufficient Storage',       
  509 : 'Bandwidth Limit Exceeded',
  510 : 'Not Extended',               
  511 : 'Network Authentication Required' 
};


function ServerResponse(req) {
  OutgoingMessage.call(this);

  if (req.method === 'HEAD') this._hasBody = false;

  this.sendDate = true;

  if (req.httpVersionMajor < 1 || req.httpVersionMinor < 1) {
    this.useChunkedEncodingByDefault = chunkExpression.test(req.headers.te);
    this.shouldKeepAlive = false;
  }
}
util.inherits(ServerResponse, OutgoingMessage);

ServerResponse.prototype._finish = function() {
  
  
  OutgoingMessage.prototype._finish.call(this);
};



exports.ServerResponse = ServerResponse;

ServerResponse.prototype.statusCode = 200;
ServerResponse.prototype.statusMessage = undefined;

function onServerResponseClose() {
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (this._httpMessage) this._httpMessage.emit('close');
}

ServerResponse.prototype.assignSocket = function(socket) {
  assert(!socket._httpMessage);
  socket._httpMessage = this;
  socket.on('close', onServerResponseClose);
  this.socket = socket;
  this.connection = socket;
  this.emit('socket', socket);
  this._flush();
};

ServerResponse.prototype.detachSocket = function(socket) {
  assert(socket._httpMessage === this);
  socket.removeListener('close', onServerResponseClose);
  socket._httpMessage = null;
  this.socket = this.connection = null;
};

ServerResponse.prototype.writeContinue = function(cb) {
  this._writeRaw('HTTP/1.1 100 Continue' + CRLF + CRLF, 'ascii', cb);
  this._sent100 = true;
};

ServerResponse.prototype._implicitHeader = function() {
  this.writeHead(this.statusCode);
};

ServerResponse.prototype.writeHead = function(statusCode, reason, obj) {
  var headers;

  if (util.isString(reason)) {
    
    this.statusMessage = reason;
  } else {
    
    this.statusMessage =
        this.statusMessage || STATUS_CODES[statusCode] || 'unknown';
    obj = reason;
  }
  this.statusCode = statusCode;

  if (this._headers) {
    
    if (obj) {
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k) this.setHeader(k, obj[k]);
      }
    }
    
    headers = this._renderHeaders();
  } else {
    
    headers = obj;
  }

  var statusLine = 'HTTP/1.1 ' + statusCode.toString() + ' ' +
                   this.statusMessage + CRLF;

  if (statusCode === 204 || statusCode === 304 ||
      (100 <= statusCode && statusCode <= 199)) {
    
    
    
    
    
    
    
    
    
    
    this._hasBody = false;
  }

  
  
  if (this._expect_continue && !this._sent100) {
    this.shouldKeepAlive = false;
  }

  this._storeHeader(statusLine, headers);
};

ServerResponse.prototype.writeHeader = function() {
  this.writeHead.apply(this, arguments);
};


function Server(requestListener) {
  if (!(this instanceof Server)) return new Server(requestListener);
  net.Server.call(this, { allowHalfOpen: true });

  if (requestListener) {
    this.addListener('request', requestListener);
  }

  
  
  
  this.httpAllowHalfOpen = false;

  this.addListener('connection', connectionListener);

  this.addListener('clientError', function(err, conn) {
    conn.destroy(err);
  });

  this.timeout = 2 * 60 * 1000;
}
util.inherits(Server, net.Server);


Server.prototype.setTimeout = function(msecs, callback) {
  this.timeout = msecs;
  if (callback)
    this.on('timeout', callback);
};


exports.Server = Server;


function connectionListener(socket) {
  var self = this;
  var outgoing = [];
  var incoming = [];

  function abortIncoming() {
    while (incoming.length) {
      var req = incoming.shift();
      req.emit('aborted');
      req.emit('close');
    }
    
  }

  function serverSocketCloseListener() {
    
    if (this.parser) {
      freeParser(this.parser, null, this);
    }

    abortIncoming();
  }

  httpSocketSetup(socket);

  
  
  
  if (self.timeout)
    socket.setTimeout(self.timeout);
  socket.on('timeout', function() {
    var req = socket.parser && socket.parser.incoming;
    var reqTimeout = req && !req.complete && req.emit('timeout', socket);
    var res = socket._httpMessage;
    var resTimeout = res && res.emit('timeout', socket);
    var serverTimeout = self.emit('timeout', socket);

    if (!reqTimeout && !resTimeout && !serverTimeout)
      socket.destroy();
  });

  var parser = parsers.alloc();
  parser.reinitialize(HTTPParser.REQUEST);
  parser.socket = socket;
  socket.parser = parser;
  parser.incoming = null;

  
  if (util.isNumber(this.maxHeadersCount)) {
    parser.maxHeaderPairs = this.maxHeadersCount << 1;
  } else {
    
    parser.maxHeaderPairs = 2000;
  }

  socket.addListener('error', socketOnError);
  socket.addListener('close', serverSocketCloseListener);
  parser.onIncoming = parserOnIncoming;
  socket.on('end', socketOnEnd);
  socket.on('data', socketOnData);

  
  function socketOnError(e) {
    self.emit('clientError', e, this);
  }

  function socketOnData(d) {
    assert(!socket._paused);
    var ret = parser.execute(d);
    if (ret instanceof Error) {
      socket.destroy(ret);
    } else if (parser.incoming && parser.incoming.upgrade) {
      
      var bytesParsed = ret;
      var req = parser.incoming;

      socket.removeListener('data', socketOnData);
      socket.removeListener('end', socketOnEnd);
      socket.removeListener('close', serverSocketCloseListener);
      parser.finish();
      freeParser(parser, req, null);
      parser = null;

      var eventName = req.method === 'CONNECT' ? 'connect' : 'upgrade';
      if (EventEmitter.listenerCount(self, eventName) > 0) {
        var bodyHead = d.slice(bytesParsed, d.length);

        
        
        socket._readableState.flowing = null;
        self.emit(eventName, req, socket, bodyHead);
      } else {
        
        socket.destroy();
      }
    }

    if (socket._paused) {
      
      socket.parser.pause();
    }
  }

  function socketOnEnd() {
    var socket = this;
    var ret = parser.finish();

    if (ret instanceof Error) {
      socket.destroy(ret);
      return;
    }

    if (!self.httpAllowHalfOpen) {
      abortIncoming();
      if (socket.writable) socket.end();
    } else if (outgoing.length) {
      outgoing[outgoing.length - 1]._last = true;
    } else if (socket._httpMessage) {
      socket._httpMessage._last = true;
    } else {
      if (socket.writable) socket.end();
    }
  }


  
  
  

  socket._paused = false;
  function socketOnDrain() {
    
    if (socket._paused) {
      socket._paused = false;
      socket.parser.resume();
      socket.resume();
    }
  }
  socket.on('drain', socketOnDrain);

  function parserOnIncoming(req, shouldKeepAlive) {
    incoming.push(req);

    
    
    
    if (!socket._paused) {
      var needPause = socket._writableState.needDrain;
      if (needPause) {
        socket._paused = true;
        
        
        
        socket.pause();
      }
    }

    var res = new ServerResponse(req);

    res.shouldKeepAlive = shouldKeepAlive;
    
    

    if (socket._httpMessage) {
      
      outgoing.push(res);
    } else {
      res.assignSocket(socket);
    }

    
    
    res.on('prefinish', resOnFinish);
    function resOnFinish() {
      
      
      
      assert(incoming.length === 0 || incoming[0] === req);

      incoming.shift();

      
      
      
      if (!req._consuming && !req._readableState.resumeScheduled)
        req._dump();

      res.detachSocket(socket);

      if (res._last) {
        socket.destroySoon();
      } else {
        
        var m = outgoing.shift();
        if (m) {
          m.assignSocket(socket);
        }
      }
    }

    if (!util.isUndefined(req.headers.expect) &&
        (req.httpVersionMajor == 1 && req.httpVersionMinor == 1) &&
        continueExpression.test(req.headers['expect'])) {
      res._expect_continue = true;
      if (EventEmitter.listenerCount(self, 'checkContinue') > 0) {
        self.emit('checkContinue', req, res);
      } else {
        res.writeContinue();
        self.emit('request', req, res);
      }
    } else {
      self.emit('request', req, res);
    }
    return false; 
  }
}
exports._connectionListener = connectionListener;
