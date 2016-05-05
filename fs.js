


























var util = require('util');
var pathModule = require('path');

var binding = process.binding('fs');
var constants = process.binding('constants');
var fs = exports;
var Stream = require('stream').Stream;
var EventEmitter = require('events').EventEmitter;

var Readable = Stream.Readable;
var Writable = Stream.Writable;

var kMinPoolSpace = 128;
var kMaxLength = require('smalloc').kMaxLength;

var O_APPEND = constants.O_APPEND || 0;
var O_CREAT = constants.O_CREAT || 0;
var O_EXCL = constants.O_EXCL || 0;
var O_RDONLY = constants.O_RDONLY || 0;
var O_RDWR = constants.O_RDWR || 0;
var O_SYNC = constants.O_SYNC || 0;
var O_TRUNC = constants.O_TRUNC || 0;
var O_WRONLY = constants.O_WRONLY || 0;

var isWindows = process.platform === 'win32';

var DEBUG = process.env.NODE_DEBUG && /fs/.test(process.env.NODE_DEBUG);
var errnoException = util._errnoException;


function rethrow() {
  
  
  if (DEBUG) {
    var backtrace = new Error;
    return function(err) {
      if (err) {
        backtrace.stack = err.name + ': ' + err.message +
                          backtrace.stack.substr(backtrace.name.length);
        err = backtrace;
        throw err;
      }
    };
  }

  return function(err) {
    if (err) {
      throw err;  
    }
  };
}

function maybeCallback(cb) {
  return util.isFunction(cb) ? cb : rethrow();
}




function makeCallback(cb) {
  if (!util.isFunction(cb)) {
    return rethrow();
  }

  return function() {
    return cb.apply(null, arguments);
  };
}

function assertEncoding(encoding) {
  if (encoding && !Buffer.isEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

function nullCheck(path, callback) {
  if (('' + path).indexOf('\u0000') !== -1) {
    var er = new Error('Path must be a string without null bytes.');
    if (!callback)
      throw er;
    process.nextTick(function() {
      callback(er);
    });
    return false;
  }
  return true;
}


fs.Stats = function(
    dev,
    mode,
    nlink,
    uid,
    gid,
    rdev,
    blksize,
    ino,
    size,
    blocks,
    atim_msec,
    mtim_msec,
    ctim_msec,
    birthtim_msec) {
  this.dev = dev;
  this.mode = mode;
  this.nlink = nlink;
  this.uid = uid;
  this.gid = gid;
  this.rdev = rdev;
  this.blksize = blksize;
  this.ino = ino;
  this.size = size;
  this.blocks = blocks;
  this.atime = new Date(atim_msec);
  this.mtime = new Date(mtim_msec);
  this.ctime = new Date(ctim_msec);
  this.birthtime = new Date(birthtim_msec);
};


binding.FSInitialize(fs.Stats);

fs.Stats.prototype._checkModeProperty = function(property) {
  return ((this.mode & constants.S_IFMT) === property);
};

fs.Stats.prototype.isDirectory = function() {
  return this._checkModeProperty(constants.S_IFDIR);
};

fs.Stats.prototype.isFile = function() {
  return this._checkModeProperty(constants.S_IFREG);
};

fs.Stats.prototype.isBlockDevice = function() {
  return this._checkModeProperty(constants.S_IFBLK);
};

fs.Stats.prototype.isCharacterDevice = function() {
  return this._checkModeProperty(constants.S_IFCHR);
};

fs.Stats.prototype.isSymbolicLink = function() {
  return this._checkModeProperty(constants.S_IFLNK);
};

fs.Stats.prototype.isFIFO = function() {
  return this._checkModeProperty(constants.S_IFIFO);
};

fs.Stats.prototype.isSocket = function() {
  return this._checkModeProperty(constants.S_IFSOCK);
};

fs.exists = function(path, callback) {
  if (!nullCheck(path, cb)) return;
  binding.stat(pathModule._makeLong(path), cb);
  function cb(err, stats) {
    if (callback) callback(err ? false : true);
  }
};

fs.existsSync = function(path) {
  try {
    nullCheck(path);
    binding.stat(pathModule._makeLong(path));
    return true;
  } catch (e) {
    return false;
  }
};

fs.readFile = function(path, options, callback_) {
  var callback = maybeCallback(arguments[arguments.length - 1]);

  if (util.isFunction(options) || !options) {
    options = { encoding: null, flag: 'r' };
  } else if (util.isString(options)) {
    options = { encoding: options, flag: 'r' };
  } else if (!util.isObject(options)) {
    throw new TypeError('Bad arguments');
  }

  var encoding = options.encoding;
  assertEncoding(encoding);

  
  var size;
  var buffer; 
  var buffers; 
  var pos = 0;
  var fd;

  var flag = options.flag || 'r';
  fs.open(path, flag, 438 , function(er, fd_) {
    if (er) return callback(er);
    fd = fd_;

    fs.fstat(fd, function(er, st) {
      if (er) {
        return fs.close(fd, function() {
          callback(er);
        });
      }

      size = st.size;
      if (size === 0) {
        
        
        buffers = [];
        return read();
      }

      if (size > kMaxLength) {
        var err = new RangeError('File size is greater than possible Buffer: ' +
            '0x3FFFFFFF bytes');
        return fs.close(fd, function() {
          callback(err);
        });
      }
      buffer = new Buffer(size);
      read();
    });
  });

  function read() {
    if (size === 0) {
      buffer = new Buffer(8192);
      fs.read(fd, buffer, 0, 8192, -1, afterRead);
    } else {
      fs.read(fd, buffer, pos, size - pos, -1, afterRead);
    }
  }

  function afterRead(er, bytesRead) {
    if (er) {
      return fs.close(fd, function(er2) {
        return callback(er);
      });
    }

    if (bytesRead === 0) {
      return close();
    }

    pos += bytesRead;
    if (size !== 0) {
      if (pos === size) close();
      else read();
    } else {
      
      buffers.push(buffer.slice(0, bytesRead));
      read();
    }
  }

  function close() {
    fs.close(fd, function(er) {
      if (size === 0) {
        
        buffer = Buffer.concat(buffers, pos);
      } else if (pos < size) {
        buffer = buffer.slice(0, pos);
      }

      if (encoding) buffer = buffer.toString(encoding);
      return callback(er, buffer);
    });
  }
};

fs.readFileSync = function(path, options) {
  if (!options) {
    options = { encoding: null, flag: 'r' };
  } else if (util.isString(options)) {
    options = { encoding: options, flag: 'r' };
  } else if (!util.isObject(options)) {
    throw new TypeError('Bad arguments');
  }

  var encoding = options.encoding;
  assertEncoding(encoding);

  var flag = options.flag || 'r';
  var fd = fs.openSync(path, flag, 438 );

  var size;
  var threw = true;
  try {
    size = fs.fstatSync(fd).size;
    threw = false;
  } finally {
    if (threw) fs.closeSync(fd);
  }

  var pos = 0;
  var buffer; 
  var buffers; 

  if (size === 0) {
    buffers = [];
  } else {
    var threw = true;
    try {
      buffer = new Buffer(size);
      threw = false;
    } finally {
      if (threw) fs.closeSync(fd);
    }
  }

  var done = false;
  while (!done) {
    var threw = true;
    try {
      if (size !== 0) {
        var bytesRead = fs.readSync(fd, buffer, pos, size - pos);
      } else {
        
        
        buffer = new Buffer(8192);
        var bytesRead = fs.readSync(fd, buffer, 0, 8192);
        if (bytesRead) {
          buffers.push(buffer.slice(0, bytesRead));
        }
      }
      threw = false;
    } finally {
      if (threw) fs.closeSync(fd);
    }

    pos += bytesRead;
    done = (bytesRead === 0) || (size !== 0 && pos >= size);
  }

  fs.closeSync(fd);

  if (size === 0) {
    
    buffer = Buffer.concat(buffers, pos);
  } else if (pos < size) {
    buffer = buffer.slice(0, pos);
  }

  if (encoding) buffer = buffer.toString(encoding);
  return buffer;
};



function stringToFlags(flag) {
  
  if (!util.isString(flag)) {
    return flag;
  }

  switch (flag) {
    case 'r' : return O_RDONLY;
    case 'rs' : 
    case 'sr' : return O_RDONLY | O_SYNC;
    case 'r+' : return O_RDWR;
    case 'rs+' : 
    case 'sr+' : return O_RDWR | O_SYNC;

    case 'w' : return O_TRUNC | O_CREAT | O_WRONLY;
    case 'wx' : 
    case 'xw' : return O_TRUNC | O_CREAT | O_WRONLY | O_EXCL;

    case 'w+' : return O_TRUNC | O_CREAT | O_RDWR;
    case 'wx+': 
    case 'xw+': return O_TRUNC | O_CREAT | O_RDWR | O_EXCL;

    case 'a' : return O_APPEND | O_CREAT | O_WRONLY;
    case 'ax' : 
    case 'xa' : return O_APPEND | O_CREAT | O_WRONLY | O_EXCL;

    case 'a+' : return O_APPEND | O_CREAT | O_RDWR;
    case 'ax+': 
    case 'xa+': return O_APPEND | O_CREAT | O_RDWR | O_EXCL;
  }

  throw new Error('Unknown file open flag: ' + flag);
}


Object.defineProperty(exports, '_stringToFlags', {
  enumerable: false,
  value: stringToFlags
});





fs.close = function(fd, callback) {
  binding.close(fd, makeCallback(callback));
};

fs.closeSync = function(fd) {
  return binding.close(fd);
};

function modeNum(m, def) {
  if (util.isNumber(m))
    return m;
  if (util.isString(m))
    return parseInt(m, 8);
  if (def)
    return modeNum(def);
  return undefined;
}

fs.open = function(path, flags, mode, callback) {
  callback = makeCallback(arguments[arguments.length - 1]);
  mode = modeNum(mode, 438 );

  if (!nullCheck(path, callback)) return;
  binding.open(pathModule._makeLong(path),
               stringToFlags(flags),
               mode,
               callback);
};

fs.openSync = function(path, flags, mode) {
  mode = modeNum(mode, 438 );
  nullCheck(path);
  return binding.open(pathModule._makeLong(path), stringToFlags(flags), mode);
};

fs.read = function(fd, buffer, offset, length, position, callback) {
  if (!util.isBuffer(buffer)) {
    
    var cb = arguments[4],
        encoding = arguments[3];

    assertEncoding(encoding);

    position = arguments[2];
    length = arguments[1];
    buffer = new Buffer(length);
    offset = 0;

    callback = function(err, bytesRead) {
      if (!cb) return;

      var str = (bytesRead > 0) ? buffer.toString(encoding, 0, bytesRead) : '';

      (cb)(err, str, bytesRead);
    };
  }

  function wrapper(err, bytesRead) {
    
    callback && callback(err, bytesRead || 0, buffer);
  }

  binding.read(fd, buffer, offset, length, position, wrapper);
};

fs.readSync = function(fd, buffer, offset, length, position) {
  var legacy = false;
  if (!util.isBuffer(buffer)) {
    
    legacy = true;
    var encoding = arguments[3];

    assertEncoding(encoding);

    position = arguments[2];
    length = arguments[1];
    buffer = new Buffer(length);

    offset = 0;
  }

  var r = binding.read(fd, buffer, offset, length, position);
  if (!legacy) {
    return r;
  }

  var str = (r > 0) ? buffer.toString(encoding, 0, r) : '';
  return [str, r];
};





fs.write = function(fd, buffer, offset, length, position, callback) {
  if (util.isBuffer(buffer)) {
    
    if (util.isFunction(position)) {
      callback = position;
      position = null;
    }
    callback = maybeCallback(callback);
    var wrapper = function(err, written) {
      
      callback(err, written || 0, buffer);
    };
    return binding.writeBuffer(fd, buffer, offset, length, position, wrapper);
  }

  if (util.isString(buffer))
    buffer += '';
  if (!util.isFunction(position)) {
    if (util.isFunction(offset)) {
      position = offset;
      offset = null;
    } else {
      position = length;
    }
    length = 'utf8';
  }
  callback = maybeCallback(position);
  position = function(err, written) {
    
    callback(err, written || 0, buffer);
  };
  return binding.writeString(fd, buffer, offset, length, position);
};





fs.writeSync = function(fd, buffer, offset, length, position) {
  if (util.isBuffer(buffer)) {
    if (util.isUndefined(position))
      position = null;
    return binding.writeBuffer(fd, buffer, offset, length, position);
  }
  if (!util.isString(buffer))
    buffer += '';
  if (util.isUndefined(offset))
    offset = null;
  return binding.writeString(fd, buffer, offset, length, position);
};

fs.rename = function(oldPath, newPath, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(oldPath, callback)) return;
  if (!nullCheck(newPath, callback)) return;
  binding.rename(pathModule._makeLong(oldPath),
                 pathModule._makeLong(newPath),
                 callback);
};

fs.renameSync = function(oldPath, newPath) {
  nullCheck(oldPath);
  nullCheck(newPath);
  return binding.rename(pathModule._makeLong(oldPath),
                        pathModule._makeLong(newPath));
};

fs.truncate = function(path, len, callback) {
  if (util.isNumber(path)) {
    
    return fs.ftruncate(path, len, callback);
  }
  if (util.isFunction(len)) {
    callback = len;
    len = 0;
  } else if (util.isUndefined(len)) {
    len = 0;
  }
  callback = maybeCallback(callback);
  fs.open(path, 'r+', function(er, fd) {
    if (er) return callback(er);
    binding.ftruncate(fd, len, function(er) {
      fs.close(fd, function(er2) {
        callback(er || er2);
      });
    });
  });
};

fs.truncateSync = function(path, len) {
  if (util.isNumber(path)) {
    
    return fs.ftruncateSync(path, len);
  }
  if (util.isUndefined(len)) {
    len = 0;
  }
  
  var fd = fs.openSync(path, 'r+');
  try {
    var ret = fs.ftruncateSync(fd, len);
  } finally {
    fs.closeSync(fd);
  }
  return ret;
};

fs.ftruncate = function(fd, len, callback) {
  if (util.isFunction(len)) {
    callback = len;
    len = 0;
  } else if (util.isUndefined(len)) {
    len = 0;
  }
  binding.ftruncate(fd, len, makeCallback(callback));
};

fs.ftruncateSync = function(fd, len) {
  if (util.isUndefined(len)) {
    len = 0;
  }
  return binding.ftruncate(fd, len);
};

fs.rmdir = function(path, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.rmdir(pathModule._makeLong(path), callback);
};

fs.rmdirSync = function(path) {
  nullCheck(path);
  return binding.rmdir(pathModule._makeLong(path));
};

fs.fdatasync = function(fd, callback) {
  binding.fdatasync(fd, makeCallback(callback));
};

fs.fdatasyncSync = function(fd) {
  return binding.fdatasync(fd);
};

fs.fsync = function(fd, callback) {
  binding.fsync(fd, makeCallback(callback));
};

fs.fsyncSync = function(fd) {
  return binding.fsync(fd);
};

fs.mkdir = function(path, mode, callback) {
  if (util.isFunction(mode)) callback = mode;
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.mkdir(pathModule._makeLong(path),
                modeNum(mode, 511 ),
                callback);
};

fs.mkdirSync = function(path, mode) {
  nullCheck(path);
  return binding.mkdir(pathModule._makeLong(path),
                       modeNum(mode, 511 ));
};

fs.readdir = function(path, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.readdir(pathModule._makeLong(path), callback);
};

fs.readdirSync = function(path) {
  nullCheck(path);
  return binding.readdir(pathModule._makeLong(path));
};

fs.fstat = function(fd, callback) {
  binding.fstat(fd, makeCallback(callback));
};

fs.lstat = function(path, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.lstat(pathModule._makeLong(path), callback);
};

fs.stat = function(path, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.stat(pathModule._makeLong(path), callback);
};

fs.fstatSync = function(fd) {
  return binding.fstat(fd);
};

fs.lstatSync = function(path) {
  nullCheck(path);
  return binding.lstat(pathModule._makeLong(path));
};

fs.statSync = function(path) {
  nullCheck(path);
  return binding.stat(pathModule._makeLong(path));
};

fs.readlink = function(path, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.readlink(pathModule._makeLong(path), callback);
};

fs.readlinkSync = function(path) {
  nullCheck(path);
  return binding.readlink(pathModule._makeLong(path));
};

function preprocessSymlinkDestination(path, type) {
  if (!isWindows) {
    
    return path;
  } else if (type === 'junction') {
    
    return pathModule._makeLong(path);
  } else {
    
    return ('' + path).replace(/\//g, '\\');
  }
}

fs.symlink = function(destination, path, type_, callback) {
  var type = (util.isString(type_) ? type_ : null);
  var callback = makeCallback(arguments[arguments.length - 1]);

  if (!nullCheck(destination, callback)) return;
  if (!nullCheck(path, callback)) return;

  binding.symlink(preprocessSymlinkDestination(destination, type),
                  pathModule._makeLong(path),
                  type,
                  callback);
};

fs.symlinkSync = function(destination, path, type) {
  type = (util.isString(type) ? type : null);

  nullCheck(destination);
  nullCheck(path);

  return binding.symlink(preprocessSymlinkDestination(destination, type),
                         pathModule._makeLong(path),
                         type);
};

fs.link = function(srcpath, dstpath, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(srcpath, callback)) return;
  if (!nullCheck(dstpath, callback)) return;

  binding.link(pathModule._makeLong(srcpath),
               pathModule._makeLong(dstpath),
               callback);
};

fs.linkSync = function(srcpath, dstpath) {
  nullCheck(srcpath);
  nullCheck(dstpath);
  return binding.link(pathModule._makeLong(srcpath),
                      pathModule._makeLong(dstpath));
};

fs.unlink = function(path, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.unlink(pathModule._makeLong(path), callback);
};

fs.unlinkSync = function(path) {
  nullCheck(path);
  return binding.unlink(pathModule._makeLong(path));
};

fs.fchmod = function(fd, mode, callback) {
  binding.fchmod(fd, modeNum(mode), makeCallback(callback));
};

fs.fchmodSync = function(fd, mode) {
  return binding.fchmod(fd, modeNum(mode));
};

if (constants.hasOwnProperty('O_SYMLINK')) {
  fs.lchmod = function(path, mode, callback) {
    callback = maybeCallback(callback);
    fs.open(path, constants.O_WRONLY | constants.O_SYMLINK, function(err, fd) {
      if (err) {
        callback(err);
        return;
      }
      
      
      fs.fchmod(fd, mode, function(err) {
        fs.close(fd, function(err2) {
          callback(err || err2);
        });
      });
    });
  };

  fs.lchmodSync = function(path, mode) {
    var fd = fs.openSync(path, constants.O_WRONLY | constants.O_SYMLINK);

    
    
    var err, err2;
    try {
      var ret = fs.fchmodSync(fd, mode);
    } catch (er) {
      err = er;
    }
    try {
      fs.closeSync(fd);
    } catch (er) {
      err2 = er;
    }
    if (err || err2) throw (err || err2);
    return ret;
  };
}


fs.chmod = function(path, mode, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.chmod(pathModule._makeLong(path),
                modeNum(mode),
                callback);
};

fs.chmodSync = function(path, mode) {
  nullCheck(path);
  return binding.chmod(pathModule._makeLong(path), modeNum(mode));
};

if (constants.hasOwnProperty('O_SYMLINK')) {
  fs.lchown = function(path, uid, gid, callback) {
    callback = maybeCallback(callback);
    fs.open(path, constants.O_WRONLY | constants.O_SYMLINK, function(err, fd) {
      if (err) {
        callback(err);
        return;
      }
      fs.fchown(fd, uid, gid, callback);
    });
  };

  fs.lchownSync = function(path, uid, gid) {
    var fd = fs.openSync(path, constants.O_WRONLY | constants.O_SYMLINK);
    return fs.fchownSync(fd, uid, gid);
  };
}

fs.fchown = function(fd, uid, gid, callback) {
  binding.fchown(fd, uid, gid, makeCallback(callback));
};

fs.fchownSync = function(fd, uid, gid) {
  return binding.fchown(fd, uid, gid);
};

fs.chown = function(path, uid, gid, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.chown(pathModule._makeLong(path), uid, gid, callback);
};

fs.chownSync = function(path, uid, gid) {
  nullCheck(path);
  return binding.chown(pathModule._makeLong(path), uid, gid);
};


function toUnixTimestamp(time) {
  if (util.isNumber(time)) {
    return time;
  }
  if (util.isDate(time)) {
    
    return time.getTime() / 1000;
  }
  throw new Error('Cannot parse time: ' + time);
}

// exported for unit tests, not for public consumption
fs._toUnixTimestamp = toUnixTimestamp;

fs.utimes = function(path, atime, mtime, callback) {
  callback = makeCallback(callback);
  if (!nullCheck(path, callback)) return;
  binding.utimes(pathModule._makeLong(path),
                 toUnixTimestamp(atime),
                 toUnixTimestamp(mtime),
                 callback);
};

fs.utimesSync = function(path, atime, mtime) {
  nullCheck(path);
  atime = toUnixTimestamp(atime);
  mtime = toUnixTimestamp(mtime);
  binding.utimes(pathModule._makeLong(path), atime, mtime);
};

fs.futimes = function(fd, atime, mtime, callback) {
  atime = toUnixTimestamp(atime);
  mtime = toUnixTimestamp(mtime);
  binding.futimes(fd, atime, mtime, makeCallback(callback));
};

fs.futimesSync = function(fd, atime, mtime) {
  atime = toUnixTimestamp(atime);
  mtime = toUnixTimestamp(mtime);
  binding.futimes(fd, atime, mtime);
};

function writeAll(fd, buffer, offset, length, position, callback) {
  callback = maybeCallback(arguments[arguments.length - 1]);

  // write(fd, buffer, offset, length, position, callback)
  fs.write(fd, buffer, offset, length, position, function(writeErr, written) {
    if (writeErr) {
      fs.close(fd, function() {
        if (callback) callback(writeErr);
      });
    } else {
      if (written === length) {
        fs.close(fd, callback);
      } else {
        offset += written;
        length -= written;
        position += written;
        writeAll(fd, buffer, offset, length, position, callback);
      }
    }
  });
}

fs.writeFile = function(path, data, options, callback) {
  var callback = maybeCallback(arguments[arguments.length - 1]);

  if (util.isFunction(options) || !options) {
    options = { encoding: 'utf8', mode: 438 /*=0666*/, flag: 'w' };
  } else if (util.isString(options)) {
    options = { encoding: options, mode: 438, flag: 'w' };
  } else if (!util.isObject(options)) {
    throw new TypeError('Bad arguments');
  }

  assertEncoding(options.encoding);

  var flag = options.flag || 'w';
  fs.open(path, flag, options.mode, function(openErr, fd) {
    if (openErr) {
      if (callback) callback(openErr);
    } else {
      var buffer = util.isBuffer(data) ? data : new Buffer('' + data,
          options.encoding || 'utf8');
      var position = /a/.test(flag) ? null : 0;
      writeAll(fd, buffer, 0, buffer.length, position, callback);
    }
  });
};

fs.writeFileSync = function(path, data, options) {
  if (!options) {
    options = { encoding: 'utf8', mode: 438 /*=0666*/, flag: 'w' };
  } else if (util.isString(options)) {
    options = { encoding: options, mode: 438, flag: 'w' };
  } else if (!util.isObject(options)) {
    throw new TypeError('Bad arguments');
  }

  assertEncoding(options.encoding);

  var flag = options.flag || 'w';
  var fd = fs.openSync(path, flag, options.mode);
  if (!util.isBuffer(data)) {
    data = new Buffer('' + data, options.encoding || 'utf8');
  }
  var written = 0;
  var length = data.length;
  var position = /a/.test(flag) ? null : 0;
  try {
    while (written < length) {
      written += fs.writeSync(fd, data, written, length - written, position);
      position += written;
    }
  } finally {
    fs.closeSync(fd);
  }
};

fs.appendFile = function(path, data, options, callback_) {
  var callback = maybeCallback(arguments[arguments.length - 1]);

  if (util.isFunction(options) || !options) {
    options = { encoding: 'utf8', mode: 438 /*=0666*/, flag: 'a' };
  } else if (util.isString(options)) {
    options = { encoding: options, mode: 438, flag: 'a' };
  } else if (!util.isObject(options)) {
    throw new TypeError('Bad arguments');
  }

  if (!options.flag)
    options = util._extend({ flag: 'a' }, options);
  fs.writeFile(path, data, options, callback);
};

fs.appendFileSync = function(path, data, options) {
  if (!options) {
    options = { encoding: 'utf8', mode: 438 /*=0666*/, flag: 'a' };
  } else if (util.isString(options)) {
    options = { encoding: options, mode: 438, flag: 'a' };
  } else if (!util.isObject(options)) {
    throw new TypeError('Bad arguments');
  }
  if (!options.flag)
    options = util._extend({ flag: 'a' }, options);

  fs.writeFileSync(path, data, options);
};

function FSWatcher() {
  EventEmitter.call(this);

  var self = this;
  var FSEvent = process.binding('fs_event_wrap').FSEvent;
  this._handle = new FSEvent();
  this._handle.owner = this;

  this._handle.onchange = function(status, event, filename) {
    if (status < 0) {
      self._handle.close();
      self.emit('error', errnoException(status, 'watch'));
    } else {
      self.emit('change', event, filename);
    }
  };
}
util.inherits(FSWatcher, EventEmitter);

FSWatcher.prototype.start = function(filename, persistent, recursive) {
  nullCheck(filename);
  var err = this._handle.start(pathModule._makeLong(filename),
                               persistent,
                               recursive);
  if (err) {
    this._handle.close();
    throw errnoException(err, 'watch');
  }
};

FSWatcher.prototype.close = function() {
  this._handle.close();
};

fs.watch = function(filename) {
  nullCheck(filename);
  var watcher;
  var options;
  var listener;

  if (util.isObject(arguments[1])) {
    options = arguments[1];
    listener = arguments[2];
  } else {
    options = {};
    listener = arguments[1];
  }

  if (util.isUndefined(options.persistent)) options.persistent = true;
  if (util.isUndefined(options.recursive)) options.recursive = false;

  watcher = new FSWatcher();
  watcher.start(filename, options.persistent, options.recursive);

  if (listener) {
    watcher.addListener('change', listener);
  }

  return watcher;
};


// Stat Change Watchers

function StatWatcher() {
  EventEmitter.call(this);

  var self = this;
  this._handle = new binding.StatWatcher();

  // uv_fs_poll is a little more powerful than ev_stat but we curb it for
  // the sake of backwards compatibility
  var oldStatus = -1;

  this._handle.onchange = function(current, previous, newStatus) {
    if (oldStatus === -1 &&
        newStatus === -1 &&
        current.nlink === previous.nlink) return;

    oldStatus = newStatus;
    self.emit('change', current, previous);
  };

  this._handle.onstop = function() {
    self.emit('stop');
  };
}
util.inherits(StatWatcher, EventEmitter);


StatWatcher.prototype.start = function(filename, persistent, interval) {
  nullCheck(filename);
  this._handle.start(pathModule._makeLong(filename), persistent, interval);
};


StatWatcher.prototype.stop = function() {
  this._handle.stop();
};


var statWatchers = {};
function inStatWatchers(filename) {
  return Object.prototype.hasOwnProperty.call(statWatchers, filename) &&
      statWatchers[filename];
}


fs.watchFile = function(filename) {
  nullCheck(filename);
  filename = pathModule.resolve(filename);
  var stat;
  var listener;

  var options = {
    // Poll interval in milliseconds. 5007 is what libev used to use. It's
    // a little on the slow side but let's stick with it for now to keep
    // behavioral changes to a minimum.
    interval: 5007,
    persistent: true
  };

  if (util.isObject(arguments[1])) {
    options = util._extend(options, arguments[1]);
    listener = arguments[2];
  } else {
    listener = arguments[1];
  }

  if (!listener) {
    throw new Error('watchFile requires a listener function');
  }

  if (inStatWatchers(filename)) {
    stat = statWatchers[filename];
  } else {
    stat = statWatchers[filename] = new StatWatcher();
    stat.start(filename, options.persistent, options.interval);
  }
  stat.addListener('change', listener);
  return stat;
};

fs.unwatchFile = function(filename, listener) {
  nullCheck(filename);
  filename = pathModule.resolve(filename);
  if (!inStatWatchers(filename)) return;

  var stat = statWatchers[filename];

  if (util.isFunction(listener)) {
    stat.removeListener('change', listener);
  } else {
    stat.removeAllListeners('change');
  }

  if (EventEmitter.listenerCount(stat, 'change') === 0) {
    stat.stop();
    statWatchers[filename] = undefined;
  }
};

// Regexp that finds the next partion of a (partial) path
// result is [base_with_slash, base], e.g. ['somedir/', 'somedir']
if (isWindows) {
  var nextPartRe = /(.*?)(?:[\/\\]+|$)/g;
} else {
  var nextPartRe = /(.*?)(?:[\/]+|$)/g;
}

// Regex to find the device root, including trailing slash. E.g. 'c:\\'.
if (isWindows) {
  var splitRootRe = /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/;
} else {
  var splitRootRe = /^[\/]*/;
}

fs.realpathSync = function realpathSync(p, cache) {
  // make p is absolute
  p = pathModule.resolve(p);

  if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
    return cache[p];
  }

  var original = p,
      seenLinks = {},
      knownHard = {};

  // current character position in p
  var pos;
  // the partial path so far, including a trailing slash if any
  var current;
  // the partial path without a trailing slash (except when pointing at a root)
  var base;
  // the partial path scanned in the previous round, with slash
  var previous;

  start();

  function start() {
    // Skip over roots
    var m = splitRootRe.exec(p);
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = '';

    // On windows, check that the root exists. On unix there is no need.
    if (isWindows && !knownHard[base]) {
      fs.lstatSync(base);
      knownHard[base] = true;
    }
  }

  // walk down the path, swapping out linked pathparts for their real
  // values
  // NB: p.length changes.
  while (pos < p.length) {
    // find the next part
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p);
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;

    // continue if not a symlink
    if (knownHard[base] || (cache && cache[base] === base)) {
      continue;
    }

    var resolvedLink;
    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
      // some known symbolic link.  no need to stat again.
      resolvedLink = cache[base];
    } else {
      var stat = fs.lstatSync(base);
      if (!stat.isSymbolicLink()) {
        knownHard[base] = true;
        if (cache) cache[base] = base;
        continue;
      }

      // read the link if it wasn't read before
      
      var linkTarget = null;
      if (!isWindows) {
        var id = stat.dev.toString(32) + ':' + stat.ino.toString(32);
        if (seenLinks.hasOwnProperty(id)) {
          linkTarget = seenLinks[id];
        }
      }
      if (util.isNull(linkTarget)) {
        fs.statSync(base);
        linkTarget = fs.readlinkSync(base);
      }
      resolvedLink = pathModule.resolve(previous, linkTarget);
      
      if (cache) cache[base] = resolvedLink;
      if (!isWindows) seenLinks[id] = linkTarget;
    }

    
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }

  if (cache) cache[original] = p;

  return p;
};


fs.realpath = function realpath(p, cache, cb) {
  if (!util.isFunction(cb)) {
    cb = maybeCallback(cache);
    cache = null;
  }

  
  p = pathModule.resolve(p);

  if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
    return process.nextTick(cb.bind(null, null, cache[p]));
  }

  var original = p,
      seenLinks = {},
      knownHard = {};

  
  var pos;
  
  var current;
  
  var base;
  
  var previous;

  start();

  function start() {
    
    var m = splitRootRe.exec(p);
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = '';

    
    if (isWindows && !knownHard[base]) {
      fs.lstat(base, function(err) {
        if (err) return cb(err);
        knownHard[base] = true;
        LOOP();
      });
    } else {
      process.nextTick(LOOP);
    }
  }

  
  
  function LOOP() {
    
    if (pos >= p.length) {
      if (cache) cache[original] = p;
      return cb(null, p);
    }

    
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p);
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;

    
    if (knownHard[base] || (cache && cache[base] === base)) {
      return process.nextTick(LOOP);
    }

    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
      
      return gotResolvedLink(cache[base]);
    }

    return fs.lstat(base, gotStat);
  }

  function gotStat(err, stat) {
    if (err) return cb(err);

    
    if (!stat.isSymbolicLink()) {
      knownHard[base] = true;
      if (cache) cache[base] = base;
      return process.nextTick(LOOP);
    }

    
    
    
    if (!isWindows) {
      var id = stat.dev.toString(32) + ':' + stat.ino.toString(32);
      if (seenLinks.hasOwnProperty(id)) {
        return gotTarget(null, seenLinks[id], base);
      }
    }
    fs.stat(base, function(err) {
      if (err) return cb(err);

      fs.readlink(base, function(err, target) {
        if (!isWindows) seenLinks[id] = target;
        gotTarget(err, target);
      });
    });
  }

  function gotTarget(err, target, base) {
    if (err) return cb(err);

    var resolvedLink = pathModule.resolve(previous, target);
    if (cache) cache[base] = resolvedLink;
    gotResolvedLink(resolvedLink);
  }

  function gotResolvedLink(resolvedLink) {
    
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }
};



var pool;

function allocNewPool(poolSize) {
  pool = new Buffer(poolSize);
  pool.used = 0;
}



fs.createReadStream = function(path, options) {
  return new ReadStream(path, options);
};

util.inherits(ReadStream, Readable);
fs.ReadStream = ReadStream;

function ReadStream(path, options) {
  if (!(this instanceof ReadStream))
    return new ReadStream(path, options);

  
  options = util._extend({
    highWaterMark: 64 * 1024
  }, options || {});

  Readable.call(this, options);

  this.path = path;
  this.fd = options.hasOwnProperty('fd') ? options.fd : null;
  this.flags = options.hasOwnProperty('flags') ? options.flags : 'r';
  this.mode = options.hasOwnProperty('mode') ? options.mode : 438; 

  this.start = options.hasOwnProperty('start') ? options.start : undefined;
  this.end = options.hasOwnProperty('end') ? options.end : undefined;
  this.autoClose = options.hasOwnProperty('autoClose') ?
      options.autoClose : true;
  this.pos = undefined;

  if (!util.isUndefined(this.start)) {
    if (!util.isNumber(this.start)) {
      throw TypeError('start must be a Number');
    }
    if (util.isUndefined(this.end)) {
      this.end = Infinity;
    } else if (!util.isNumber(this.end)) {
      throw TypeError('end must be a Number');
    }

    if (this.start > this.end) {
      throw new Error('start must be <= end');
    }

    this.pos = this.start;
  }

  if (!util.isNumber(this.fd))
    this.open();

  this.on('end', function() {
    if (this.autoClose) {
      this.destroy();
    }
  });
}

fs.FileReadStream = fs.ReadStream; 

ReadStream.prototype.open = function() {
  var self = this;
  fs.open(this.path, this.flags, this.mode, function(er, fd) {
    if (er) {
      if (self.autoClose) {
        self.destroy();
      }
      self.emit('error', er);
      return;
    }

    self.fd = fd;
    self.emit('open', fd);
    
    self.read();
  });
};

ReadStream.prototype._read = function(n) {
  if (!util.isNumber(this.fd))
    return this.once('open', function() {
      this._read(n);
    });

  if (this.destroyed)
    return;

  if (!pool || pool.length - pool.used < kMinPoolSpace) {
    
    pool = null;
    allocNewPool(this._readableState.highWaterMark);
  }

  
  
  
  var thisPool = pool;
  var toRead = Math.min(pool.length - pool.used, n);
  var start = pool.used;

  if (!util.isUndefined(this.pos))
    toRead = Math.min(this.end - this.pos + 1, toRead);

  
  
  if (toRead <= 0)
    return this.push(null);

  
  var self = this;
  fs.read(this.fd, pool, pool.used, toRead, this.pos, onread);

  
  if (!util.isUndefined(this.pos))
    this.pos += toRead;
  pool.used += toRead;

  function onread(er, bytesRead) {
    if (er) {
      if (self.autoClose) {
        self.destroy();
      }
      self.emit('error', er);
    } else {
      var b = null;
      if (bytesRead > 0)
        b = thisPool.slice(start, start + bytesRead);

      self.push(b);
    }
  }
};


ReadStream.prototype.destroy = function() {
  if (this.destroyed)
    return;
  this.destroyed = true;

  if (util.isNumber(this.fd))
    this.close();
};


ReadStream.prototype.close = function(cb) {
  var self = this;
  if (cb)
    this.once('close', cb);
  if (this.closed || !util.isNumber(this.fd)) {
    if (!util.isNumber(this.fd)) {
      this.once('open', close);
      return;
    }
    return process.nextTick(this.emit.bind(this, 'close'));
  }
  this.closed = true;
  close();

  function close(fd) {
    fs.close(fd || self.fd, function(er) {
      if (er)
        self.emit('error', er);
      else
        self.emit('close');
    });
    self.fd = null;
  }
};




fs.createWriteStream = function(path, options) {
  return new WriteStream(path, options);
};

util.inherits(WriteStream, Writable);
fs.WriteStream = WriteStream;
function WriteStream(path, options) {
  if (!(this instanceof WriteStream))
    return new WriteStream(path, options);

  options = options || {};

  Writable.call(this, options);

  this.path = path;
  this.fd = null;

  this.fd = options.hasOwnProperty('fd') ? options.fd : null;
  this.flags = options.hasOwnProperty('flags') ? options.flags : 'w';
  this.mode = options.hasOwnProperty('mode') ? options.mode : 438; 

  this.start = options.hasOwnProperty('start') ? options.start : undefined;
  this.pos = undefined;
  this.bytesWritten = 0;

  if (!util.isUndefined(this.start)) {
    if (!util.isNumber(this.start)) {
      throw TypeError('start must be a Number');
    }
    if (this.start < 0) {
      throw new Error('start must be >= zero');
    }

    this.pos = this.start;
  }

  if (!util.isNumber(this.fd))
    this.open();

  
  this.once('finish', this.close);
}

fs.FileWriteStream = fs.WriteStream; 


WriteStream.prototype.open = function() {
  fs.open(this.path, this.flags, this.mode, function(er, fd) {
    if (er) {
      this.destroy();
      this.emit('error', er);
      return;
    }

    this.fd = fd;
    this.emit('open', fd);
  }.bind(this));
};


WriteStream.prototype._write = function(data, encoding, cb) {
  if (!util.isBuffer(data))
    return this.emit('error', new Error('Invalid data'));

  if (!util.isNumber(this.fd))
    return this.once('open', function() {
      this._write(data, encoding, cb);
    });

  var self = this;
  fs.write(this.fd, data, 0, data.length, this.pos, function(er, bytes) {
    if (er) {
      self.destroy();
      return cb(er);
    }
    self.bytesWritten += bytes;
    cb();
  });

  if (!util.isUndefined(this.pos))
    this.pos += data.length;
};


WriteStream.prototype.destroy = ReadStream.prototype.destroy;
WriteStream.prototype.close = ReadStream.prototype.close;


WriteStream.prototype.destroySoon = WriteStream.prototype.end;




function SyncWriteStream(fd, options) {
  Stream.call(this);

  options = options || {};

  this.fd = fd;
  this.writable = true;
  this.readable = false;
  this.autoClose = options.hasOwnProperty('autoClose') ?
      options.autoClose : true;
}

util.inherits(SyncWriteStream, Stream);



fs.SyncWriteStream = SyncWriteStream;


SyncWriteStream.prototype.write = function(data, arg1, arg2) {
  var encoding, cb;

  
  if (arg1) {
    if (util.isString(arg1)) {
      encoding = arg1;
      cb = arg2;
    } else if (util.isFunction(arg1)) {
      cb = arg1;
    } else {
      throw new Error('bad arg');
    }
  }
  assertEncoding(encoding);

  
  if (util.isString(data)) {
    data = new Buffer(data, encoding);
  }

  fs.writeSync(this.fd, data, 0, data.length);

  if (cb) {
    process.nextTick(cb);
  }

  return true;
};


SyncWriteStream.prototype.end = function(data, arg1, arg2) {
  if (data) {
    this.write(data, arg1, arg2);
  }
  this.destroy();
};


SyncWriteStream.prototype.destroy = function() {
  if (this.autoClose)
    fs.closeSync(this.fd);
  this.fd = null;
  this.emit('close');
  return true;
};

SyncWriteStream.prototype.destroySoon = SyncWriteStream.prototype.destroy;

fs.mkdirP = function(p, opts, f, made) {
    if (typeof opts === 'function') {
        f = opts;
        opts = {};
    }
    else if (!opts || typeof opts !== 'object') {
        opts = { mode: opts };
    }

    var mode = opts.mode;
    var xfs = opts.fs || fs;

    if (mode === undefined) {
        mode = parseInt('0777', 8) & (~process.umask());
    }
    if (!made) made = null;

    var cb = f || function () { };
    p = pathModule.resolve(p);

    xfs.mkdir(p, mode, function (er) {
        if (!er) {
            made = made || p;
            return cb(null, made);
        }
        switch (er.code) {
            case 'ENOENT':
                fs.mkdirP(pathModule.dirname(p), opts, function (er, made) {
                    if (er) cb(er, made);
                    else fs.mkdirP(p, opts, cb, made);
                });
                break;

                
                
                
            default:
                xfs.stat(p, function (er2, stat) {
                    
                    
                    if (er2 || !stat.isDirectory()) cb(er, made)
                    else cb(null, made);
                });
                break;
        }
    });
}

fs.removeRecursive = function(path,cb){
  var self = this;

  fs.stat(path, function(err, stats) {
    if(err){
      cb(err,stats);
      return;
    }
    if(stats.isFile()){
      fs.unlink(path, function(err) {
        if(err) {
          cb(err,null);
        }else{
          cb(null,true);
        }
        return;
      });
    }else if(stats.isDirectory()){
      
      
      
      
      fs.readdir(path, function(err, files) {
        if(err){
          cb(err,null);
          return;
        }
        var f_length = files.length;
        var f_delete_index = 0;

        
        

        var checkStatus = function(){
          
          
          if(f_length===f_delete_index){
            fs.rmdir(path, function(err) {
              if(err){
                cb(err,null);
              }else{ 
                cb(null,true);
              }
            });
            return true;
          }
          return false;
        };
        if(!checkStatus()){
          for(var i=0;i<f_length;i++){
            
            
            
            (function(){
              var filePath = path + '/' + files[i];
              
              
              fs.removeRecursive(filePath,function removeRecursiveCB(err,status){
                if(!err){
                  f_delete_index ++;
                  checkStatus();
                }else{
                  cb(err,null);
                  return;
                }
              });
  
            })()
          }
        }
      });
    }
  });
};
var origCwd = process.cwd
var cwd = null
process.cwd = function() {
  if (!cwd)
    cwd = origCwd.call(process)
  return cwd
}
var chdir = process.chdir
process.chdir = function(d) {
  cwd = null
  chdir.call(process, d)
}





if (constants.hasOwnProperty('O_SYMLINK') &&
    process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
  fs.lchmod = function (path, mode, callback) {
    callback = callback || noop
    fs.open( path
           , constants.O_WRONLY | constants.O_SYMLINK
           , mode
           , function (err, fd) {
      if (err) {
        callback(err)
        return
      }
      
      
      fs.fchmod(fd, mode, function (err) {
        fs.close(fd, function(err2) {
          callback(err || err2)
        })
      })
    })
  }

  fs.lchmodSync = function (path, mode) {
    var fd = fs.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode)

    
    
    var err, err2
    try {
      var ret = fs.fchmodSync(fd, mode)
    } catch (er) {
      err = er
    }
    try {
      fs.closeSync(fd)
    } catch (er) {
      err2 = er
    }
    if (err || err2) throw (err || err2)
    return ret
  }
}



if (!fs.lutimes) {
  if (constants.hasOwnProperty("O_SYMLINK")) {
    fs.lutimes = function (path, at, mt, cb) {
      fs.open(path, constants.O_SYMLINK, function (er, fd) {
        cb = cb || noop
        if (er) return cb(er)
        fs.futimes(fd, at, mt, function (er) {
          fs.close(fd, function (er2) {
            return cb(er || er2)
          })
        })
      })
    }

    fs.lutimesSync = function (path, at, mt) {
      var fd = fs.openSync(path, constants.O_SYMLINK)
        , err
        , err2
        , ret

      try {
        var ret = fs.futimesSync(fd, at, mt)
      } catch (er) {
        err = er
      }
      try {
        fs.closeSync(fd)
      } catch (er) {
        err2 = er
      }
      if (err || err2) throw (err || err2)
      return ret
    }

  } else if (fs.utimensat && constants.hasOwnProperty("AT_SYMLINK_NOFOLLOW")) {
    
    fs.lutimes = function (path, at, mt, cb) {
      fs.utimensat(path, at, mt, constants.AT_SYMLINK_NOFOLLOW, cb)
    }

    fs.lutimesSync = function (path, at, mt) {
      return fs.utimensatSync(path, at, mt, constants.AT_SYMLINK_NOFOLLOW)
    }

  } else {
    fs.lutimes = function (_a, _b, _c, cb) { process.nextTick(cb) }
    fs.lutimesSync = function () {}
  }
}







fs.chown = chownFix(fs.chown)
fs.fchown = chownFix(fs.fchown)
fs.lchown = chownFix(fs.lchown)

fs.chmod = chownFix(fs.chmod)
fs.fchmod = chownFix(fs.fchmod)
fs.lchmod = chownFix(fs.lchmod)

fs.chownSync = chownFixSync(fs.chownSync)
fs.fchownSync = chownFixSync(fs.fchownSync)
fs.lchownSync = chownFixSync(fs.lchownSync)

fs.chmodSync = chownFix(fs.chmodSync)
fs.fchmodSync = chownFix(fs.fchmodSync)
fs.lchmodSync = chownFix(fs.lchmodSync)

function chownFix (orig) {
  if (!orig) return orig
  return function (target, uid, gid, cb) {
    return orig.call(fs, target, uid, gid, function (er, res) {
      if (chownErOk(er)) er = null
      cb(er, res)
    })
  }
}

function chownFixSync (orig) {
  if (!orig) return orig
  return function (target, uid, gid) {
    try {
      return orig.call(fs, target, uid, gid)
    } catch (er) {
      if (!chownErOk(er)) throw er
    }
  }
}














function chownErOk (er) {
  if (!er)
    return true

  if (er.code === "ENOSYS")
    return true

  var nonroot = !process.getuid || process.getuid() !== 0
  if (nonroot) {
    if (er.code === "EINVAL" || er.code === "EPERM")
      return true
  }

  return false
}



if (!fs.lchmod) {
  fs.lchmod = function (path, mode, cb) {
    process.nextTick(cb)
  }
  fs.lchmodSync = function () {}
}
if (!fs.lchown) {
  fs.lchown = function (path, uid, gid, cb) {
    process.nextTick(cb)
  }
  fs.lchownSync = function () {}
}

if (process.platform === "win32") {
  var rename_ = fs.rename
  fs.rename = function rename (from, to, cb) {
    var start = Date.now()
    rename_(from, to, function CB (er) {
      if (er
          && (er.code === "EACCES" || er.code === "EPERM")
          && Date.now() - start < 1000) {
        return rename_(from, to, CB)
      }
      if(cb) cb(er)
    })
  }
}

var read = fs.read
fs.read = function (fd, buffer, offset, length, position, callback_) {
  var callback
  if (callback_ && typeof callback_ === 'function') {
    var eagCounter = 0
    callback = function (er, _, __) {
      if (er && er.code === 'EAGAIN' && eagCounter < 10) {
        eagCounter ++
        return read.call(fs, fd, buffer, offset, length, position, callback)
      }
      callback_.apply(this, arguments)
    }
  }
  return read.call(fs, fd, buffer, offset, length, position, callback)
}

var readSync = fs.readSync
fs.readSync = function (fd, buffer, offset, length, position) {
  var eagCounter = 0
  while (true) {
    try {
      return readSync.call(fs, fd, buffer, offset, length, position)
    } catch (er) {
      if (er.code === 'EAGAIN' && eagCounter < 10) {
        eagCounter ++
        continue
      }
      throw er
    }
  }
}


fs.ncp = function(source, dest, options, callback) {
  var cback = callback;

  if (!callback) {
    cback = options;
    options = {};
  }

  var basePath = process.cwd(),
      currentPath = path.resolve(basePath, source),
      targetPath = path.resolve(basePath, dest),
      filter = options.filter,
      rename = options.rename,
      transform = options.transform,
      clobber = options.clobber !== false,
      modified = options.modified,
      dereference = options.dereference,
      errs = null,
      started = 0,
      finished = 0,
      running = 0,
      limit = options.limit || fs.ncp.limit || 16;

  limit = (limit < 1) ? 1 : (limit > 512) ? 512 : limit;

  startCopy(currentPath);
  
  function startCopy(source) {
    started++;
    if (filter) {
      if (filter instanceof RegExp) {
        if (!filter.test(source)) {
          return cb(true);
        }
      }
      else if (typeof filter === 'function') {
        if (!filter(source)) {
          return cb(true);
        }
      }
    }
    return getStats(source);
  }

  function getStats(source) {
    var stat = dereference ? fs.stat : fs.lstat;
    if (running >= limit) {
      return setImmediate(function () {
        getStats(source);
      });
    }
    running++;
    stat(source, function (err, stats) {
      var item = {};
      if (err) {
        return onError(err);
      }

      
      item.name = source;
      item.mode = stats.mode;
      item.mtime = stats.mtime; 
      item.atime = stats.atime; 

      if (stats.isDirectory()) {
        return onDir(item);
      }
      else if (stats.isFile()) {
        return onFile(item);
      }
      else if (stats.isSymbolicLink()) {
        
        return onLink(source);
      }
    });
  }

  function onFile(file) {
    var target = file.name.replace(currentPath, targetPath);
    if(rename) {
      target =  rename(target);
    }
    isWritable(target, function (writable) {
      if (writable) {
        return copyFile(file, target);
      }
      if(clobber) {
        rmFile(target, function () {
          copyFile(file, target);
        });
      }
      if (modified) {
        var stat = dereference ? fs.stat : fs.lstat;
        stat(target, function(err, stats) {
            
            if (file.mtime.getTime()>stats.mtime.getTime())
                copyFile(file, target);
            else return cb();
        });
      }
      else {
        return cb();
      }
    });
  }

  function copyFile(file, target) {
    var readStream = fs.createReadStream(file.name),
        writeStream = fs.createWriteStream(target, { mode: file.mode });
    
    readStream.on('error', onError);
    writeStream.on('error', onError);
    
    if(transform) {
      transform(readStream, writeStream, file);
    } else {
      writeStream.on('open', function() {
        readStream.pipe(writeStream);
      });
    }
    writeStream.once('finish', function() {
        if (modified) {
            
            fs.utimesSync(target, file.atime, file.mtime);
            cb();
        }
        else cb();
    });
  }

  function rmFile(file, done) {
    fs.unlink(file, function (err) {
      if (err) {
        return onError(err);
      }
      return done();
    });
  }

  function onDir(dir) {
    var target = dir.name.replace(currentPath, targetPath);
    isWritable(target, function (writable) {
      if (writable) {
        return mkDir(dir, target);
      }
      copyDir(dir.name);
    });
  }

  function mkDir(dir, target) {
    fs.mkdir(target, dir.mode, function (err) {
      if (err) {
        return onError(err);
      }
      copyDir(dir.name);
    });
  }

  function copyDir(dir) {
    fs.readdir(dir, function (err, items) {
      if (err) {
        return onError(err);
      }
      items.forEach(function (item) {
        startCopy(path.join(dir, item));
      });
      return cb();
    });
  }

  function onLink(link) {
    var target = link.replace(currentPath, targetPath);
    fs.readlink(link, function (err, resolvedPath) {
      if (err) {
        return onError(err);
      }
      checkLink(resolvedPath, target);
    });
  }

  function checkLink(resolvedPath, target) {
    if (dereference) {
      resolvedPath = path.resolve(basePath, resolvedPath);
    }
    isWritable(target, function (writable) {
      if (writable) {
        return makeLink(resolvedPath, target);
      }
      fs.readlink(target, function (err, targetDest) {
        if (err) {
          return onError(err);
        }
        if (dereference) {
          targetDest = path.resolve(basePath, targetDest);
        }
        if (targetDest === resolvedPath) {
          return cb();
        }
        return rmFile(target, function () {
          makeLink(resolvedPath, target);
        });
      });
    });
  }

  function makeLink(linkPath, target) {
    fs.symlink(linkPath, target, function (err) {
      if (err) {
        return onError(err);
      }
      return cb();
    });
  }

  function isWritable(path, done) {
    fs.lstat(path, function (err) {
      if (err) {
        if (err.code === 'ENOENT') return done(true);
        return done(false);
      }
      return done(false);
    });
  }

  function onError(err) {
    if (options.stopOnError) {
      return cback(err);
    }
    else if (!errs && options.errs) {
      errs = fs.createWriteStream(options.errs);
    }
    else if (!errs) {
      errs = [];
    }
    if (typeof errs.write === 'undefined') {
      errs.push(err);
    }
    else { 
      errs.write(err.stack + '\n\n');
    }
    return cb();
  }

  function cb(skipped) {
    if (!skipped) running--;
    finished++;
    if ((started === finished) && (running === 0)) {
      if (cback !== undefined ) {
        return errs ? cback(errs) : cback(null);
      }
    }
  }
}

fs.copyFile = function(source, target, cb) {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}