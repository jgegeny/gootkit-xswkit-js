var fs = require('fs');
var zlib = require('zlib');
var net = require('net');
var stream = require('stream');
var util = require('util');
var dns = require('dns');

var MyPacketId;
var socksSessions = {};

var States = {
	CONNECTED: 0,
	VERIFYING: 1,
	READY: 2,
	PROXY: 3
};

var AuthMethods = {
	NOAUTH: 0,
	GSSAPI: 1,
	USERPASS: 2
};

var CommandType = {
	TCPConnect: 1,
	TCPBind: 2,
	UDPBind: 3
};

var AddressTypes = {
	IPv4: 0x01,
	DomainName: 0x03,
	IPv6: 0x04,

	read: function (buffer, offset) {
		if (buffer[offset] == AddressTypes.IPv4) {
				return util.format('%d.%d.%d.%d',
						buffer[offset + 1], buffer[offset + 2],
						buffer[offset + 3], buffer[offset + 4]);
		} else if (buffer[offset] == AddressTypes.DomainName) {
				var addrLength = buffer[offset + 1];
				return buffer.toString('utf8', offset + 2, offset + 2 + addrLength);
		} else if (buffer[offset] == AddressTypes.IPv6) {
				return buffer.slice(buffer[offset + 1], buffer[offset + 1 + 16])
		}
	},

	sizeOf: function (buffer, offset) {
		if (buffer[offset] == AddressTypes.IPv4) {
				return 4;
		} else if (buffer[offset] == AddressTypes.DomainName) {
				return buffer[offset + 1] + 1;
		} else if (buffer[offset] == AddressTypes.IPv6) {
				return 16;
		}
	}
};

function authorize(username, password) {
	return true;
}



function buildSocksPacket(connectionCookie, data){

	
	

	var socksPacketBuffer = new Buffer(data.length + 2 + 4);

	socksPacketBuffer.writeUInt16BE(MyPacketId, 0);
	socksPacketBuffer.writeUInt32BE(connectionCookie, 2);

	data.copy(socksPacketBuffer, 6);

	
	

	return socksPacketBuffer;
}

function IsCloseDoorPacket(connectionCookie, socksPacket) {
    if (socksPacket.length == 8) {
        if (socksPacket.readUInt32BE() === connectionCookie) {
            if (socksPacket.readUInt32BE(4) === 0xE1DDBEAF) {
                return true;
            }
        }
    }

    return false;
}

function BuildCloseDoorPacket(connectionCookie) {
    var b = new Buffer(8);

    b.writeUInt32BE(connectionCookie);
    b.writeUInt32BE(0xE1DDBEAF, 4);

    

    return b;
}

function CloseSocksConnections(outstream, connectionCookie)
{

    

	if (typeof (socksSessions[connectionCookie]) !== 'undefined') 
	{
	    
	    outstream.sendProtocolPacket(
			MyPacketId, connectionCookie, BuildCloseDoorPacket(connectionCookie));

		if(typeof (socksSessions[connectionCookie].proxy_connection) !== 'undefined') 
		{
			socksSessions[connectionCookie].proxy_connection.destroy();			
		}

		delete socksSessions[connectionCookie];
	} else {
	    
	}
}

function OnSocksPacket(outstream, data){
	
	
	
	

	var connectionCookie = data.readUInt32BE();
	var socksPacket = data.slice(4);

	

	if (typeof (socksSessions[connectionCookie]) === 'undefined') 
	{
	    if (IsCloseDoorPacket(connectionCookie, socksPacket)) {
	        return;
	    }

		let socksVersion = socksPacket[0];

		

		socksSessions[connectionCookie] = {
		    connectionCookie: connectionCookie,
		    pstate: States.CONNECTED
		};
	    
	    
        
		if(socksVersion === 5)
		{

		    let resp = new Buffer(2);

            resp[0] = 0x05;
            resp[1] = AuthMethods.NOAUTH;

            socksSessions[connectionCookie].pstate = States.READY;
            
            outstream.sendProtocolPacket(MyPacketId, connectionCookie, resp);

		}
		else
		{
		    
			CloseSocksConnections(outstream, connectionCookie);	
		}
	}
	else
	{

	    if (IsCloseDoorPacket(connectionCookie, socksPacket)) {

	        
            
	        

	        CloseSocksConnections(
                outstream, connectionCookie);
	        return;
	    }

		if (socksSessions[connectionCookie].pstate === States.READY) 
		{

			let offset = 3;
            let address = AddressTypes.read(socksPacket, offset);
            offset += AddressTypes.sizeOf(socksPacket, offset) + 1;
            let port = socksPacket.readUInt16BE(offset);

            if (
            	socksPacket[1] === CommandType.TCPConnect && 
            	typeof(address) !== 'undefined' && 
            	typeof(port) !== 'undefined'
            ){

                function continuConnectionToIp(error, remoteAddress) {
                    if (error === null) {

                        

                        var proxy_connection = net.createConnection({ port: port, host: remoteAddress });

                        proxy_connection.setNoDelay(true);
                        proxy_connection.on('connect', function () {

                            

                            let resp = new Buffer(10);
                            let addressParts = remoteAddress.split('.');

                            resp[0] = 0x05;
                            resp[1] = 0x00;
                            resp[2] = 0x00;
                            resp[3] = 0x01;

                            resp[4] = parseInt(addressParts[0]);
                            resp[5] = parseInt(addressParts[1]);
                            resp[6] = parseInt(addressParts[2]);
                            resp[7] = parseInt(addressParts[3]);

                            resp.writeUInt16BE(port, 8);

                            if (socksSessions[connectionCookie]) {
                                socksSessions[connectionCookie].pstate = States.PROXY;
                                socksSessions[connectionCookie].proxy_connection = proxy_connection;

                                outstream.sendProtocolPacket(MyPacketId, connectionCookie, resp);
                            }
                            else {
                                CloseSocksConnections(
                                    outstream, connectionCookie);
                            }

                            

                        }).on('error', function (error) {

                            

                            CloseSocksConnections(
                                outstream, connectionCookie);

                        }).on('close', function () {

                            
                            
                            

                            CloseSocksConnections(
                                outstream, connectionCookie);

                            
                        }).on('data', function (data) {

                            

                            if(outstream.sendProtocolPacket(
                                MyPacketId, connectionCookie, data) == false)
                            {
                                proxy_connection.pause();

                                outstream.once('drain', function () {
                                    setTimeout(function () {
                                        proxy_connection.resume();
                                    }, 10);

                                });

                            }
                        });
                    }
                    else {
                        CloseSocksConnections(
                            outstream, connectionCookie);
                    }
                }

                if (net.isIPv4(address)) {
                    
                    setTimeout(function () {
                        continuConnectionToIp(null, address);
                    }, 500);
                } else {

                    

                    dns.resolve4(address, function(error, ips){
                        setTimeout(function () {
                            continuConnectionToIp(error, ips ? ips[0] : null);
                        }, 500);
                    });
                }
            	

            	
            }
            else
            {
	            CloseSocksConnections(
	                outstream, connectionCookie);
            }
		}
		else if (socksSessions[connectionCookie].pstate === States.PROXY) 
		{

		    
		    

		    if( typeof(socksSessions[connectionCookie].proxy_connection) !== 'undefined')
		    {
		        socksSessions[connectionCookie]
                    .proxy_connection.write(socksPacket);

		    }
		}
	}
}

exports.on_disconnect = function () {
    for (var connectionCookie in socksSessions) {
        if (socksSessions[connectionCookie].proxy_connection) {
            socksSessions[connectionCookie].proxy_connection.destroy();
            delete socksSessions[connectionCookie];
        }
    }
}

exports.register = function (prtocolId, packetParsers, procolPacketBuilders) {
	

	MyPacketId = prtocolId;


	packetParsers[prtocolId] = OnSocksPacket;
	procolPacketBuilders[prtocolId] = buildSocksPacket;
}