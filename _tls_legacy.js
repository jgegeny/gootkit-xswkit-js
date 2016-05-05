




















var assert = require('assert');
var events = require('events');
var stream = require('stream');
var tls = require('tls');
var util = require('util');
var common = require('_tls_common');

var Timer = process.binding('timer_wrap').Timer;
var Connection = null;
try {
  Connection = process.binding('crypto').Connection;
} catch (e) {
  throw new Error('node.js not compiled with openssl crypto support.');
}

function SlabBuffer() {
  this.create();
}


SlabBuffer.prototype.create = function create() {
  this.isFull = false;
  this.pool = new Buffer(tls.SLAB_BUFFER_SIZE);
  this.offset = 0;
  this.remaining = this.pool.length;
};


SlabBuffer.prototype.use = function use(context, fn, size) {
  if (this.remaining === 0) {
    this.isFull = true;
    return 0;
  }

  var actualSize = this.remaining;

  if (!util.isNull(size)) actualSize = Math.min(size, actualSize);

  var bytes = fn.call(context, this.pool, this.offset, actualSize);
  if (bytes > 0) {
    this.offset += bytes;
    this.remaining -= bytes;
  }

  assert(this.remaining >= 0);

  return bytes;
};


var slabBuffer = null;



function CryptoStream(pair, options) {
  stream.Duplex.call(this, options);

  this.pair = pair;
  this._pending = null;
  this._pendingEncoding = '';
  this._pendingCallback = null;
  this._doneFlag = false;
  this._retryAfterPartial = false;
  this._halfRead = false;
  this._sslOutCb = null;
  this._resumingSession = false;
  this._reading = true;
  this._destroyed = false;
  this._ended = false;
  this._finished = false;
  this._opposite = null;

  if (util.isNull(slabBuffer)) slabBuffer = new SlabBuffer();
  this._buffer = slabBuffer;

  this.once('finish', onCryptoStreamFinish);

  
  this.once('end', onCryptoStreamEnd);
}
util.inherits(CryptoStream, stream.Duplex);


function onCryptoStreamFinish() {
  this._finished = true;

  if (this === this.pair.cleartext) {
    if (this.pair.ssl) {
      
      
      
      if (this.pair.ssl.shutdown() !== 1) {
        if (this.pair.ssl && this.pair.ssl.error)
          return this.pair.error();

        this.pair.ssl.shutdown();
      }

      if (this.pair.ssl && this.pair.ssl.error)
        return this.pair.error();
    }
  } else {
  }

  
  if (this._opposite.readable) this._opposite.read(0);

  if (this._opposite._ended) {
    this._done();

    
    if (this === this.pair.cleartext) this._opposite._done();
  }
}


function onCryptoStreamEnd() {
  this._ended = true;
}



CryptoStream.prototype.init = function init() {
  var self = this;
  this._opposite.on('sslOutEnd', function() {
    if (self._sslOutCb) {
      var cb = self._sslOutCb;
      self._sslOutCb = null;
      cb(null);
    }
  });
};


CryptoStream.prototype._write = function write(data, encoding, cb) {
  assert(util.isNull(this._pending));

  
  if (!this.pair.ssl) return cb(null);

  
  
  
  
  
  if (!this._resumingSession &&
      this._opposite._internallyPendingBytes() < 128 * 1024) {
    
    var written;
    if (this === this.pair.cleartext) {
      written = this.pair.ssl.clearIn(data, 0, data.length);
    } else {
      written = this.pair.ssl.encIn(data, 0, data.length);
    }

    
    if (this.pair.ssl && this.pair.ssl.error) {
      return cb(this.pair.error(true));
    }

    
    this.pair.cleartext.read(0);

    
    if (this.pair.encrypted._internallyPendingBytes())
      this.pair.encrypted.read(0);

    
    this.pair.maybeInitFinished();

    
    if (written === data.length) {


      
      if (this._opposite._halfRead) {
        assert(util.isNull(this._sslOutCb));
        this._sslOutCb = cb;
      } else {
        cb(null);
      }
      return;
    } else if (written !== 0 && written !== -1) {
      assert(!this._retryAfterPartial);
      this._retryAfterPartial = true;
      this._write(data.slice(written), encoding, cb);
      this._retryAfterPartial = false;
      return;
    }
  } else {

    
    this.pair.cleartext.read(0);
  }

  
  this._pending = data;
  this._pendingEncoding = encoding;
  this._pendingCallback = cb;

};


CryptoStream.prototype._writePending = function writePending() {
  var data = this._pending,
      encoding = this._pendingEncoding,
      cb = this._pendingCallback;

  this._pending = null;
  this._pendingEncoding = '';
  this._pendingCallback = null;
  this._write(data, encoding, cb);
};


CryptoStream.prototype._read = function read(size) {
  
  if (!this.pair.ssl) return this.push(null);

  
  
  if (this._resumingSession || !this._reading) return this.push('');

  var out;
  if (this === this.pair.cleartext) {
    out = this.pair.ssl.clearOut;
  } else {
    out = this.pair.ssl.encOut;
  }

  var bytesRead = 0,
      start = this._buffer.offset,
      last = start;
  do {
    assert(last === this._buffer.offset);
    var read = this._buffer.use(this.pair.ssl, out, size - bytesRead);
    if (read > 0) {
      bytesRead += read;
    }
    last = this._buffer.offset;

    
    if (this.pair.ssl && this.pair.ssl.error) {
      this.pair.error();
      break;
    }
  } while (read > 0 &&
           !this._buffer.isFull &&
           bytesRead < size &&
           this.pair.ssl !== null);

  
  this.pair.maybeInitFinished();

  
  var pool = this._buffer.pool;
  if (this._buffer.isFull) this._buffer.create();

  assert(bytesRead >= 0);


  
  if (!util.isNull(this._pending)) this._writePending();
  if (!util.isNull(this._opposite._pending)) this._opposite._writePending();

  if (bytesRead === 0) {
    
    if (this._opposite._finished && this._internallyPendingBytes() === 0 ||
        this.pair.ssl && this.pair.ssl.receivedShutdown) {
      
      this._done();

      
      if (this === this.pair.cleartext) {
        this._opposite._done();

        
        this.push(null);
      } else if (!this.pair.ssl || !this.pair.ssl.receivedShutdown) {
        
        this.push(null);
      }
    } else {
      
      this.push('');
    }
  } else {
    
    this.push(pool.slice(start, start + bytesRead));
  }

  
  var halfRead = this._internallyPendingBytes() !== 0;

  
  if (this._halfRead !== halfRead) {
    this._halfRead = halfRead;

    
    if (!halfRead) {

      this.emit('sslOutEnd');
    }
  }
};


CryptoStream.prototype.setTimeout = function(timeout, callback) {
  if (this.socket) this.socket.setTimeout(timeout, callback);
};


CryptoStream.prototype.setNoDelay = function(noDelay) {
  if (this.socket) this.socket.setNoDelay(noDelay);
};


CryptoStream.prototype.setKeepAlive = function(enable, initialDelay) {
  if (this.socket) this.socket.setKeepAlive(enable, initialDelay);
};

CryptoStream.prototype.__defineGetter__('bytesWritten', function() {
  return this.socket ? this.socket.bytesWritten : 0;
});

CryptoStream.prototype.getPeerCertificate = function(detailed) {
  if (this.pair.ssl) {
    return common.translatePeerCertificate(
        this.pair.ssl.getPeerCertificate(detailed));
  }

  return null;
};

CryptoStream.prototype.getSession = function() {
  if (this.pair.ssl) {
    return this.pair.ssl.getSession();
  }

  return null;
};

CryptoStream.prototype.isSessionReused = function() {
  if (this.pair.ssl) {
    return this.pair.ssl.isSessionReused();
  }

  return null;
};

CryptoStream.prototype.getCipher = function(err) {
  if (this.pair.ssl) {
    return this.pair.ssl.getCurrentCipher();
  } else {
    return null;
  }
};


CryptoStream.prototype.end = function(chunk, encoding) {

  
  if (!util.isNull(this._pending)) this._writePending();

  this.writable = false;

  stream.Duplex.prototype.end.call(this, chunk, encoding);
};


CryptoStream.prototype.destroySoon = function(err) {

  if (this.writable)
    this.end();

  if (this._writableState.finished && this._opposite._ended) {
    this.destroy();
  } else {
    
    
    var self = this;
    var waiting = 1;
    function finish() {
      if (--waiting === 0) self.destroy();
    }
    this._opposite.once('end', finish);
    if (!this._finished) {
      this.once('finish', finish);
      ++waiting;
    }
  }
};


CryptoStream.prototype.destroy = function(err) {
  if (this._destroyed) return;
  this._destroyed = true;
  this.readable = this.writable = false;

  
  this._opposite.destroy();

  var self = this;
  process.nextTick(function() {
    
    self.push(null);

    
    self.emit('close', err ? true : false);
  });
};


CryptoStream.prototype._done = function() {
  this._doneFlag = true;

  if (this === this.pair.encrypted && !this.pair._secureEstablished)
    return this.pair.error();

  if (this.pair.cleartext._doneFlag &&
      this.pair.encrypted._doneFlag &&
      !this.pair._doneFlag) {
    
    this.pair.destroy();
  }
};



Object.defineProperty(CryptoStream.prototype, 'readyState', {
  get: function() {
    if (this._connecting) {
      return 'opening';
    } else if (this.readable && this.writable) {
      return 'open';
    } else if (this.readable && !this.writable) {
      return 'readOnly';
    } else if (!this.readable && this.writable) {
      return 'writeOnly';
    } else {
      return 'closed';
    }
  }
});


function CleartextStream(pair, options) {
  CryptoStream.call(this, pair, options);

  
  
  var self = this;
  this._handle = {
    readStop: function() {
      self._reading = false;
    },
    readStart: function() {
      if (self._reading && self._readableState.length > 0) return;
      self._reading = true;
      self.read(0);
      if (self._opposite.readable) self._opposite.read(0);
    }
  };
}
util.inherits(CleartextStream, CryptoStream);


CleartextStream.prototype._internallyPendingBytes = function() {
  if (this.pair.ssl) {
    return this.pair.ssl.clearPending();
  } else {
    return 0;
  }
};


CleartextStream.prototype.address = function() {
  return this.socket && this.socket.address();
};


CleartextStream.prototype.__defineGetter__('remoteAddress', function() {
  return this.socket && this.socket.remoteAddress;
});

CleartextStream.prototype.__defineGetter__('remoteFamily', function() {
  return this.socket && this.socket.remoteFamily;
});

CleartextStream.prototype.__defineGetter__('remotePort', function() {
  return this.socket && this.socket.remotePort;
});


CleartextStream.prototype.__defineGetter__('localAddress', function() {
  return this.socket && this.socket.localAddress;
});


CleartextStream.prototype.__defineGetter__('localPort', function() {
  return this.socket && this.socket.localPort;
});


function EncryptedStream(pair, options) {
  CryptoStream.call(this, pair, options);
}
util.inherits(EncryptedStream, CryptoStream);


EncryptedStream.prototype._internallyPendingBytes = function() {
  if (this.pair.ssl) {
    return this.pair.ssl.encPending();
  } else {
    return 0;
  }
};


function onhandshakestart() {
  
  var self = this;
  var ssl = self.ssl;
  var now = Timer.now();

  assert(now >= ssl.lastHandshakeTime);

  if ((now - ssl.lastHandshakeTime) >= tls.CLIENT_RENEG_WINDOW * 1000) {
    ssl.handshakes = 0;
  }

  var first = (ssl.lastHandshakeTime === 0);
  ssl.lastHandshakeTime = now;
  if (first) return;

  if (++ssl.handshakes > tls.CLIENT_RENEG_LIMIT) {
    
    
    
    setImmediate(function() {
      var err = new Error('TLS session renegotiation attack detected.');
      if (self.cleartext) self.cleartext.emit('error', err);
    });
  }
}


function onhandshakedone() {
  
  
}


function onclienthello(hello) {
  var self = this,
      once = false;

  this._resumingSession = true;
  function callback(err, session) {
    if (once) return;
    once = true;

    if (err) return self.socket.destroy(err);

    self.ssl.loadSession(session);
    self.ssl.endParser();

    
    self._resumingSession = false;
    self.cleartext.read(0);
    self.encrypted.read(0);
  }

  if (hello.sessionId.length <= 0 ||
      !this.server ||
      !this.server.emit('resumeSession', hello.sessionId, callback)) {
    callback(null, null);
  }
}


function onnewsession(key, session) {
  if (!this.server) return;

  var self = this;
  var once = false;

  self.server.emit('newSession', key, session, function() {
    if (once)
      return;
    once = true;

    if (self.ssl)
      self.ssl.newSessionDone();
  });
}


function onocspresponse(resp) {
  this.emit('OCSPResponse', resp);
}




function SecurePair(context, isServer, requestCert, rejectUnauthorized,
                    options) {
  if (!(this instanceof SecurePair)) {
    return new SecurePair(context,
                          isServer,
                          requestCert,
                          rejectUnauthorized,
                          options);
  }

  var self = this;

  options || (options = {});

  events.EventEmitter.call(this);

  this.server = options.server;
  this._secureEstablished = false;
  this._isServer = isServer ? true : false;
  this._encWriteState = true;
  this._clearWriteState = true;
  this._doneFlag = false;
  this._destroying = false;

  if (!context) {
    this.credentials = tls.createSecureContext();
  } else {
    this.credentials = context;
  }

  if (!this._isServer) {
    
    
    requestCert = true;
  }

  this._rejectUnauthorized = rejectUnauthorized ? true : false;
  this._requestCert = requestCert ? true : false;

  this.ssl = new Connection(this.credentials.context,
                            this._isServer ? true : false,
                            this._isServer ? this._requestCert :
                                             options.servername,
                            this._rejectUnauthorized);

  if (this._isServer) {
    this.ssl.onhandshakestart = onhandshakestart.bind(this);
    this.ssl.onhandshakedone = onhandshakedone.bind(this);
    this.ssl.onclienthello = onclienthello.bind(this);
    this.ssl.onnewsession = onnewsession.bind(this);
    this.ssl.lastHandshakeTime = 0;
    this.ssl.handshakes = 0;
  } else {
    this.ssl.onocspresponse = onocspresponse.bind(this);
  }

  if (process.features.tls_sni) {
    if (this._isServer && options.SNICallback) {
      this.ssl.setSNICallback(options.SNICallback);
    }
    this.servername = null;
  }

  if (process.features.tls_npn && options.NPNProtocols) {
    this.ssl.setNPNProtocols(options.NPNProtocols);
    this.npnProtocol = null;
  }

  
  this.cleartext = new CleartextStream(this, options.cleartext);

  
  this.encrypted = new EncryptedStream(this, options.encrypted);

  
  this.cleartext._opposite = this.encrypted;
  this.encrypted._opposite = this.cleartext;
  this.cleartext.init();
  this.encrypted.init();

  process.nextTick(function() {
    
    if (self.ssl) {
      self.ssl.start();

      if (options.requestOCSP)
        self.ssl.requestOCSP();

      
      if (self.ssl && self.ssl.error)
        self.error();
    }
  });
}

util.inherits(SecurePair, events.EventEmitter);


exports.createSecurePair = function(context,
                                    isServer,
                                    requestCert,
                                    rejectUnauthorized) {
  var pair = new SecurePair(context,
                            isServer,
                            requestCert,
                            rejectUnauthorized);
  return pair;
};


SecurePair.prototype.maybeInitFinished = function() {
  if (this.ssl && !this._secureEstablished && this.ssl.isInitFinished()) {
    if (process.features.tls_npn) {
      this.npnProtocol = this.ssl.getNegotiatedProtocol();
    }

    if (process.features.tls_sni) {
      this.servername = this.ssl.getServername();
    }

    this._secureEstablished = true;
    this.emit('secure');
  }
};


SecurePair.prototype.destroy = function() {
  if (this._destroying) return;

  if (!this._doneFlag) {
    this._destroying = true;

    
    this.cleartext.destroy();
    this.encrypted.destroy();

    this._doneFlag = true;
    this.ssl.error = null;
    this.ssl.close();
    this.ssl = null;
  }
};


SecurePair.prototype.error = function(returnOnly) {
  var err = this.ssl.error;
  this.ssl.error = null;

  if (!this._secureEstablished) {
    
    if (!err || err.message === 'ZERO_RETURN') {
      var connReset = new Error('socket hang up');
      connReset.code = 'ECONNRESET';
      connReset.sslError = err && err.message;

      err = connReset;
    }
    this.destroy();
    if (!returnOnly) this.emit('error', err);
  } else if (this._isServer &&
             this._rejectUnauthorized &&
             /peer did not return a certificate/.test(err.message)) {
    
    this.destroy();
  } else {
    if (!returnOnly) this.cleartext.emit('error', err);
  }
  return err;
};


exports.pipe = function pipe(pair, socket) {
  pair.encrypted.pipe(socket);
  socket.pipe(pair.encrypted);

  pair.encrypted.on('close', function() {
    process.nextTick(function() {
      
      
      pair.encrypted.unpipe(socket);
      socket.destroySoon();
    });
  });

  pair.fd = socket.fd;
  var cleartext = pair.cleartext;
  cleartext.socket = socket;
  cleartext.encrypted = pair.encrypted;
  cleartext.authorized = false;

  
  
  
  
  
  
  
  socket.on('drain', function() {
    if (pair.encrypted._pending)
      pair.encrypted._writePending();
    if (pair.cleartext._pending)
      pair.cleartext._writePending();
    pair.encrypted.read(0);
    pair.cleartext.read(0);
  });

  function onerror(e) {
    if (cleartext._controlReleased) {
      cleartext.emit('error', e);
    }
  }

  function onclose() {
    socket.removeListener('error', onerror);
    socket.removeListener('timeout', ontimeout);
  }

  function ontimeout() {
    cleartext.emit('timeout');
  }

  socket.on('error', onerror);
  socket.on('close', onclose);
  socket.on('timeout', ontimeout);

  return cleartext;
};
