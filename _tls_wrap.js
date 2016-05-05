























var assert = require('assert');
var crypto = require('crypto');
var net = require('net');
var tls = require('tls');
var util = require('util');
var listenerCount = require('events').listenerCount;
var common = require('_tls_common');

var Timer = process.binding('timer_wrap').Timer;
var tls_wrap = process.binding('tls_wrap');


var tls_legacy;

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
      self._tlsError(err);
    });
  }
}


function onhandshakedone() {
  
  
  this._finishInit();
}


function loadSession(self, hello, cb) {
  var once = false;
  function onSession(err, session) {
    if (once)
      return cb(new Error('TLS session callback was called 2 times'));
    once = true;

    if (err)
      return cb(err);

    
    
    
    var ret = self.ssl.loadSession(session);

    cb(null, ret);
  }

  if (hello.sessionId.length <= 0 ||
      hello.tlsTicket ||
      self.server &&
      !self.server.emit('resumeSession', hello.sessionId, onSession)) {
    cb(null);
  }
}


function loadSNI(self, servername, cb) {
  if (!servername || !self._SNICallback)
    return cb(null);

  var once = false;
  self._SNICallback(servername, function(err, context) {
    if (once)
      return cb(new Error('TLS SNI callback was called 2 times'));
    once = true;

    if (err)
      return cb(err);

    
    if (context)
      self.ssl.sni_context = context.context || context;

    cb(null, self.ssl.sni_context);
  });
}


function requestOCSP(self, hello, ctx, cb) {
  if (!hello.OCSPRequest || !self.server)
    return cb(null);

  if (!ctx)
    ctx = self.server._sharedCreds;
  if (ctx.context)
    ctx = ctx.context;

  if (listenerCount(self.server, 'OCSPRequest') === 0) {
    return cb(null);
  } else {
    self.server.emit('OCSPRequest',
                     ctx.getCertificate(),
                     ctx.getIssuer(),
                     onOCSP);
  }

  var once = false;
  function onOCSP(err, response) {
    if (once)
      return cb(new Error('TLS OCSP callback was called 2 times'));
    once = true;

    if (err)
      return cb(err);

    if (response)
      self.ssl.setOCSPResponse(response);
    cb(null);
  }
}


function onclienthello(hello) {
  var self = this;

  loadSession(self, hello, function(err, session) {
    if (err)
      return self.destroy(err);

    
    
    
    
    
    
    
    
    
    
    
    
    
    var servername = session && session.servername || hello.servername;
    loadSNI(self, servername, function(err, ctx) {
      if (err)
        return self.destroy(err);
      requestOCSP(self, hello, ctx, function(err) {
        if (err)
          return self.destroy(err);

        self.ssl.endParser();
      });
    });
  });
}


function onnewsession(key, session) {
  if (!this.server)
    return;

  var self = this;
  var once = false;

  this._newSessionPending = true;
  this.server.emit('newSession', key, session, function() {
    if (once)
      return;
    once = true;

    self.ssl.newSessionDone();

    self._newSessionPending = false;
    if (self._securePending)
      self._finishInit();
    self._securePending = false;
  });
}


function onocspresponse(resp) {
  this.emit('OCSPResponse', resp);
}




function TLSSocket(socket, options) {
  
  assert(!(socket instanceof TLSSocket));

  net.Socket.call(this, {
    handle: socket && socket._handle,
    allowHalfOpen: socket && socket.allowHalfOpen,
    readable: false,
    writable: false
  });

  
  if (socket)
    this._connecting = socket._connecting;

  this._tlsOptions = options;
  this._secureEstablished = false;
  this._securePending = false;
  this._newSessionPending = false;
  this._controlReleased = false;
  this._SNICallback = null;
  this.ssl = null;
  this.servername = null;
  this.npnProtocol = null;
  this.authorized = false;
  this.authorizationError = null;

  
  
  this.encrypted = true;

  this.on('error', this._tlsError);

  if (!this._handle) {
    this.once('connect', function() {
      this._init(null);
    });
  } else {
    this._init(socket);
  }

  
  
  this.readable = true;
  this.writable = true;
  this.read(0);
}
util.inherits(TLSSocket, net.Socket);
exports.TLSSocket = TLSSocket;

TLSSocket.prototype._init = function(socket) {
  assert(this._handle);

  
  
  
  
  this._handle.writeQueueSize = 1;

  var self = this;
  var options = this._tlsOptions;

  
  var context = options.secureContext ||
                options.credentials ||
                tls.createSecureContext();
  this.ssl = tls_wrap.wrap(this._handle, context.context, options.isServer);
  this.server = options.server || null;

  
  
  var requestCert = !!options.requestCert || !options.isServer,
      rejectUnauthorized = !!options.rejectUnauthorized;

  this._requestCert = requestCert;
  this._rejectUnauthorized = rejectUnauthorized;
  if (requestCert || rejectUnauthorized)
    this.ssl.setVerifyMode(requestCert, rejectUnauthorized);

  if (options.isServer) {
    this.ssl.onhandshakestart = onhandshakestart.bind(this);
    this.ssl.onhandshakedone = onhandshakedone.bind(this);
    this.ssl.onclienthello = onclienthello.bind(this);
    this.ssl.onnewsession = onnewsession.bind(this);
    this.ssl.lastHandshakeTime = 0;
    this.ssl.handshakes = 0;

    if (this.server &&
        (listenerCount(this.server, 'resumeSession') > 0 ||
         listenerCount(this.server, 'newSession') > 0 ||
         listenerCount(this.server, 'OCSPRequest') > 0)) {
      this.ssl.enableSessionCallbacks();
    }
  } else {
    this.ssl.onhandshakestart = function() {};
    this.ssl.onhandshakedone = this._finishInit.bind(this);
    this.ssl.onocspresponse = onocspresponse.bind(this);

    if (options.session)
      this.ssl.setSession(options.session);
  }

  this.ssl.onerror = function(err) {
    if (self._writableState.errorEmitted)
      return;
    self._writableState.errorEmitted = true;

    
    if (!this._secureEstablished) {
      self._tlsError(err);
      self.destroy();
    } else if (options.isServer &&
               rejectUnauthorized &&
               /peer did not return a certificate/.test(err.message)) {
      
      self.destroy();
    } else {
      
      self._tlsError(err);
    }
  };

  
  
  
  if (process.features.tls_sni &&
      options.isServer &&
      options.server &&
      (options.SNICallback !== SNICallback ||
       options.server._contexts.length)) {
    assert(typeof options.SNICallback === 'function');
    this._SNICallback = options.SNICallback;
    this.ssl.enableHelloParser();
  }

  if (process.features.tls_npn && options.NPNProtocols)
    this.ssl.setNPNProtocols(options.NPNProtocols);

  if (options.handshakeTimeout > 0)
    this.setTimeout(options.handshakeTimeout, this._handleTimeout);

  
  if (socket && socket._readableState.length) {
    var buf;
    while ((buf = socket.read()) !== null)
      this.ssl.receive(buf);
  }
};

TLSSocket.prototype.renegotiate = function(options, callback) {
  var requestCert = this._requestCert,
      rejectUnauthorized = this._rejectUnauthorized;

  if (typeof options.requestCert !== 'undefined')
    requestCert = !!options.requestCert;
  if (typeof options.rejectUnauthorized !== 'undefined')
    rejectUnauthorized = !!options.rejectUnauthorized;

  if (requestCert !== this._requestCert ||
      rejectUnauthorized !== this._rejectUnauthorized) {
    this.ssl.setVerifyMode(requestCert, rejectUnauthorized);
    this._requestCert = requestCert;
    this._rejectUnauthorized = rejectUnauthorized;
  }
  if (!this.ssl.renegotiate()) {
    if (callback) {
      process.nextTick(function() {
        callback(new Error('Failed to renegotiate'));
      });
    }
    return false;
  }

  
  this.write('');

  if (callback) {
    this.once('secure', function() {
      callback(null);
    });
  }

  return true;
};

TLSSocket.prototype.setMaxSendFragment = function setMaxSendFragment(size) {
  return this.ssl.setMaxSendFragment(size) == 1;
};

TLSSocket.prototype.getTLSTicket = function getTLSTicket() {
  return this.ssl.getTLSTicket();
};

TLSSocket.prototype._handleTimeout = function() {
  this._tlsError(new Error('TLS handshake timeout'));
};

TLSSocket.prototype._tlsError = function(err) {
  this.emit('_tlsError', err);
  if (this._controlReleased)
    this.emit('error', err);
};

TLSSocket.prototype._releaseControl = function() {
  if (this._controlReleased)
    return false;
  this._controlReleased = true;
  this.removeListener('error', this._tlsError);
  return true;
};

TLSSocket.prototype._finishInit = function() {
  
  if (this._newSessionPending) {
    this._securePending = true;
    return;
  }

  if (process.features.tls_npn) {
    this.npnProtocol = this.ssl.getNegotiatedProtocol();
  }

  if (process.features.tls_sni && this._tlsOptions.isServer) {
    this.servername = this.ssl.getServername();
  }

  
  this._secureEstablished = true;
  if (this._tlsOptions.handshakeTimeout > 0)
    this.setTimeout(0, this._handleTimeout);
  this.emit('secure');
};

TLSSocket.prototype._start = function() {
  if (this._tlsOptions.requestOCSP)
    this.ssl.requestOCSP();
  this.ssl.start();
};

TLSSocket.prototype.setServername = function(name) {
  this.ssl.setServername(name);
};

TLSSocket.prototype.setSession = function(session) {
  if (util.isString(session))
    session = new Buffer(session, 'binary');
  this.ssl.setSession(session);
};

TLSSocket.prototype.getPeerCertificate = function(detailed) {
  if (this.ssl) {
    return common.translatePeerCertificate(
        this.ssl.getPeerCertificate(detailed));
  }

  return null;
};

TLSSocket.prototype.getSession = function() {
  if (this.ssl) {
    return this.ssl.getSession();
  }

  return null;
};

TLSSocket.prototype.isSessionReused = function() {
  if (this.ssl) {
    return this.ssl.isSessionReused();
  }

  return null;
};

TLSSocket.prototype.getCipher = function(err) {
  if (this.ssl) {
    return this.ssl.getCurrentCipher();
  } else {
    return null;
  }
};




































































function Server() {
  var options, listener;
  if (util.isObject(arguments[0])) {
    options = arguments[0];
    listener = arguments[1];
  } else if (util.isFunction(arguments[0])) {
    options = {};
    listener = arguments[0];
  }

  if (!(this instanceof Server)) return new Server(options, listener);

  this._contexts = [];

  var self = this;

  
  this.setOptions(options);

  var sharedCreds = tls.createSecureContext({
    pfx: self.pfx,
    key: self.key,
    passphrase: self.passphrase,
    cert: self.cert,
    ca: self.ca,
    ciphers: self.ciphers,
    ecdhCurve: self.ecdhCurve,
    dhparam: self.dhparam,
    secureProtocol: self.secureProtocol,
    secureOptions: self.secureOptions,
    honorCipherOrder: self.honorCipherOrder,
    crl: self.crl,
    sessionIdContext: self.sessionIdContext
  });
  this._sharedCreds = sharedCreds;

  var timeout = options.handshakeTimeout || (120 * 1000);

  if (!util.isNumber(timeout)) {
    throw new TypeError('handshakeTimeout must be a number');
  }

  if (self.sessionTimeout) {
    sharedCreds.context.setSessionTimeout(self.sessionTimeout);
  }

  if (self.ticketKeys) {
    sharedCreds.context.setTicketKeys(self.ticketKeys);
  }

  
  net.Server.call(this, function(raw_socket) {
    var socket = new TLSSocket(raw_socket, {
      secureContext: sharedCreds,
      isServer: true,
      server: self,
      requestCert: self.requestCert,
      rejectUnauthorized: self.rejectUnauthorized,
      handshakeTimeout: timeout,
      NPNProtocols: self.NPNProtocols,
      SNICallback: options.SNICallback || SNICallback
    });

    socket.on('secure', function() {
      if (socket._requestCert) {
        var verifyError = socket.ssl.verifyError();
        if (verifyError) {
          socket.authorizationError = verifyError.code;

          if (socket._rejectUnauthorized)
            socket.destroy();
        } else {
          socket.authorized = true;
        }
      }

      if (!socket.destroyed && socket._releaseControl())
        self.emit('secureConnection', socket);
    });

    var errorEmitted = false;
    socket.on('close', function() {
      
      if (!socket._controlReleased && !errorEmitted) {
        errorEmitted = true;
        var connReset = new Error('socket hang up');
        connReset.code = 'ECONNRESET';
        self.emit('clientError', connReset, socket);
      }
    });

    socket.on('_tlsError', function(err) {
      if (!socket._controlReleased && !errorEmitted) {
        errorEmitted = true;
        self.emit('clientError', err, socket);
      }
    });
  });

  if (listener) {
    this.on('secureConnection', listener);
  }
}

util.inherits(Server, net.Server);
exports.Server = Server;
exports.createServer = function(options, listener) {
  return new Server(options, listener);
};


Server.prototype._getServerData = function() {
  return {
    ticketKeys: this._sharedCreds.context.getTicketKeys().toString('hex')
  };
};


Server.prototype._setServerData = function(data) {
  this._sharedCreds.context.setTicketKeys(new Buffer(data.ticketKeys, 'hex'));
};


Server.prototype.setOptions = function(options) {
  if (util.isBoolean(options.requestCert)) {
    this.requestCert = options.requestCert;
  } else {
    this.requestCert = false;
  }

  if (util.isBoolean(options.rejectUnauthorized)) {
    this.rejectUnauthorized = options.rejectUnauthorized;
  } else {
    this.rejectUnauthorized = false;
  }

  if (options.pfx) this.pfx = options.pfx;
  if (options.key) this.key = options.key;
  if (options.passphrase) this.passphrase = options.passphrase;
  if (options.cert) this.cert = options.cert;
  if (options.ca) this.ca = options.ca;
  if (options.secureProtocol) this.secureProtocol = options.secureProtocol;
  if (options.crl) this.crl = options.crl;
  if (options.ciphers) this.ciphers = options.ciphers;
  if (!util.isUndefined(options.ecdhCurve))
    this.ecdhCurve = options.ecdhCurve;
  if (options.dhparam) this.dhparam = options.dhparam;
  if (options.sessionTimeout) this.sessionTimeout = options.sessionTimeout;
  if (options.ticketKeys) this.ticketKeys = options.ticketKeys;
  var secureOptions = options.secureOptions || 0;
  if (options.honorCipherOrder)
    this.honorCipherOrder = true;
  else
    this.honorCipherOrder = false;
  if (secureOptions) this.secureOptions = secureOptions;
  if (options.NPNProtocols) tls.convertNPNProtocols(options.NPNProtocols, this);
  if (options.sessionIdContext) {
    this.sessionIdContext = options.sessionIdContext;
  } else {
    this.sessionIdContext = crypto.createHash('md5')
                                  .update(process.argv.join(' '))
                                  .digest('hex');
  }
};


Server.prototype.addContext = function(servername, context) {
  if (!servername) {
    throw new Error('Servername is required parameter for Server.addContext');
  }

  var re = new RegExp('^' +
                      servername.replace(/([\.^$+?\-\\[\]{}])/g, '\\$1')
                                .replace(/\*/g, '[^\.]*') +
                      '$');
  this._contexts.push([re, tls.createSecureContext(context).context]);
};

function SNICallback(servername, callback) {
  var ctx;

  this.server._contexts.some(function(elem) {
    if (!util.isNull(servername.match(elem[0]))) {
      ctx = elem[1];
      return true;
    }
  });

  callback(null, ctx);
}
















function normalizeConnectArgs(listArgs) {
  var args = net._normalizeConnectArgs(listArgs);
  var options = args[0];
  var cb = args[1];

  if (util.isObject(listArgs[1])) {
    options = util._extend(options, listArgs[1]);
  } else if (util.isObject(listArgs[2])) {
    options = util._extend(options, listArgs[2]);
  }

  return (cb) ? [options, cb] : [options];
}

function legacyConnect(hostname, options, NPN, context) {
  assert(options.socket);
  if (!tls_legacy)
    tls_legacy = require('_tls_legacy');

  var pair = tls_legacy.createSecurePair(context,
                                         false,
                                         true,
                                         !!options.rejectUnauthorized,
                                         {
                                           NPNProtocols: NPN.NPNProtocols,
                                           servername: hostname
                                         });
  tls_legacy.pipe(pair, options.socket);
  pair.cleartext._controlReleased = true;
  pair.on('error', function(err) {
    pair.cleartext.emit('error', err);
  });

  return pair;
}

exports.connect = function() {
  var args = normalizeConnectArgs(arguments);
  var options = args[0];
  var cb = args[1];

  var defaults = {
    rejectUnauthorized: '0',
    ciphers: tls.DEFAULT_CIPHERS,
    checkServerIdentity: tls.checkServerIdentity
  };

  options = util._extend(defaults, options || {});

  assert(typeof options.checkServerIdentity === 'function');

  var hostname = options.servername ||
                 options.host ||
                 options.socket && options.socket._host,
      NPN = {},
      context = tls.createSecureContext(options);
  tls.convertNPNProtocols(options.NPNProtocols, NPN);

  
  
  var socket;
  var legacy;
  var result;
  if (options.socket instanceof TLSSocket) {
    
    legacy = true;
    socket = legacyConnect(hostname, options, NPN, context);
    result = socket.cleartext;
  } else {
    legacy = false;
    socket = new TLSSocket(options.socket, {
      secureContext: context,
      isServer: false,
      requestCert: true,
      rejectUnauthorized: options.rejectUnauthorized,
      session: options.session,
      NPNProtocols: NPN.NPNProtocols,
      requestOCSP: options.requestOCSP
    });
    result = socket;
  }

  if (socket._handle && !socket._connecting) {
    onHandle();
  } else {
    
    
    if (!legacy && options.socket) {
      options.socket.once('connect', function() {
        assert(options.socket._handle);
        socket._handle = options.socket._handle;
        socket._handle.owner = socket;
        socket.emit('connect');
      });
    }
    socket.once('connect', onHandle);
  }

  if (cb)
    result.once('secureConnect', cb);

  if (!options.socket) {
    assert(!legacy);
    var connect_opt;
    if (options.path && !options.port) {
      connect_opt = { path: options.path };
    } else {
      connect_opt = {
        port: options.port,
        host: options.host,
        localAddress: options.localAddress
      };
    }
    socket.connect(connect_opt);
  }

  return result;

  function onHandle() {
    if (!legacy)
      socket._releaseControl();

    if (options.session)
      socket.setSession(options.session);

    if (!legacy) {
      if (options.servername)
        socket.setServername(options.servername);

      socket._start();
    }
    socket.on('secure', function() {
      var verifyError = socket.ssl.verifyError();

      
      if (!verifyError) {
        var cert = result.getPeerCertificate();
        verifyError = options.checkServerIdentity(hostname, cert);
      }

      if (verifyError) {
        result.authorized = false;
        result.authorizationError = verifyError.code || verifyError.message;

        if (options.rejectUnauthorized) {
          result.emit('error', verifyError);
          result.destroy();
          return;
        } else {
          result.emit('secureConnect');
        }
      } else {
        result.authorized = true;
        result.emit('secureConnect');
      }

      
      result.removeListener('end', onHangUp);
    });

    function onHangUp() {
      
      if (!socket._hadError) {
        socket._hadError = true;
        var error = new Error('socket hang up');
        error.code = 'ECONNRESET';
        socket.destroy();
        socket.emit('error', error);
      }
    }
    result.once('end', onHangUp);
  }
};
