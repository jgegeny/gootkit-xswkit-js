var util = require('util');
var Readable = require('stream').Readable;
var Writable = require('stream').Writable;
var PassThrough = require('stream').PassThrough;

var fs = require('fs');
var path = require('path');
var os = require('os');
var zlib = require('zlib');

function wrappy (fn, cb) {
  if (fn && cb) return wrappy(fn)(cb)

  if (typeof fn !== 'function')
    throw new TypeError('need wrapper function')

  Object.keys(fn).forEach(function (k) {
    wrapper[k] = fn[k]
  })

  return wrapper

  function wrapper() {
    var args = new Array(arguments.length)
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i]
    }
    var ret = fn.apply(this, args)
    var cb = args[args.length-1]
    if (typeof ret === 'function' && ret !== cb) {
      Object.keys(cb).forEach(function (k) {
        ret[k] = cb[k]
      })
    }
    return ret
  }
}


function once (fn) {
  var f = function () {
    if (f.called) return f.value
    f.called = true
    return f.value = fn.apply(this, arguments)
  }
  f.called = false
  return f
}

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
})

var fonce = wrappy(once);

var noop = function() {}

var isRequest = function(stream) {
	return stream.setHeader && typeof stream.abort === 'function';
};

var isChildProcess = function(stream) {
	return stream.stdio && Array.isArray(stream.stdio) && stream.stdio.length === 3
};

var eos = function(stream, opts, callback) {
	if (typeof opts === 'function') return eos(stream, null, opts);
	if (!opts) opts = {};

	callback = fonce(callback || noop);

	var ws = stream._writableState;
	var rs = stream._readableState;
	var readable = opts.readable || (opts.readable !== false && stream.readable);
	var writable = opts.writable || (opts.writable !== false && stream.writable);

	var onlegacyfinish = function() {
		if (!stream.writable) onfinish();
	};

	var onfinish = function() {
		writable = false;
		if (!readable) callback();
	};

	var onend = function() {
		readable = false;
		if (!writable) callback();
	};

	var onexit = function(exitCode) {
		callback(exitCode ? new Error('exited with error code: ' + exitCode) : null);
	};

	var onclose = function() {
		if (readable && !(rs && rs.ended)) return callback(new Error('premature close'));
		if (writable && !(ws && ws.ended)) return callback(new Error('premature close'));
	};

	var onrequest = function() {
		stream.req.on('finish', onfinish);
	};

	if (isRequest(stream)) {
		stream.on('complete', onfinish);
		stream.on('abort', onclose);
		if (stream.req) onrequest();
		else stream.on('request', onrequest);
	} else if (writable && !ws) { 
		stream.on('end', onlegacyfinish);
		stream.on('close', onlegacyfinish);
	}

	if (isChildProcess(stream)) stream.on('exit', onexit);

	stream.on('end', onend);
	stream.on('finish', onfinish);
	if (opts.error !== false) stream.on('error', callback);
	stream.on('close', onclose);

	return function() {
		stream.removeListener('complete', onfinish);
		stream.removeListener('abort', onclose);
		stream.removeListener('request', onrequest);
		if (stream.req) stream.req.removeListener('finish', onfinish);
		stream.removeListener('end', onlegacyfinish);
		stream.removeListener('close', onlegacyfinish);
		stream.removeListener('finish', onfinish);
		stream.removeListener('exit', onexit);
		stream.removeListener('end', onend);
		stream.removeListener('error', callback);
		stream.removeListener('close', onclose);
	};
};

var isFn = function(fn) {
	return typeof fn === 'function';
};

var isFS = function(stream) {
	return (stream instanceof (fs.ReadStream || noop) || stream instanceof (fs.WriteStream || noop)) && isFn(stream.close);
};

var isRequest = function(stream) {
	return stream.setHeader && isFn(stream.abort);
};

var destroyer = function(stream, reading, writing, callback) {
	callback = once(callback);

	var closed = false;
	stream.on('close', function() {
		closed = true;
	});

	eos(stream, {readable:reading, writable:writing}, function(err) {
		if (err) return callback(err);
		closed = true;
		callback();
	});

	var destroyed = false;
	return function(err) {
		if (closed) return;
		if (destroyed) return;
		destroyed = true;

		if (isFS(stream)) return stream.close(); 
		if (isRequest(stream)) return stream.abort(); 

		if (isFn(stream.destroy)) return stream.destroy();

		callback(err || new Error('stream was destroyed'));
	};
};

var call = function(fn) {
	fn();
};

var pipe = function(from, to) {
	return from.pipe(to);
};

var pump = function() {
	var streams = Array.prototype.slice.call(arguments);
	var callback = isFn(streams[streams.length-1] || noop) && streams.pop() || noop;

	if (Array.isArray(streams[0])) streams = streams[0];
	if (streams.length < 2) throw new Error('pump requires two streams per minimum');

	var error;
	var destroys = streams.map(function(stream, i) {
		var reading = i < streams.length-1;
		var writing = i > 0;
		return destroyer(stream, reading, writing, function(err) {
			if (!error) error = err;
			if (err) destroys.forEach(call);
			if (reading) return;
			destroys.forEach(call);
			callback(error);
		});
	});

	return streams.reduce(pipe);
};

var END_OF_TAR = new Buffer(1024)
END_OF_TAR.fill(0)


var ZEROS = '0000000000000000000'
var ZERO_OFFSET = '0'.charCodeAt(0)
var USTAR = 'ustar\x0000'

var headers = {};
var clamp = function(index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index  
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

var toType = function(flag) {
  switch (flag) {
    case 0:
    return 'file'
    case 1:
    return 'link'
    case 2:
    return 'symlink'
    case 3:
    return 'character-device'
    case 4:
    return 'block-device'
    case 5:
    return 'directory'
    case 6:
    return 'fifo'
    case 7:
    return 'contiguous-file'
    case 72:
    return 'pax-header'
    case 55:
    return 'pax-global-header'
  }

  return null
}

var toTypeflag = function(flag) {
  switch (flag) {
    case 'file':
    return 0
    case 'link':
    return 1
    case 'symlink':
    return 2
    case 'character-device':
    return 3
    case 'block-device':
    return 4
    case 'directory':
    return 5
    case 'fifo':
    return 6
    case 'contiguous-file':
    return 7
    case 'pax-header':
    return 72
  }

  return 0
}

var alloc = function(size) {
  var buf = new Buffer(size)
  buf.fill(0)
  return buf
}

var indexOf = function(block, num, offset, end) {
  for (; offset < end; offset++) {
    if (block[offset] === num) return offset
  }
  return end
}

var cksum = function(block) {
  var sum = 8 * 32
  for (var i = 0; i < 148; i++)   sum += block[i]
  for (var i = 156; i < 512; i++) sum += block[i]
  return sum
}

var encodeOct = function(val, n) {
  val = val.toString(8)
  return ZEROS.slice(0, n-val.length)+val+' '
}

var decodeStr = function(val, offset, length) {
  return val.slice(offset, indexOf(val, 0, offset, offset+length)).toString();
}

var addLength = function(str) {
  var len = Buffer.byteLength(str)
  var digits = Math.floor(Math.log(len) / Math.log(10)) + 1
  if (len + digits > Math.pow(10, digits)) digits++

  return (len+digits)+str
}

headers.encodePax = function(opts) { // TODO: encode more stuff in pax
  var result = ''
  if (opts.name) result += addLength(' path='+opts.name+'\n')
  if (opts.linkname) result += addLength(' linkpath='+opts.linkname+'\n')
  return new Buffer(result)
}


headers.encode = function(opts) {
  var buf = alloc(512)
  var name = opts.name
  var prefix = ''

  if (opts.typeflag === 5 && name[name.length-1] !== '/') name += '/'
  if (Buffer.byteLength(name) !== name.length) return null // utf-8

  while (Buffer.byteLength(name) > 100) {
    var i = name.indexOf('/')
    if (i === -1) return null
    prefix += prefix ? '/' + name.slice(0, i) : name.slice(0, i)
    name = name.slice(i+1)
  }

  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) return null
  if (opts.linkname && Buffer.byteLength(opts.linkname) > 100) return null

  buf.write(name)
  buf.write(encodeOct(opts.mode & parseInt('0777', 8), 6), 100)
  buf.write(encodeOct(opts.uid, 6), 108)
  buf.write(encodeOct(opts.gid, 6), 116)
  buf.write(encodeOct(opts.size, 11), 124)
  buf.write(encodeOct((opts.mtime.getTime() / 1000) | 0, 11), 136)

  buf[156] = ZERO_OFFSET + toTypeflag(opts.type)

  if (opts.linkname) buf.write(opts.linkname, 157)

  buf.write(USTAR, 257)
  if (opts.uname) buf.write(opts.uname, 265)
  if (opts.gname) buf.write(opts.gname, 297)
  buf.write(encodeOct(opts.devmajor || 0, 6), 329)
  buf.write(encodeOct(opts.devminor || 0, 6), 337)

  if (prefix) buf.write(prefix, 345)

  buf.write(encodeOct(cksum(buf), 6), 148)

  return buf
}


var overflow = function(self, size) {
  size &= 511
  if (size) self.push(END_OF_TAR.slice(0, 512 - size))
}

var Sink = function(to) {
  Writable.call(this)
  this.written = 0
  this._to = to
  this._destroyed = false
}

util.inherits(Sink, Writable)

Sink.prototype._write = function(data, enc, cb) {
  this.written += data.length
  if (this._to.push(data)) return cb()
  this._to._drain = cb
}

Sink.prototype.destroy = function() {
  if (this._destroyed) return
  this._destroyed = true
  this.emit('close')
}

var Void = function() {
  Writable.call(this)
  this._destroyed = false
}

util.inherits(Void, Writable)

Void.prototype._write = function(data, enc, cb) {
  cb(new Error('No body allowed for this entry'))
}

Void.prototype.destroy = function() {
  if (this._destroyed) return
  this._destroyed = true
  this.emit('close')
}

var Pack = function(opts) {
  if (!(this instanceof Pack)) return new Pack(opts)
  Readable.call(this, opts)

  this._drain = noop
  this._finalized = false
  this._finalizing = false
  this._destroyed = false
  this._stream = null
}

util.inherits(Pack, Readable)

Pack.prototype.entry = function(header, buffer, callback) {
  if (this._stream) throw new Error('already piping an entry')
  if (this._finalized || this._destroyed) return

  if (typeof buffer === 'function') {
    callback = buffer
    buffer = null
  }

  if (!callback) callback = noop

  var self = this

  if (!header.size)  header.size = 0
  if (!header.type)  header.type = 'file'
  if (!header.mode)  header.mode = header.type === 'directory' ? parseInt('0755', 8)  :parseInt('0644', 8)  
  if (!header.uid)   header.uid = 0
  if (!header.gid)   header.gid = 0
  if (!header.mtime) header.mtime = new Date()

  if (typeof buffer === 'string') buffer = new Buffer(buffer)
  if (Buffer.isBuffer(buffer)) {
    header.size = buffer.length
    this._encode(header)
    this.push(buffer)
    overflow(self, header.size)
    process.nextTick(callback)
    return new Void()
  }
  if (header.type !== 'file' && header.type !== 'contigious-file') {
    this._encode(header)
    process.nextTick(callback)
    return new Void()
  }

  var sink = new Sink(this)

  this._encode(header)
  this._stream = sink

  eos(sink, function(err) {
    self._stream = null

    if (err) { 
      self.destroy()
      return callback(err)
    }

    if (sink.written !== header.size) { 
      self.destroy()
      return callback(new Error('size mismatch'))
    }

    overflow(self, header.size)
    if (self._finalizing) self.finalize()
    callback()
  })

  return sink
}

Pack.prototype.finalize = function() {
  if (this._stream) {
    this._finalizing = true
    return
  }

  if (this._finalized) return
  this._finalized = true
  this.push(END_OF_TAR)
  this.push(null)
}

Pack.prototype.destroy = function(err) {
  if (this._destroyed) return
  this._destroyed = true

  if (err) this.emit('error', err)
  this.emit('close')
  if (this._stream && this._stream.destroy) this._stream.destroy()
}

Pack.prototype._encode = function(header) {
  var buf = headers.encode(header)
  if (buf) this.push(buf)
  else this._encodePax(header)
}

Pack.prototype._encodePax = function(header) {
  var paxHeader = headers.encodePax({
    name: header.name,
    linkname: header.linkname
  })

  var newHeader = {
    name: 'PaxHeader',
    mode: header.mode,
    uid: header.uid,
    gid: header.gid,
    size: paxHeader.length,
    mtime: header.mtime,
    type: 'pax-header',
    linkname: header.linkname && 'PaxHeader',
    uname: header.uname,
    gname: header.gname,
    devmajor: header.devmajor,
    devminor: header.devminor
  }

  this.push(headers.encode(newHeader))
  this.push(paxHeader)
  overflow(this, paxHeader.length)

  newHeader.size = header.size
  newHeader.type = header.type
  this.push(headers.encode(newHeader))
}

Pack.prototype._read = function(n) {
  var drain = this._drain
  this._drain = noop
  drain()
}

var win32 = os.platform() === 'win32';
var echo = function(name) {
  return name;
}

var normalize = !win32 ? echo : function(name) {
  return name.replace(/\\/g, '/')
}

var statAll = function(fs, stat, cwd, ignore, entries) {
  var queue = entries || ['.']

  return function loop(callback) {
    if (!queue.length) return callback()
    var next = queue.shift()
    var nextAbs = path.join(cwd, next)

    stat(nextAbs, function(err, stat) {
      if (err) return callback(err)

      if (!stat.isDirectory()) return callback(null, next, stat)

      fs.readdir(nextAbs, function(err, files) {
        if (err) return callback(err)

        for (var i = 0; i < files.length; i++) {
          if (!ignore(path.join(cwd, next, files[i]))) queue.push(path.join(next, files[i]))
        }

        callback(null, next, stat)
      })
    })
  }
}

var strip = function(map, level) {
  return function(header) {
    header.name = header.name.split('/').slice(level).join('/')
    if (header.linkname) header.linkname = header.linkname.split('/').slice(level).join('/')
    return map(header)
  }
}


function Fspack(cwd, opts) {
  if (!cwd) cwd = '.'
  if (!opts) opts = {}

  var xfs = opts.fs || fs
  var ignore = opts.ignore || opts.filter || noop
  var map = opts.map || noop
  var mapStream = opts.mapStream || echo
  var statNext = statAll(xfs, opts.dereference ? xfs.stat : xfs.lstat, cwd, ignore, opts.entries)
  var strict = opts.strict !== false
  var pack = Pack()

  if (opts.strip) map = strip(map, opts.strip)

  var onlink = function(filename, header) {
    xfs.readlink(path.join(cwd, filename), function(err, linkname) {
      if (err) return pack.destroy(err)
      header.linkname = normalize(linkname)
      pack.entry(header, onnextentry)
    })
  }

  var onstat = function(err, filename, stat) {
    if (err) return pack.destroy(err)
    if (!filename) return pack.finalize()

    if (stat.isSocket()) return onnextentry() 

    var header = {
      name: normalize(filename),
      mode: stat.mode,
      mtime: stat.mtime,
      size: stat.size,
      type: 'file',
      uid: stat.uid,
      gid: stat.gid
    }

    header = map(header) || header

    if (stat.isDirectory()) {
      header.size = 0
      header.type = 'directory'
      return pack.entry(header, onnextentry)
    }

    if (stat.isSymbolicLink()) {
      header.size = 0
      header.type = 'symlink'
      return onlink(filename, header)
    }

    

    if (!stat.isFile()) {
      if (strict) return pack.destroy(new Error('unsupported type for '+filename))
      return onnextentry()
    }

    var entry = pack.entry(header, onnextentry)
    if (!entry) return
    var rs = xfs.createReadStream(path.join(cwd, filename))

    pump(mapStream(rs, header), entry)
  }

  var onnextentry = function(err) {
    if (err) return pack.destroy(err)
    statNext(onstat)
  }

  onnextentry()

  return pack
}




var Gzcompress = function (params, callback) {
    callback = callback || function () {};
    var error = function (error) {
        throw error;
    };
    process.nextTick(function () {
    	var packer = Pack;

    	if(fs.lstatSync(params.source).isDirectory()){
    		Fspack(params.source)
	            .on('error', error)
	            .pipe(zlib.createGzip({
	                    level: params.level || 6,
	                    memLevel: params.memLevel || 6
	                })
	                .on('error', error))
	            .pipe(fs.createWriteStream(params.destination)
	                .on('error', error)
	                .on('finish', callback));
    	}else{
    		var compress = zlib.createGzip({
                    level: params.level || 6,
                    memLevel: params.memLevel || 6
               	}),
		        input = fs.createReadStream(params.source),
		        output = fs.createWriteStream(params.source + '.gz');

		    compress.on('end', callback);
    		input.pipe(compress).pipe(output);
    		
    	}

        
    });
};




exports.pack = Pack;
exports.fspack = Fspack;
exports.gzcompress = Gzcompress;

