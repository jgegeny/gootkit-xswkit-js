var stream = require('stream');
var util = require('util');

var Transform = stream.Transform;

function modulo(a, b) {
		return a - Math.floor(a/b)*b;
}

function ToInteger(x) {
		x = Number(x);
		return x < 0 ? Math.ceil(x) : Math.floor(x);
}

function ToUint32(x) {
		return modulo(ToInteger(x), Math.pow(2, 32));
}

function PacketCompiler(options) {
	if (!(this instanceof PacketCompiler)) {
		return new PacketCompiler(options);
	}
	Transform.call(this, options);
	this._readableState.objectMode = true;
}

util.inherits(PacketCompiler, Transform);
/*
	
	*********************
	length 		- 4 bytes
	*********************
	payload
	*********************
*/

PacketCompiler.prototype._transform = function (chunk, enc, cb) {
	var self = this;

	//print('add protocol chunk : %d bytes', chunk.length);
	//console.log(chunk.toString());
	var packet = chunk;
	if (!(packet instanceof Buffer)) {
		packet = new Buffer(packet);
	}

	var packetLength = new Buffer(4);
	var packetMagic = new Buffer(4);
	var protoMagic = 0xEDB88320;
	var maxChunkSize = 1024;
	packetLength.writeUInt32BE(packet.length + 8);
	packetMagic.writeUInt32BE(ToUint32(protoMagic ^ packet.length));
	//process.encrypt(packet);
	//print(packetMagic.toString('hex'))

	self.push(packetLength);
	self.push(packetMagic);
	if (packet.length > maxChunkSize) {

		for (let i = 0; i < packet.length; i+=maxChunkSize)
		{
			self.push(
				packet.slice(i, Math.min(i + maxChunkSize, packet.length))
			);
		}

	} else {
		self.push(packet);
	}
	
	self.push(packetMagic);

	//print('send packet, length = %d bytes', packet.length);

	cb();

};

//------------------------------------------------------------
function createGetLengthMethod(lengthSize) {
	switch (lengthSize) {
		case 1:
			return function(buffer) {
				return buffer.readInt8(0)
			}
		case 2:
			return function(buffer) {
				return buffer.readInt16BE(0)
			}
		case 4:
			return function(buffer) {
				return buffer.readInt32BE(0)
			}
		default:
			throw new Error('Invalid frame length size')
	}
}

function PacketSplitter(options) {
	if (!(this instanceof PacketSplitter)) {
		return new PacketSplitter(options);
	}

	Transform.call(this, options);
	this._readableState.objectMode = true;
	
	this.opts = util._extend({
		lengthSize: 4,
		maxSize: 0,
		unbuffered: false
	}, options) 

	this.getLength = this.opts.getLength || 
		createGetLengthMethod(this.opts.lengthSize);

	this.buffer = null;
	this.frameLength = -1;
	this.framePos = 0; 

	
}

util.inherits(PacketSplitter, Transform);

PacketSplitter.prototype._transform = function (chunk, enc, cont) {

	while (chunk.length > 0) {
		var start = this.opts.lengthSize

		if (this.buffer) {
			chunk = Buffer.concat([this.buffer, chunk])
			this.buffer = null
		}

		if (this.frameLength < 0) {

		    if (chunk.length < this.opts.lengthSize) {
				this.buffer = chunk
				return cont()
			}

			this.frameLength = this.getLength(chunk)

			if (this.frameLength < 0) {
				return cont(new Error('Message length is less than zero'))
			}

			// prevent denial-of-service attacks
			if (this.opts.maxSize > 0 && this.frameLength > this.opts.maxSize) {
				return cont(new Error('Message is larger than the allowed maximum of ' + this.opts.maxSize))
			}
		} else if (this.opts.unbuffered) {
			start = 0
		}

		var end = start + this.frameLength - this.framePos

		if (this.opts.unbuffered) {
			end = Math.min(end, chunk.length)
		} else if (chunk.length < end) {
		    this.buffer = chunk
			return cont()
		}

		var buf = chunk.slice(start, end)

		buf.framePos = this.framePos
		buf.frameLength = this.frameLength

		this.framePos += end - start
		buf.frameEnd = this.framePos === this.frameLength

		if (buf.frameEnd) {
			this.frameLength = -1
			this.framePos = 0
		}

		//this.push(buf)
		{
			var packetCrc = buf.readUInt32BE();
			var packetPayload = buf.slice(4, buf.length - 4);
			if (packetCrc === buf.readUInt32BE(buf.length - 4)) {
				this.emit('packet', new Buffer(packetPayload));
			}
		}
		
		if (chunk.length > end) {
			chunk = chunk.slice(end)
		} else {
			return cont()
		}
	}
};

exports.PacketCompiler = PacketCompiler;
exports.PacketSplitter = PacketSplitter;