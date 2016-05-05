var fs = require('fs');
var zlib = require('zlib');
var net = require('net');
var stream = require('stream');
var util = require('util');

var MyPacketId;
var pingRequest = new Buffer([0x00]);
var pingReply = new Buffer([0x01]);

function buildPingPacket(data)
{
	var packet = new Buffer(data.length + 2);

	packet.writeUInt16BE(MyPacketId, 0);
	data.copy(packet, 2);

	return packet;
}


function OnPingPacket(outstream, data)
{
	
	outstream.sendProtocolPacket(
		MyPacketId, pingReply);
}

exports.register = function (prtocolId, packetParsers, procolPacketBuilders) {
	

	MyPacketId = prtocolId;


	packetParsers[prtocolId] = OnPingPacket;
	procolPacketBuilders[prtocolId] = buildPingPacket;
}