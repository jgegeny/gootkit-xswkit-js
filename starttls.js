

'use strict';




var net = require('net');
var tls = require('tls');
var crypto = require('crypto');

module.exports = exports = function (options, onSecure) {
    var socket, credentials, securePair;

    if (options instanceof net.Socket) {
        socket = options;
        options = {
            socket: socket
        };
    } else if (options.socket) {
        socket = options.socket;
    } else {
        socket = options.socket = net.createConnection(options);
    }

    if (options.pair) {
        securePair = options.pair;
    } else {

        
        if (tls.createSecureContext) {
            credentials = tls.createSecureContext();
        } else {
            credentials = crypto.createCredentials();
        }

        securePair = tls.createSecurePair(credentials, false);
        options.pair = securePair;
    }

    
    if (socket.readable || undefined === socket.readable) {
        return startTls(options, onSecure);
    }

    
    socket.once('connect', function () {
        startTls(options, onSecure);
    });

    return securePair;
};

function startTls(options, onSecure) {
    var socket, host, securePair, clearText;

    socket = options.socket;
    host = options.host;
    securePair = options.pair;

    socket.ondata = null;
    socket.removeAllListeners('data');

    clearText = pipe(securePair, socket);

    securePair.once('secure', function () {
        var err;

        
        err = securePair.ssl.verifyError();
        if (err) {
            clearText.authorized = false;
            clearText.authorizationError = err;
        } else {
            clearText.authorized = true;
        }

        
        if (!onSecure) {
            return;
        }

        if (host) {
            err = tls.checkServerIdentity(host, clearText.getPeerCertificate());

            
            
            if (false === err) {
                err = new Error('Server identity mismatch: invalid certificate for ' + host + '.');
            } else if (true === err) {
                err = null;
            }
        }

        onSecure.call(securePair, err);
    });

    clearText._controlReleased = true;

    return securePair;
}

function forwardEvents(events, emitterSource, emitterDestination) {
    var i, l, event, handler, forwardEvent;

    forwardEvent = function () {
        this.emit.apply(this, arguments);
    };

    for (i = 0, l = events.length; i < l; i++) {
        event = events[i];
        handler = forwardEvent.bind(emitterDestination, event);

        emitterSource.on(event, handler);
    }
}

function removeEvents(events, emitterSource) {
    var i, l;

    for (i = 0, l = events.length; i < l; i++) {
        emitterSource.removeAllListeners(events[i]);
    }
}

function pipe(securePair, socket) {
    var clearText, onError, onClose, events;

    events = ['timeout', 'end', 'drain'];
    clearText = securePair.cleartext;

    onError = function (err) {
        if (clearText._controlReleased) {
            clearText.emit('error', err);
        }
    };

    onClose = function () {
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
        removeEvents(events, socket);
    };

    
    forwardEvents(events, socket, clearText);
    socket.on('error', onError);
    socket.on('close', onClose);

    securePair.on('error', function (err) {
        onError(err);
    });

    securePair.encrypted.pipe(socket);
    socket.pipe(securePair.encrypted);

    securePair.fd = socket.fd;

    clearText.socket = socket;
    clearText.encrypted = securePair.encrypted;
    clearText.authorized = false;

    return clearText;
}