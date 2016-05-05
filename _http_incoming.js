




















var util = require('util');
var Stream = require('stream');

function readStart(socket) {
  if (socket && !socket._paused && socket.readable)
    socket.resume();
}
exports.readStart = readStart;

function readStop(socket) {
  if (socket)
    socket.pause();
}
exports.readStop = readStop;



function IncomingMessage(socket) {
  Stream.Readable.call(this);

  
  
  

  this.socket = socket;
  this.connection = socket;

  this.httpVersionMajor = null;
  this.httpVersionMinor = null;
  this.httpVersion = null;
  this.complete = false;
  this.headers = {};
  this.rawHeaders = [];
  this.trailers = {};
  this.rawTrailers = [];

  this.readable = true;

  this._pendings = [];
  this._pendingIndex = 0;
  this.upgrade = null;

  
  this.url = '';
  this.method = null;

  
  this.statusCode = null;
  this.statusMessage = null;
  this.client = this.socket;

  
  this._consuming = false;

  
  
  this._dumped = false;
}
util.inherits(IncomingMessage, Stream.Readable);


exports.IncomingMessage = IncomingMessage;


IncomingMessage.prototype.setTimeout = function(msecs, callback) {
  if (callback)
    this.on('timeout', callback);
  this.socket.setTimeout(msecs);
};


IncomingMessage.prototype.read = function(n) {
  this._consuming = true;
  this.read = Stream.Readable.prototype.read;
  return this.read(n);
};


IncomingMessage.prototype._read = function(n) {
  
  
  
  if (this.socket.readable)
    readStart(this.socket);
};





IncomingMessage.prototype.destroy = function(error) {
  if (this.socket)
    this.socket.destroy(error);
};


IncomingMessage.prototype._addHeaderLines = function(headers, n) {
  if (headers && headers.length) {
    var raw, dest;
    if (this.complete) {
      raw = this.rawTrailers;
      dest = this.trailers;
    } else {
      raw = this.rawHeaders;
      dest = this.headers;
    }
    raw.push.apply(raw, headers);

    for (var i = 0; i < n; i += 2) {
      var k = headers[i];
      var v = headers[i + 1];
      this._addHeaderLine(k, v, dest);
    }
  }
};









IncomingMessage.prototype._addHeaderLine = function(field, value, dest) {
  field = field.toLowerCase();
  switch (field) {
    
    case 'set-cookie':
      if (!util.isUndefined(dest[field])) {
        dest[field].push(value);
      } else {
        dest[field] = [value];
      }
      break;

    
    
    case 'content-type':
    case 'content-length':
    case 'user-agent':
    case 'referer':
    case 'host':
    case 'authorization':
    case 'proxy-authorization':
    case 'if-modified-since':
    case 'if-unmodified-since':
    case 'from':
    case 'location':
    case 'max-forwards':
      
      if (util.isUndefined(dest[field]))
        dest[field] = value;
      break;

    default:
      
      if (!util.isUndefined(dest[field]))
        dest[field] += ', ' + value;
      else {
        dest[field] = value;
      }
  }
};




IncomingMessage.prototype._dump = function() {
  if (!this._dumped) {
    this._dumped = true;
    this.resume();
  }
};
