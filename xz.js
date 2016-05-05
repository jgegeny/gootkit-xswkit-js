
(function() {
  var Compressor, DEFAULT_BUFSIZE, Decompressor, XzStream, node_xz, stream, util,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  node_xz = process.binding("xz");

  stream = require("stream");

  util = require("util");

  DEFAULT_BUFSIZE = 128 * 1024;

  XzStream = (function(_super) {
    __extends(XzStream, _super);

    function XzStream(mode, preset, options) {
      XzStream.__super__.constructor.call(this, options);
      this.engine = new node_xz.Engine(mode, preset);
    }

    XzStream.prototype._transform = function(chunk, encoding, callback) {
      this.engine.feed(chunk);
      this.__drain(chunk.length);
      return callback(null);
    };

    XzStream.prototype._flush = function(callback) {
      this.__drain(DEFAULT_BUFSIZE, node_xz.ENCODE_FINISH);
      return callback(null);
    };

    XzStream.prototype.__drain = function(estimate, flags) {
      var bufSize, buffer, n, segments;
      bufSize = Math.min(estimate * 1.1, DEFAULT_BUFSIZE);
      segments = [];
      n = -1;
      while (n < 0) {
        buffer = new Buffer(bufSize);
        n = this.engine.drain(buffer, flags);
        segments.push(buffer.slice(0, Math.abs(n)));
      }
      return this.push(Buffer.concat(segments));
    };

    return XzStream;

  })(stream.Transform);

  Compressor = (function(_super) {
    __extends(Compressor, _super);

    function Compressor(preset, options) {
      Compressor.__super__.constructor.call(this, node_xz.MODE_ENCODE, preset, options);
    }

    return Compressor;

  })(XzStream);

  Decompressor = (function(_super) {
    __extends(Decompressor, _super);

    function Decompressor(options) {
      Decompressor.__super__.constructor.call(this, node_xz.MODE_DECODE, null, options);
    }

    return Decompressor;

  })(XzStream);

  exports.Compressor = Compressor;

  exports.Decompressor = Decompressor;

}).call(this);